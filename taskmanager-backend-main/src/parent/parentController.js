import { Op } from 'sequelize';
import Joi from 'joi';
import {
  User, StudentProfile, Organization, Class, Subject, Task, Submission, AuditLog,
} from '../database.js';
import Feedback from './Feedback.js';
import { signParentToken } from './parentAuth.js';

// Compare phone numbers on their national part so "+250 788 123 456", "250788123456"
// and "0788123456" all match the stored guardian_phone.
const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const GENERIC_LOGIN_ERROR = 'The details provided do not match our records.';

const loginSchema = Joi.object({
  organization_code: Joi.string().trim().min(2).max(30).required(),
  student_id: Joi.string().trim().min(1).max(50).required(),
  guardian_phone: Joi.string().trim().min(6).max(20).required(),
});

const feedbackSchema = Joi.object({
  message: Joi.string().trim().min(5).max(5000).required(),
  title: Joi.string().trim().max(200).allow('', null),
  teacher_id: Joi.number().integer().positive().allow(null),
  subject_id: Joi.number().integer().positive().allow(null),
  parent_name: Joi.string().trim().max(100).allow('', null),
});

const audit = (req, data) =>
  AuditLog.create({
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    category: 'parent_portal',
    resource_type: 'parent',
    ...data,
  }).catch(() => {});

// Class teacher (Class.manager) + every subject teacher for the child's class.
async function loadTeachers(classId) {
  const cls = await Class.findByPk(classId, {
    include: [
      { model: User, as: 'manager', attributes: ['id', 'name', 'email'] },
      {
        model: Subject, as: 'subjects', required: false,
        where: { status: 'active' },
        include: [{ model: User, as: 'teacher', attributes: ['id', 'name', 'email'] }],
      },
    ],
  });
  if (!cls) return { cls: null, classTeacher: null, subjectTeachers: [] };

  const subjectTeachers = (cls.subjects || [])
    .filter((s) => s.teacher)
    .map((s) => ({
      teacher_id: s.teacher.id,
      teacher_name: s.teacher.name,
      subject_id: s.id,
      subject_name: s.name,
      subject_code: s.code,
    }));

  const classTeacher = cls.manager
    ? { teacher_id: cls.manager.id, teacher_name: cls.manager.name }
    : null;

  return { cls, classTeacher, subjectTeachers };
}

class ParentController {
  // POST /api/parent/login
  async login(req, res) {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }
      const { organization_code, student_id, guardian_phone } = value;

      const organizations = await Organization.findAll({
        where: { code: organization_code.toUpperCase(), status: 'approved' },
        attributes: ['id'],
      });
      if (!organizations.length) {
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
      }

      const profile = await StudentProfile.findOne({
        where: { student_id },
        include: [{
          model: User, as: 'user', required: true,
          where: { organization_id: { [Op.in]: organizations.map((o) => o.id) } },
          include: [{ model: Organization, as: 'organization' }],
        }],
      });

      const phoneOk = profile?.guardian_phone &&
        normalizePhone(profile.guardian_phone).length >= 6 &&
        normalizePhone(profile.guardian_phone) === normalizePhone(guardian_phone);

      if (!profile || !phoneOk) {
        audit(req, {
          action: 'parent_login_failed', severity: 'warning', success: false,
          description: `Failed parent login for student ID ${student_id}`,
        });
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
      }

      const student = profile.user;
      const token = signParentToken(profile, student);

