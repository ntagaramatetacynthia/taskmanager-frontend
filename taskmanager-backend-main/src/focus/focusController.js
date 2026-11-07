import { Task, Class } from '../database.js';
import FocusSession from './FocusSession.js';
import {
  accrueFocusedMs,
  accruePausedMs,
  assignmentProblem,
  focusModeOf,
  focusedMsOf,
  requiredFocusMs,
  summariseFocus,
  toPublicSession,
} from './focusService.js';

const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });

async function loadOwnSession(req, res) {
  const session = await FocusSession.findByPk(req.params.id);
  if (!session) {
    fail(res, 404, 'SESSION_NOT_FOUND', 'Focus session not found.');
    return null;
  }
  if (Number(session.student_id) !== Number(req.user.id)) {
    fail(res, 403, 'NOT_YOUR_SESSION', 'This focus session belongs to another student.');
    return null;
  }
  return session;
}

class FocusController {
  /** GET /api/focus/tasks/:taskId/status — what the student panel and the gate read. */
  async getStatus(req, res) {
    try {
      const task = await Task.findByPk(req.params.taskId);
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');

      const problem = await assignmentProblem(task, req.user.id);
      if (problem) return fail(res, 403, 'NOT_ASSIGNED', problem);

      const summary = await summariseFocus(req.user.id, task);
      return res.json({ success: true, data: { task_id: task.id, ...summary } });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to load focus status.', error: error.message });
    }
  }

