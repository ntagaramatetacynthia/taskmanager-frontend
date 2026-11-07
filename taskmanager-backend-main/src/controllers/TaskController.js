import { Task, Submission, User, Class, Subject, StudentProfile, Reminder } from '../database.js';
import sequelize from '../database.js';
import { Op } from 'sequelize';
import { getFileUrl } from '../services/FileUploadService.js';
import EmailService from '../services/EmailService.js';
import {
  assignmentProblem,
  focusShortfallMessage,
  summariseFocus,
} from '../focus/focusService.js';
import TaskAttachment from '../attachments/TaskAttachment.js';
import { publicAttachment, WORKSHEET_KIND } from '../attachments/attachmentService.js';

// The dropdown offers 5..60 plus custom 1..180; anything else falls back to "no requirement".
const normalizeFocusMinutes = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(180, Math.max(1, minutes));
};

const normalizeFocusMode = (value) => (value === 'continuous' ? 'continuous' : 'accumulated');

class TaskController {
  // Create task
  async createTask(req, res) {
    try {
      const {
        title, description, instructions, due_date, class_id, subject_id,
        priority, type, max_score, submission_type, late_submission_allowed,
        late_penalty_percentage, group_task, max_group_size, allowed_file_types, rubric,
        focus_minutes, focus_mode
      } = req.body;

      // Verify class belongs to organization
      if (class_id) {
        const cls = await Class.findOne({
          where: { id: class_id, organization_id: req.user.organization_id }
        });
        if (!cls) return res.status(400).json({ success: false, message: 'Invalid class' });
      }

      const task = await Task.create({
        title, description, instructions, due_date,
        class_id, subject_id,
        priority: priority || 'medium',
        type: type || 'assignment',
        max_score: max_score || 100,
        submission_type: submission_type || 'both',
        late_submission_allowed: late_submission_allowed !== false,
        late_penalty_percentage: late_penalty_percentage || 10,
        focus_minutes: normalizeFocusMinutes(focus_minutes),
        focus_mode: normalizeFocusMode(focus_mode),
        group_task: group_task || false,
        max_group_size: max_group_size || 1,
        allowed_file_types: allowed_file_types || ['pdf', 'doc', 'docx'],
        rubric,
        created_by: req.user.id,
        status: 'draft'
      });

      // Auto-publish task for teachers and workers/staff (immediate visibility to students)
      const userRoleLower = String(req.user?.role || '').toLowerCase();
      const isTeacherOrStaff = ['teacher', 'worker', 'staff'].includes(userRoleLower);
      if (isTeacherOrStaff) {
        await task.update({ status: 'published', published_at: new Date() });

        // Notify students in the class
        if (task.class_id) {
          const students = await StudentProfile.findAll({
            where: { class_id: task.class_id },
            include: [{ model: User, as: 'user', where: { status: 'active' } }]
          });

          for (const profile of students) {
            try {
              await EmailService.sendTaskAssigned(profile.user, task);
            } catch (err) {
              console.error(`Email failed for ${profile.user.email}:`, err.message);
            }
          }
        }
      }

      const statusMessage = isTeacherOrStaff ? 'Task created and published' : 'Task created as draft';
      res.status(201).json({ success: true, message: statusMessage, data: task });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
    }
  }

  // Publish task (sends notifications to students)
  async publishTask(req, res) {
    try {
      const task = await Task.findOne({
        where: { id: req.params.id, created_by: req.user.id },
        include: [{ model: Class, as: 'class' }]
      });

      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      if (task.status !== 'draft') return res.status(400).json({ success: false, message: 'Task is already published' });

      await task.update({ status: 'published', published_at: new Date() });

      // Notify students in the class
      if (task.class_id) {
        const students = await StudentProfile.findAll({
          where: { class_id: task.class_id },
          include: [{ model: User, as: 'user', where: { status: 'active' } }]
        });

        for (const profile of students) {
          try {
            await EmailService.sendTaskAssigned(profile.user, task);
          } catch (err) {
            console.error(`Email failed for ${profile.user.email}:`, err.message);
          }
        }
      }

      res.json({ success: true, message: 'Task published and students notified', data: task });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to publish task', error: error.message });
    }
  }

