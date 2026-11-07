/**
 * Focus policy helpers shared by the focus endpoints and the submission gate.
 *
 * Everything here is derived from stored rows: no endpoint accepts a client-supplied
 * "I focused for N minutes" number.
 */
import FocusSession from './FocusSession.js';
import { StudentProfile } from '../database.js';

export const DEFAULT_FOCUS_MINUTES = 25;
export const MIN_FOCUS_MINUTES = 1;
export const MAX_FOCUS_MINUTES = 180;
export const OPEN_STATUSES = ['RUNNING', 'PAUSED'];

// A single session can never claim more than a working day of focus.
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

export function requiredFocusSeconds(task) {
  const minutes = Number(task?.focus_minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round(minutes * 60);
}

export function requiredFocusMs(task) {
  return requiredFocusSeconds(task) * 1000;
}

export function focusModeOf(task) {
  return task?.focus_mode === 'continuous' ? 'continuous' : 'accumulated';
}

export function focusedMsOf(session) {
  return Math.max(0, Number(session?.focused_ms) || 0);
}

export function pausedMsOf(session) {
  return Math.max(0, Number(session?.paused_ms) || 0);
}

/**
 * Credits elapsed time to a RUNNING session using the server clock.
 * `last_tick_at` is the anchor, so repeated calls cannot double count.
 */
export function accrueFocusedMs(session, at = new Date()) {
  const current = focusedMsOf(session);
  if (!session || session.status !== 'RUNNING' || !session.last_tick_at) return current;
  const delta = new Date(at).getTime() - new Date(session.last_tick_at).getTime();
  if (!Number.isFinite(delta) || delta <= 0) return current;
  return Math.min(MAX_SESSION_MS, current + delta);
}

export function accruePausedMs(session, at = new Date()) {
  const current = pausedMsOf(session);
  if (!session || session.status !== 'PAUSED' || !session.paused_at) return current;
  const delta = new Date(at).getTime() - new Date(session.paused_at).getTime();
  if (!Number.isFinite(delta) || delta <= 0) return current;
  return Math.min(MAX_SESSION_MS, current + delta);
}

export function toPublicSession(session) {
  if (!session) return null;
  const plain = typeof session.toJSON === 'function' ? session.toJSON() : session;
  return {
    id: plain.id,
    task_id: plain.task_id,
    student_id: plain.student_id,
    status: plain.status,
    mode: plain.mode,
    required_ms: Number(plain.required_ms) || 0,
    focused_ms: focusedMsOf(plain),
    paused_ms: pausedMsOf(plain),
    blocks_completed: Number(plain.blocks_completed) || 0,
    interruptions: plain.interruptions || [],
    verified: Boolean(plain.verified),
    started_at: plain.started_at,
    completed_at: plain.completed_at,
    ended_at: plain.ended_at,
    updated_at: plain.updatedAt,
  };
}

/**
 * Aggregates a student's verified focus for one task.
 *
 * - `accumulated`: the sum of every completed session counts.
 * - `continuous`: only a single completed session long enough satisfies the requirement,
 *   partial sessions are never combined.
 */
export async function summariseFocus(studentId, task) {
  const requiredMs = requiredFocusMs(task);
  const mode = focusModeOf(task);

  const sessions = await FocusSession.findAll({
    where: { task_id: task.id, student_id: studentId },
    order: [['id', 'ASC']],
  });

  const completed = sessions.filter((session) => session.status === 'COMPLETED');
  const completedPer = completed.map(focusedMsOf);
  const completedMs = completedPer.reduce((total, ms) => total + ms, 0);
  const bestMs = completedPer.reduce((max, ms) => Math.max(max, ms), 0);

  let satisfied;
  let verifiedMs;
  if (requiredMs === 0) {
    // Tasks created before the focus policy existed carry no requirement.
    satisfied = true;
    verifiedMs = completedMs;
  } else if (mode === 'continuous') {
    satisfied = bestMs >= requiredMs;
    verifiedMs = Math.min(bestMs, requiredMs);
  } else {
    satisfied = completedMs >= requiredMs;
    verifiedMs = Math.min(completedMs, requiredMs);
  }

  const open = sessions.find((session) => OPEN_STATUSES.includes(session.status)) || null;

  return {
    required_ms: requiredMs,
    required_seconds: requiredMs / 1000,
    required_minutes: requiredMs ? requiredMs / 60000 : 0,
    verified_ms: verifiedMs,
    verified_seconds: Math.floor(verifiedMs / 1000),
    completed_ms: completedMs,
    completed_seconds: Math.floor(completedMs / 1000),
    mode,
    satisfied,
    open_session: toPublicSession(open),
    sessions: sessions.map(toPublicSession),
  };
}

/** Human text used by both the status endpoint and the submission gate. */
export function focusShortfallMessage(summary) {
  const focusedSeconds = Math.max(0, Math.round(summary.completed_seconds));
  const requiredMinutes = Math.max(1, Math.round(summary.required_seconds / 60));
  const wholeMinutes = Math.floor(focusedSeconds / 60);
  const remainderSeconds = focusedSeconds % 60;
  // Sub-minute progress is reported in seconds; flooring it to "0 minutes" reads as if
  // nothing was recorded at all.
  const done = focusedSeconds < 60
    ? `${focusedSeconds} seconds`
    : `${wholeMinutes} min ${remainderSeconds}s`;

  return `Focus requirement not yet completed. You have completed ${done} of ${requiredMinutes} required focused minutes.`;
}

/**
 * Students may only submit tasks assigned to their class.
 * Returns an error message, or null when the student is allowed.
 */
export async function assignmentProblem(task, studentId) {
  if (!task) return 'Task not found.';
  if (!task.class_id) return null; // class-less tasks are visible to nobody, keep legacy behaviour
  const profile = await StudentProfile.findOne({ where: { user_id: studentId } });
  if (!profile) return 'You are not assigned to this task.';
  if (Number(profile.class_id) !== Number(task.class_id)) return 'You are not assigned to this task.';
  return null;
}