  /** POST /api/focus/tasks/:taskId/sessions — start (or reuse) a session. */
  async startSession(req, res) {
    try {
      const task = await Task.findByPk(req.params.taskId);
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');
      if (task.status !== 'published') {
        return fail(res, 400, 'TASK_NOT_OPEN', 'This task is not open for work.');
      }

      const problem = await assignmentProblem(task, req.user.id);
      if (problem) return fail(res, 403, 'NOT_ASSIGNED', problem);

      const open = await FocusSession.findOne({
        where: { task_id: task.id, student_id: req.user.id, status: ['RUNNING', 'PAUSED'] },
        order: [['id', 'DESC']],
      });

      if (open) {
        // Idempotent start: a double click or a refresh returns the same session.
        return res.json({ success: true, message: 'Focus session resumed.', data: toPublicSession(open) });
      }

      const now = new Date();
      const session = await FocusSession.create({
        task_id: task.id,
        student_id: req.user.id,
        organization_id: req.user.organization_id,
        mode: focusModeOf(task),
        required_ms: requiredFocusMs(task),
        status: 'RUNNING',
        started_at: now,
        last_tick_at: now,
      });

      return res.status(201).json({ success: true, message: 'Focus session started.', data: toPublicSession(session) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to start focus session.', error: error.message });
    }
  }

  /** POST /api/focus/sessions/:id/heartbeat — advances verified time from the server clock. */
  async heartbeat(req, res) {
    try {
      const session = await loadOwnSession(req, res);
      if (!session) return undefined;
      if (session.status !== 'RUNNING') {
        return res.json({ success: true, data: toPublicSession(session) });
      }

      const now = new Date();
      await session.update({ focused_ms: accrueFocusedMs(session, now), last_tick_at: now });
      return res.json({ success: true, data: toPublicSession(session) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to record focus heartbeat.', error: error.message });
    }
  }

  /** POST /api/focus/sessions/:id/pause — body: { reason } */
  async pause(req, res) {
    try {
      const session = await loadOwnSession(req, res);
      if (!session) return undefined;
      if (session.status === 'COMPLETED') {
        return fail(res, 409, 'SESSION_COMPLETED', 'This focus session is already completed.');
      }
      if (session.status !== 'RUNNING') {
        return res.json({ success: true, data: toPublicSession(session) });
      }

      const now = new Date();
      const reason = String(req.body?.reason || 'manual').slice(0, 40);
      const interruptions = [
        ...(session.interruptions || []),
        { type: reason, at: now.toISOString(), after_focused_ms: focusedMsOf(session) },
      ];

      await session.update({
        focused_ms: accrueFocusedMs(session, now),
        status: 'PAUSED',
        paused_at: now,
        last_tick_at: null,
        interruptions,
      });
      return res.json({ success: true, message: 'Focus paused.', data: toPublicSession(session) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to pause focus session.', error: error.message });
    }
  }

  /** POST /api/focus/sessions/:id/resume */
  async resume(req, res) {
    try {
      const session = await loadOwnSession(req, res);
      if (!session) return undefined;
      if (session.status === 'COMPLETED') {
        return fail(res, 409, 'SESSION_COMPLETED', 'This focus session is already completed.');
      }
      if (session.status === 'RUNNING') {
        return res.json({ success: true, data: toPublicSession(session) });
      }

      const now = new Date();
      await session.update({
        paused_ms: accruePausedMs(session, now),
        status: 'RUNNING',
        paused_at: null,
        last_tick_at: now,
      });
      return res.json({ success: true, message: 'Focus resumed.', data: toPublicSession(session) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to resume focus session.', error: error.message });
    }
  }

  /**
   * POST /api/focus/sessions/:id/complete — idempotent.
   * A second call returns the stored row, so retries cannot create duplicate completions.
   */
  async complete(req, res) {
    try {
      const session = await loadOwnSession(req, res);
      if (!session) return undefined;

      if (session.status === 'COMPLETED') {
        const task = await Task.findByPk(session.task_id);
        const summary = task ? await summariseFocus(req.user.id, task) : null;
        return res.json({ success: true, already_completed: true, data: toPublicSession(session), summary });
      }

      const now = new Date();
      const focusedMs = accrueFocusedMs(session, now);
      const requiredMs = Number(session.required_ms) || 0;
      const verified = requiredMs === 0 ? focusedMs > 0 : focusedMs >= requiredMs;

      await session.update({
        focused_ms: focusedMs,
        status: 'COMPLETED',
        completed_at: now,
        ended_at: now,
        paused_at: null,
        last_tick_at: null,
        verified,
        blocks_completed: Math.max(Number(session.blocks_completed) || 0, 1),
      });

      const task = await Task.findByPk(session.task_id);
      const summary = task ? await summariseFocus(req.user.id, task) : null;

      return res.json({
        success: true,
        message: verified
          ? 'Focus requirement completed.'
          : 'Focus session saved, but the required focus time is not yet met.',
        data: toPublicSession(session),
        summary,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to complete focus session.', error: error.message });
    }
  }

  /** POST /api/focus/sessions/:id/abandon — records the work but closes the session. */
  async abandon(req, res) {
    try {
      const session = await loadOwnSession(req, res);
      if (!session) return undefined;
      if (session.status === 'COMPLETED') {
        return fail(res, 409, 'SESSION_COMPLETED', 'Completed focus sessions cannot be abandoned.');
      }

      const now = new Date();
      await session.update({
        focused_ms: accrueFocusedMs(session, now),
        paused_ms: accruePausedMs(session, now),
        status: 'ABANDONED',
        ended_at: now,
        paused_at: null,
        last_tick_at: null,
      });
      return res.json({ success: true, message: 'Focus session closed.', data: toPublicSession(session) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to abandon focus session.', error: error.message });
    }
  }

  /** GET /api/focus/tasks/:taskId/sessions — teacher/org-admin view of one task. */
  async listTaskSessions(req, res) {
    try {
      const task = await Task.findByPk(req.params.taskId, { include: [{ model: Class, as: 'class' }] });
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');

      const isOwner = Number(task.created_by) === Number(req.user.id);
      const isOrgAdmin = req.user.role === 'organization_admin';
      if (!isOwner && !isOrgAdmin) return fail(res, 403, 'NOT_TASK_OWNER', 'You can only review your own tasks.');

      if (isOrgAdmin && req.user.organization_id && task.class?.organization_id
          && Number(task.class.organization_id) !== Number(req.user.organization_id)) {
        return fail(res, 403, 'WRONG_ORGANIZATION', 'This task belongs to another organization.');
      }

      const sessions = await FocusSession.findAll({
        where: { task_id: task.id },
        order: [['student_id', 'ASC'], ['id', 'ASC']],
      });

      return res.json({ success: true, data: sessions.map(toPublicSession), count: sessions.length });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to load focus sessions.', error: error.message });
    }
  }
}

export default new FocusController();