  // Get tasks (role-aware)
  async getTasks(req, res) {
    try {
      const { status, class_id, priority, type, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (class_id) where.class_id = class_id;
      if (priority) where.priority = priority;
      if (type) where.type = type;

      // Teachers see only their tasks
      if (req.user.role === 'teacher') {
        where.created_by = req.user.id;
      }

      // Students see tasks for their class
      if (['student', 'intern'].includes(req.user.role)) {
        const profile = await StudentProfile.findOne({ where: { user_id: req.user.id } });
        if (profile) where.class_id = profile.class_id;
        where.status = 'published';
      }

      const { count, rows } = await Task.findAndCountAll({
        where,
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name'] },
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
          { model: Subject, as: 'subject', attributes: ['id', 'name'], required: false }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['due_date', 'ASC']]
      });

      // For students, attach their submission status
      let data = rows;
      if (['student', 'intern'].includes(req.user.role)) {
        const taskIds = rows.map(t => t.id);
        const submissions = await Submission.findAll({
          where: { task_id: { [Op.in]: taskIds }, student_id: req.user.id },
          attributes: ['task_id', 'status', 'score', 'submitted_at']
        });
        const subMap = {};
        submissions.forEach(s => { subMap[s.task_id] = s; });
        data = rows.map(t => ({ ...t.toJSON(), my_submission: subMap[t.id] || null }));
      }

      res.json({
        success: true,
        data,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
    }
  }

  // Get single task
  async getTask(req, res) {
    try {
      const task = await Task.findByPk(req.params.id, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
          { model: Subject, as: 'subject', required: false }
        ]
      });

      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      let mySubmission = null;
      if (['student', 'intern'].includes(req.user.role)) {
        mySubmission = await Submission.findOne({
          where: { task_id: task.id, student_id: req.user.id }
        });
      }

      // Metadata only: the file itself is streamed by GET /api/tasks/:id/attachment so
      // access stays authorized instead of relying on the public /uploads path.
      const worksheet = await TaskAttachment.findOne({
        where: { task_id: task.id, kind: WORKSHEET_KIND }
      });

      res.json({
        success: true,
        data: {
          ...task.toJSON(),
          attachment: publicAttachment(worksheet),
          my_submission: mySubmission
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch task', error: error.message });
    }
  }

  // Submit task (with optional file upload)
  async submitTask(req, res) {
    try {
      const task = await Task.findByPk(req.params.id);

      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      if (!task.canSubmit()) {
        return res.status(400).json({
          success: false,
          code: 'TASK_CLOSED',
          message: task.isOverdue() && !task.late_submission_allowed
            ? 'The submission deadline has passed.'
            : 'This task is not accepting submissions.'
        });
      }

      // Assigned students only. Before this check any authenticated student could submit
      // any published task simply by knowing its id.
      const assignmentIssue = await assignmentProblem(task, req.user.id);
      if (assignmentIssue) {
        return res.status(403).json({ success: false, code: 'NOT_ASSIGNED', message: assignmentIssue });
      }

      // Focus gate: recomputed from stored sessions, never from a client counter.
      const focus = await summariseFocus(req.user.id, task);
      if (focus.required_ms > 0 && !focus.satisfied) {
        return res.status(409).json({
          success: false,
          code: 'FOCUS_REQUIRED',
          message: focusShortfallMessage(focus),
          data: {
            required_seconds: focus.required_seconds,
            completed_seconds: focus.completed_seconds,
            mode: focus.mode
          }
        });
      }

      const existing = await Submission.findOne({
        where: { task_id: task.id, student_id: req.user.id }
      });

      const isLate = task.isOverdue();
      const lateHours = isLate
        ? Math.round((new Date() - new Date(task.due_date)) / (1000 * 60 * 60))
        : 0;

      const submissionData = {
        task_id: task.id,
        student_id: req.user.id,
        content: req.body.content || null,
        status: 'submitted',
        submitted_at: new Date(),
        is_late: isLate,
        late_hours: lateHours,
        max_score: task.max_score
      };

      if (req.file) {
        submissionData.file_url = getFileUrl(req.file.filename);
        submissionData.file_name = req.file.originalname;
        submissionData.file_size = req.file.size;
        submissionData.file_type = req.file.mimetype;
      }

      let submission;
      if (existing) {
        submissionData.attempt_number = (existing.attempt_number || 1) + 1;
        submissionData.status = 'resubmitted';
        await existing.update(submissionData);
        submission = existing;
      } else {
        submission = await Submission.create(submissionData);
        await task.increment('total_submissions');
      }

      res.json({
        success: true,
        message: isLate ? 'Submitted late. Penalty may apply.' : 'Submitted successfully',
        data: submission
      });
    } catch (error) {
      // Return more context to make deployment issues debuggable.
      console.error('Submission failed:', {
        taskId: req.params?.id,
        studentId: req.user?.id,
        hasFile: !!req.file,
        fileField: req.file?.fieldname,
        error: error?.message,
      });

      res.status(500).json({
        success: false,
        message: 'Submission failed',
        error: error?.message,
        details: {
          taskId: req.params?.id,
          studentId: req.user?.id,
          hasFile: !!req.file,
          fileName: req.file?.originalname || null,
          fileType: req.file?.mimetype || null,
        }
      });
    }

  }

  // Get all submissions for a task (teacher/admin)
  async getSubmissions(req, res) {
    try {
      const task = await Task.findOne({
        where: { id: req.params.id, created_by: req.user.id }
      });

      if (!task && req.user.role !== 'organization_admin') {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }

      const submissions = await Submission.findAll({
        where: { task_id: req.params.id },
        include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
        order: [['submitted_at', 'DESC']]
      });

      res.json({ success: true, data: submissions, count: submissions.length });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: error.message });
    }
  }

  // Grade a submission
  async gradeSubmission(req, res) {
    try {
      const { score, feedback, grade } = req.body;

      const submission = await Submission.findOne({
        where: { id: req.params.submissionId, task_id: req.params.id }
      });

      if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

      const percentage = (score / submission.max_score) * 100;
      const autoGrade = grade || submission.calculateGrade();

      await submission.update({
        score,
        percentage,
        grade: autoGrade,
        feedback,
        graded_by: req.user.id,
        graded_at: new Date(),
        status: 'graded'
      });

      await Task.increment('graded_submissions', { where: { id: req.params.id } });

      res.json({ success: true, message: 'Submission graded successfully', data: submission });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to grade submission', error: error.message });
    }
  }

  // Update task
  async updateTask(req, res) {
    try {
      const taskWhere = { id: req.params.id };
      const userRoleLower = String(req.user.role || '').toLowerCase();
      const isAdmin = ['organization_admin', 'admin', 'district_admin'].includes(userRoleLower);
      if (!isAdmin) {
        taskWhere.created_by = req.user.id;
      }

      const task = await Task.findOne({
        where: taskWhere,
        include: [{ model: Class, as: 'class' }]
      });

      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      if (isAdmin && task.class && task.class.organization_id !== req.user.organization_id) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
      }

      const {
        title,
        description,
        instructions,
        due_date,
        priority,
        status,
        type,
        max_score,
        submission_type,
        late_submission_allowed,
        late_penalty_percentage,
        class_id,
        subject_id,
        focus_minutes,
        focus_mode
      } = req.body;

      const updateFields = {};
      if (title !== undefined) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (instructions !== undefined) updateFields.instructions = instructions;
      if (due_date !== undefined) updateFields.due_date = due_date;
      if (priority !== undefined) updateFields.priority = priority;
      if (status !== undefined) updateFields.status = status;
      if (type !== undefined) updateFields.type = type;
      if (max_score !== undefined) updateFields.max_score = Number(max_score);
      if (submission_type !== undefined) updateFields.submission_type = submission_type;
      if (late_submission_allowed !== undefined) updateFields.late_submission_allowed = Boolean(late_submission_allowed);
      if (late_penalty_percentage !== undefined) updateFields.late_penalty_percentage = Number(late_penalty_percentage);
      if (class_id !== undefined) updateFields.class_id = Number(class_id);
      if (subject_id !== undefined) updateFields.subject_id = subject_id ? Number(subject_id) : null;
      if (focus_minutes !== undefined) updateFields.focus_minutes = normalizeFocusMinutes(focus_minutes);
      if (focus_mode !== undefined) updateFields.focus_mode = normalizeFocusMode(focus_mode);

      // If publishing task from draft, also send notifications
      if (status === 'published' && task.status === 'draft') {
        const targetClassId = updateFields.class_id || task.class_id;
        if (targetClassId) {
          const students = await StudentProfile.findAll({
            where: { class_id: targetClassId },
            include: [{ model: User, as: 'user', where: { status: 'active' } }]
          });

          for (const profile of students) {
            try {
              await EmailService.sendTaskAssigned(profile.user, task);
            } catch (err) {
              console.error(`Email failed for ${profile.user.email}:`, err.message);
            }
          }
        }
        updateFields.published_at = new Date();
      }

      await task.update(updateFields);

      const updatedTask = await Task.findByPk(task.id, {
        include: [
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
          { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'name'] }
        ]
      });

      res.json({ success: true, message: 'Task updated successfully', data: updatedTask });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update task', error: error.message });
    }
  }

  // Soft delete task
  async deleteTask(req, res) {
    try {
      // 1. Verify and extract user details from JWT token or session
      const userId = req.user?.id || req.admin?.id;
      const userRole = (req.userType === 'district_admin' ? 'district_admin' : req.user?.role) || '';

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No authenticated user found.'
        });
      }

      // 2. Fetch task by PK (or use task already loaded by middleware)
      const task = req.task || await Task.findByPk(req.params.id, {
        include: [{ model: Class, as: 'class' }]
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      // 3. Organization scoping check
      if (req.user?.organization_id && task.class?.organization_id) {
        if (Number(task.class.organization_id) !== Number(req.user.organization_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Task belongs to another organization.'
          });
        }
      }

      // 4. Permission verification: Admin, Teacher, OR original task creator
      const normalizedRole = String(userRole).toLowerCase().trim();
      const isAdminOrTeacher = [
        'organization_admin',
        'admin',
        'district_admin',
        'super_admin',
        'teacher'
      ].includes(normalizedRole);

      const creatorId = task.created_by ?? task.creator_id;
      const isCreator = Boolean(creatorId && String(creatorId) === String(userId));

      if (!isAdminOrTeacher && !isCreator) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      // 5. Execute safe soft delete
      await task.destroy();

      return res.status(200).json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete task',
        error: error.message
      });
    }
  }

  // Analytics: submission rates per class (for org admin / district admin)
  async getTaskAnalytics(req, res) {
    try {
      const orgId = req.user.organization_id;

      const analytics = await Task.findAll({
        include: [
          { model: Class, as: 'class', where: { organization_id: orgId }, attributes: ['id', 'name'] },
          {
            model: Submission, as: 'submissions',
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('submissions.id')), 'count']],
            required: false
          }
        ],
        attributes: ['id', 'title', 'due_date', 'total_submissions', 'graded_submissions', 'status'],
        where: { status: { [Op.in]: ['published', 'closed'] } },
        group: ['Task.id', 'class.id', 'submissions.status'],
        order: [['due_date', 'DESC']],
        limit: 50
      });

      res.json({ success: true, data: analytics });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
    }
  }
}

export default new TaskController();