      audit(req, {
        action: 'parent_login', user_id: student.id, organization_id: student.organization_id,
        resource_id: student.id, description: `Parent login for student ${profile.student_id}`,
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          parent: {
            guardian_name: profile.guardian_name,
            student: {
              id: student.id,
              name: student.name,
              student_id: profile.student_id,
              class_id: profile.class_id,
            },
            organization: { id: student.organization.id, name: student.organization.name },
          },
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // GET /api/parent/dashboard
  async dashboard(req, res) {
    try {
      const { student, profile } = req.parent;

      const [{ cls, classTeacher, subjectTeachers }, tasks, submissions] = await Promise.all([
        loadTeachers(profile.class_id),
        Task.findAll({
          where: { class_id: profile.class_id, status: 'published' },
          include: [
            { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
            { model: User, as: 'creator', attributes: ['id', 'name'] },
          ],
          order: [['due_date', 'DESC']],
        }),
        Submission.findAll({ where: { student_id: student.id } }),
      ]);

      const subByTask = new Map(submissions.map((s) => [s.task_id, s]));
      const now = new Date();

      const taskRows = tasks.map((t) => {
        const sub = subByTask.get(t.id);
        let status;
        if (sub && sub.status === 'graded') status = 'graded';
        else if (sub && sub.status !== 'draft') status = sub.is_late ? 'late' : 'submitted';
        else status = new Date(t.due_date) < now ? 'overdue' : 'pending';

        const pct = sub?.percentage != null ? Number(sub.percentage)
          : (sub?.score != null && (sub.max_score || t.max_score)
            ? (Number(sub.score) / (sub.max_score || t.max_score)) * 100 : null);

        return {
          task_id: t.id,
          title: t.title,
          type: t.type,
          due_date: t.due_date,
          max_score: t.max_score,
          subject: t.subject ? { id: t.subject.id, name: t.subject.name } : null,
          teacher: t.creator ? { id: t.creator.id, name: t.creator.name } : null,
          status,
          submitted_at: sub?.submitted_at || null,
          score: sub?.score != null ? Number(sub.score) : null,
          percentage: pct != null ? Math.round(pct * 10) / 10 : null,
          grade: sub?.grade || null,
          teacher_feedback: sub?.feedback || null,
        };
      });

      const total = taskRows.length;
      const completed = taskRows.filter((r) => ['submitted', 'late', 'graded'].includes(r.status)).length;
      const graded = taskRows.filter((r) => r.percentage != null);
      const onTime = taskRows.filter((r) => ['submitted', 'graded'].includes(r.status)).length;
      const avg = graded.length
        ? Math.round((graded.reduce((a, r) => a + r.percentage, 0) / graded.length) * 10) / 10
        : null;

      const bySubject = {};
      for (const r of taskRows) {
        const key = r.subject?.name || 'General';
        bySubject[key] ||= { subject: key, total: 0, completed: 0, scores: [] };
        bySubject[key].total += 1;
        if (['submitted', 'late', 'graded'].includes(r.status)) bySubject[key].completed += 1;
        if (r.percentage != null) bySubject[key].scores.push(r.percentage);
      }

      res.json({
        success: true,
        data: {
          student: {
            id: student.id,
            name: student.name,
            student_id: profile.student_id,
            guardian_name: profile.guardian_name,
            academic_year: profile.academic_year,
          },
          class: cls ? { id: cls.id, name: cls.name, code: cls.code } : null,
          class_teacher: classTeacher,
          subject_teachers: subjectTeachers,
          summary: {
            total_tasks: total,
            completed,
            pending: taskRows.filter((r) => r.status === 'pending').length,
            overdue: taskRows.filter((r) => r.status === 'overdue').length,
            graded: graded.length,
            completion_rate: total ? Math.round((completed / total) * 100) : 0,
            on_time_rate: completed ? Math.round((onTime / completed) * 100) : 0,
            average_percentage: avg,
          },
          subjects: Object.values(bySubject).map((s) => ({
            subject: s.subject,
            total: s.total,
            completed: s.completed,
            average_percentage: s.scores.length
              ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
              : null,
          })),
          tasks: taskRows,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  }

  // GET /api/parent/teachers
  async teachers(req, res) {
    try {
      const { classTeacher, subjectTeachers } = await loadTeachers(req.parent.profile.class_id);
      res.json({ success: true, data: { class_teacher: classTeacher, subject_teachers: subjectTeachers } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load teachers' });
    }
  }

  // POST /api/parent/feedback
  // No teacher_id -> class teacher. teacher_id given -> must be a subject teacher (or the
  // class teacher) of the child's class; anything else is rejected, never silently saved.
  async sendFeedback(req, res) {
    try {
      const { error, value } = feedbackSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { student, profile } = req.parent;
      const { classTeacher, subjectTeachers } = await loadTeachers(profile.class_id);

      let teacherId;
      let subjectId = null;
      let recipientType = 'class_teacher';

      if (!value.teacher_id) {
        if (!classTeacher) {
          return res.status(422).json({ success: false, message: 'No class teacher is assigned to this class.' });
        }
        teacherId = classTeacher.teacher_id;
      } else if (classTeacher && value.teacher_id === classTeacher.teacher_id && !value.subject_id) {
        teacherId = classTeacher.teacher_id;
      } else {
        const match = subjectTeachers.find((s) =>
          s.teacher_id === value.teacher_id && (!value.subject_id || s.subject_id === value.subject_id));
        if (!match) {
          return res.status(403).json({ success: false, message: 'That teacher does not teach this student.' });
        }
        teacherId = match.teacher_id;
        subjectId = match.subject_id;
        recipientType = 'subject_teacher';
      }

      const feedback = await Feedback.create({
        student_user_id: student.id,
        student_code: profile.student_id,
        teacher_id: teacherId,
        class_id: profile.class_id,
        subject_id: subjectId,
        organization_id: student.organization_id,
        recipient_type: recipientType,
        parent_name: value.parent_name || profile.guardian_name || null,
        parent_phone: profile.guardian_phone,
        title: value.title || null,
        message: value.message,
      });

      audit(req, {
        action: 'parent_feedback_sent', user_id: student.id, organization_id: student.organization_id,
        resource_id: feedback.id, description: `Parent feedback to teacher ${teacherId}`,
      });

      const full = await Feedback.findByPk(feedback.id, {
        include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }],
      });
      res.status(201).json({ success: true, message: 'Message sent successfully', data: full });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to send feedback' });
    }
  }

  // GET /api/parent/feedback
  async myFeedback(req, res) {
    try {
      const rows = await Feedback.findAll({
        where: { student_user_id: req.parent.student.id },
        include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }],
        order: [['created_at', 'DESC']],
        limit: 50,
      });
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load feedback' });
    }
  }

  // GET /api/teachers/feedback & GET /api/parent/teacher-inbox (teacher side, uses the normal user token)
  async teacherInbox(req, res) {
    try {
      const rows = await Feedback.findAll({
        where: { teacher_id: req.user.id },
        include: [
          {
            model: User,
            as: 'student',
            attributes: ['id', 'name', 'email', 'phone'],
            include: [
              {
                model: StudentProfile,
                as: 'studentProfile',
                attributes: ['id', 'student_id', 'guardian_name', 'guardian_phone', 'class_id'],
              },
            ],
          },
          {
            model: StudentProfile,
            as: 'studentProfile',
            attributes: ['id', 'student_id', 'guardian_name', 'guardian_phone', 'class_id'],
          },
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
        ],
        order: [['created_at', 'DESC']],
      });

      const data = rows.map((row) => {
        const plain = row.toJSON();
        const profile = plain.studentProfile || plain.student?.studentProfile || null;
        const guardianPhone = profile?.guardian_phone || plain.parent_phone || plain.student?.phone || null;
        const guardianName = profile?.guardian_name || plain.parent_name || null;

        return {
          ...plain,
          studentProfile: profile,
          student_name: plain.student?.name || null,
          student_code: plain.student_code || profile?.student_id || null,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          parent_name: plain.parent_name || guardianName,
          parent_phone: plain.parent_phone || guardianPhone,
        };
      });

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load feedback', error: error.message });
    }
  }

  // PATCH /api/parent/teacher-inbox/:id/read
  async markRead(req, res) {
    try {
      const row = await Feedback.findOne({ where: { id: req.params.id, teacher_id: req.user.id } });
      if (!row) return res.status(404).json({ success: false, message: 'Feedback not found' });
      await row.update({ status: 'read', read_at: new Date() });
      res.json({ success: true, data: row });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update feedback' });
    }
  }
}

export default new ParentController();
