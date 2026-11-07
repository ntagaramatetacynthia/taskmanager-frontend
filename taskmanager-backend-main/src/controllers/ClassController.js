import { Class, Subject, User, StudentProfile, Organization, District, Task, Submission, Reminder } from '../database.js';
import sequelize from '../database.js';
import { Op } from 'sequelize';
import Feedback from '../parent/Feedback.js';
import ParentLink from '../parent/ParentLink.js';
import FocusSession from '../focus/FocusSession.js';

// Build a clean uppercase slug from a string: "Kigali School" -> "KIGALISCHOOL"
function slugify(str) {
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
}

class ClassController {
  // Create class/department
  async createClass(req, res) {
    try {
      const { name, code: reqCode, description, manager_id, type, academic_year, semester, max_students } = req.body;
      const organization_id = req.user.organization_id;

      // Use the provided code if sent, otherwise fallback to the generated slug
      let code = reqCode ? reqCode.trim().toUpperCase() : null;
      if (!code) {
        // Load org + district to build the unique code
        const org = await Organization.findByPk(organization_id, {
          include: [{ model: (await import('../models/District.js')).default, as: 'district' }]
        });

        const districtCode = org?.district?.code || 'RW';
        const orgSlug      = slugify(org?.name || 'ORG');
        const year         = new Date().getFullYear();
        const classSlug    = slugify(name);
        code               = `${districtCode}-${orgSlug}-${year}-${classSlug}`.substring(0, 20);
      }

      // If manager_id provided, verify it — otherwise default to the creator
      let resolvedManagerId = req.user.id;
      if (manager_id) {
        const manager = await User.findOne({
          where: { id: manager_id, organization_id, role: { [Op.in]: ['teacher', 'organization_admin', 'worker'] } }
        });
        if (!manager) {
          return res.status(400).json({ success: false, message: 'Invalid manager. Must be a teacher or admin in this organization.' });
        }
        resolvedManagerId = manager_id;
      }

      const existing = await Class.findOne({ where: { code, organization_id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'A class with this code already exists.' });
      }

      const cls = await Class.create({
        name, code, description,
        manager_id: resolvedManagerId,
        type: type || 'class',
        academic_year: academic_year || null,
        semester: semester || '1',
        max_students: max_students || 50,
        organization_id
      });

      const created = await Class.findByPk(cls.id, {
        include: [{ model: User, as: 'manager', attributes: ['id', 'name', 'email', 'role'] }]
      });

      return res.status(201).json({ success: true, message: 'Class created successfully', data: created });
    } catch (error) {
      // 2. Log full error to the console for Render logs
      console.error('Error creating class:', error);

      // 3. If duplicate entry (ER_DUP_ENTRY / 23505 / SequelizeUniqueConstraintError), return 409
      const isDuplicate =
        error.code === 'ER_DUP_ENTRY' ||
        error.original?.code === 'ER_DUP_ENTRY' ||
        error.parent?.code === 'ER_DUP_ENTRY' ||
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === '23505' ||
        error.parent?.code === '23505';

      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: 'A class with this code already exists.'
        });
      }

      // 4. For all other errors, return a safe 500 JSON error message
      return res.status(500).json({
        success: false,
        message: 'An error occurred while creating the class. Please try again later.'
      });
    }
  }

  // Get all classes in organization
  async getClasses(req, res) {
    try {
      const { type, status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = { organization_id: req.user.organization_id };
      if (type) where.type = type;
      if (status) where.status = status;

      // Teachers only see their managed classes
      if (req.user.role === 'teacher') {
        where.manager_id = req.user.id;
      }

      // Students only see their enrolled class
      if (['student', 'intern'].includes(req.user.role)) {
        const profile = await StudentProfile.findOne({ where: { user_id: req.user.id } });
        if (profile) where.id = profile.class_id;
      }

      const { count, rows } = await Class.findAndCountAll({
        where,
        include: [
          { model: User, as: 'manager', attributes: ['id', 'name', 'email'] },
          { model: Subject, as: 'subjects', required: false, attributes: ['id', 'name', 'code'] }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch classes', error: error.message });
    }
  }

  // Get class details with students and tasks
  async getClass(req, res) {
    try {
      const cls = await Class.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id },
        include: [
          { model: User, as: 'manager', attributes: ['id', 'name', 'email'] },
          { model: Subject, as: 'subjects', include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }] },
          {
            model: StudentProfile, as: 'students',
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'status'] }]
          },
          {
            model: Task, as: 'tasks',
            where: { status: 'published' },
            required: false,
            attributes: ['id', 'title', 'due_date', 'priority', 'status', 'total_submissions']
          }
        ]
      });

      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      res.json({ success: true, data: cls });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch class', error: error.message });
    }
  }

  // Update class
  async updateClass(req, res) {
    try {
      const {
        name,
        code,
        type,
        description,
        manager_id,
        status,
        max_students,
        academic_year,
        semester,
        schedule
      } = req.body;

      const cls = await Class.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });

      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      if (manager_id) {
        const manager = await User.findOne({
          where: { id: manager_id, organization_id: req.user.organization_id }
        });
        if (!manager) return res.status(400).json({ success: false, message: 'Invalid manager' });
      }

      const updateFields = {};
      if (name !== undefined) updateFields.name = name;
      if (code !== undefined) updateFields.code = code;
      if (type !== undefined) updateFields.type = type;
      if (description !== undefined) updateFields.description = description;
      if (manager_id !== undefined) updateFields.manager_id = Number(manager_id);
      if (status !== undefined) updateFields.status = status;
      if (max_students !== undefined) updateFields.max_students = Number(max_students);
      if (academic_year !== undefined) updateFields.academic_year = academic_year;
      if (semester !== undefined) updateFields.semester = semester;
      if (schedule !== undefined) updateFields.schedule = schedule;

      await cls.update(updateFields);

      const updatedClass = await Class.findByPk(cls.id, {
        include: [{ model: User, as: 'manager', attributes: ['id', 'name', 'email'] }]
      });

      res.json({ success: true, message: 'Class updated successfully', data: updatedClass });
    } catch (error) {
      console.error('Error updating class:', error);

      const isDuplicate =
        error.code === 'ER_DUP_ENTRY' ||
        error.original?.code === 'ER_DUP_ENTRY' ||
        error.parent?.code === 'ER_DUP_ENTRY' ||
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === '23505' ||
        error.parent?.code === '23505';

      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: 'A class with this code already exists.'
        });
      }

      res.status(500).json({ success: false, message: 'An error occurred while updating the class. Please try again later.' });
    }
  }

  // Soft delete class
  async deleteClass(req, res) {
    try {
      const cls = await Class.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });

      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      await cls.destroy();
      res.json({ success: true, message: 'Class deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete class', error: error.message });
    }
  }

  // Create subject in a class
  async createSubject(req, res) {
    try {
      const { name, code, description, teacher_id, credits, hours_per_week, syllabus } = req.body;
      const class_id = req.params.id;

      const cls = await Class.findOne({
        where: { id: class_id, organization_id: req.user.organization_id }
      });
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      const teacher = await User.findOne({
        where: { id: teacher_id, organization_id: req.user.organization_id, role: 'teacher' }
      });
      if (!teacher) return res.status(400).json({ success: false, message: 'Invalid teacher' });

      const existing = await Subject.findOne({ where: { code, class_id } });
      if (existing) return res.status(409).json({ success: false, message: 'Subject code already exists in this class' });

      const subject = await Subject.create({
        name, code, description, class_id, teacher_id,
        credits: credits || 1,
        hours_per_week: hours_per_week || 1,
        syllabus
      });

      res.status(201).json({ success: true, message: 'Subject created successfully', data: subject });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create subject', error: error.message });
    }
  }

  // Add student to class
  async addStudent(req, res) {
    try {
      const { student_id } = req.body; // user id of the student
      const class_id = req.params.id;
      const organization_id = req.user.organization_id;

      const cls = await Class.findOne({ where: { id: class_id, organization_id } });
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      // Org admins can add to any class, teachers can add to any class in their org
      // No restriction on which teacher can add students

      const student = await User.findOne({
        where: { id: student_id, organization_id, role: { [Op.in]: ['student', 'intern'] } }
      });
      if (!student) return res.status(404).json({ success: false, message: 'Student not found in this organization' });

      const profile = await StudentProfile.findOne({ where: { user_id: student_id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' });

      if (profile.class_id === parseInt(class_id)) {
        return res.status(409).json({ success: false, message: 'Student is already in this class' });
      }

      const oldClassId = profile.class_id;
      await profile.update({ class_id: parseInt(class_id) });

      // Update student counts
      await Class.increment('current_students', { where: { id: class_id } });
      if (oldClassId) await Class.decrement('current_students', { where: { id: oldClassId } });

      res.json({ success: true, message: `${student.name} added to class` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to add student', error: error.message });
    }
  }

  // Remove student from class / delete duplicate student records
  async removeStudent(req, res) {
    const classIdRaw = req.params.id;
    const studentIdRaw = req.params.studentId;

    // 1. Verify IDs from req.params
    const class_id = parseInt(classIdRaw, 10);
    const student_id = parseInt(studentIdRaw, 10);

    if (isNaN(class_id) || class_id <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid class ID: "${classIdRaw}". Expected a positive numeric primary key.`
      });
    }

    if (isNaN(student_id) || student_id <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid student ID: "${studentIdRaw}". Expected a positive numeric primary key.`
      });
    }

    let t = null;
    try {
      const organization_id = req.user.organization_id;

      // Verify class exists and belongs to this organization
      const cls = await Class.findOne({ where: { id: class_id, organization_id } });
      if (!cls) {
        return res.status(404).json({ success: false, message: 'Class not found in this organization' });
      }

      // Check role authorization: allow teachers and admins in this organization
      if (req.user.role === 'teacher' && cls.organization_id !== organization_id) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Class does not belong to your organization' });
      }

      // Locate student profile by user_id OR profile primary key id
      let profile = await StudentProfile.findOne({
        where: {
          [Op.or]: [
            { user_id: student_id },
            { id: student_id }
          ],
          class_id
        }
      });

      // Fallback: check without class_id if already unlinked or in another class
      if (!profile) {
        profile = await StudentProfile.findOne({
          where: {
            [Op.or]: [
              { user_id: student_id },
              { id: student_id }
            ]
          }
        });
      }

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: `Student with ID ${student_id} was not found in class ${class_id}.`
        });
      }

      const targetUserId = profile.user_id;

      // 2. Start explicit database transaction
      t = await sequelize.transaction();

      // 3. Delete dependent child records FIRST on transaction t:
      if (Submission && sequelize.models.Submission) {
        await Submission.destroy({
          where: { student_id: targetUserId },
          force: true,
          transaction: t
        });
      }

      if (Reminder && sequelize.models.Reminder) {
        await Reminder.destroy({
          where: { user_id: targetUserId },
          force: true,
          transaction: t
        });
      }

      if (FocusSession && sequelize.models.FocusSession) {
        await FocusSession.destroy({
          where: { student_id: targetUserId },
          force: true,
          transaction: t
        });
      }

      if (Feedback && sequelize.models.Feedback) {
        await Feedback.destroy({
          where: { student_user_id: targetUserId },
          force: true,
          transaction: t
        });
      }

      if (ParentLink && sequelize.models.ParentLink) {
        await ParentLink.destroy({
          where: {
            [Op.or]: [
              { student_user_id: targetUserId },
              { student_profile_id: profile.id }
            ]
          },
          force: true,
          transaction: t
        });
      }

      // Decrement class current_students count
      if (profile.class_id) {
        await Class.decrement('current_students', {
          where: { id: profile.class_id },
          transaction: t
        });
      }

      // Delete the StudentProfile record
      await profile.destroy({ force: true, transaction: t });

      // Delete the User record if role is student or intern to cleanly remove duplicate account
      const user = await User.findByPk(targetUserId, { transaction: t });
      if (user && ['student', 'intern'].includes(user.role)) {
        await user.destroy({ force: true, transaction: t });
        await Organization.decrement('current_users', {
          where: { id: organization_id },
          transaction: t
        });
      }

      // Commit the transaction cleanly
      await t.commit();

      return res.json({
        success: true,
        message: 'Student removed successfully from class'
      });
    } catch (error) {
      // 1. Rollback IMMEDIATELY in the catch block to release connection and prevent 25P02 aborted transaction
      if (t && !t.finished) {
        try {
          await t.rollback();
        } catch (rollbackErr) {
          console.error('Error during transaction rollback:', rollbackErr);
        }
      }

      // 3. Console log the original error so Render logs display the root cause
      console.error('Original transaction error in removeStudent:', error);

      // 4. Return specific HTTP status codes and error JSON
      const isForeignKeyError =
        error.name === 'SequelizeForeignKeyConstraintError' ||
        error.parent?.code === 'ER_ROW_IS_REFERENCED_2' ||
        error.original?.code === 'ER_ROW_IS_REFERENCED_2' ||
        error.parent?.code === '23503' ||
        error.original?.code === '23503';

      if (isForeignKeyError) {
        return res.status(409).json({
          success: false,
          code: 'ER_ROW_IS_REFERENCED_2',
          message: 'Cannot delete student because related records exist in another table.'
        });
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'ER_DUP_ENTRY',
          message: 'Database constraint error: duplicate entry conflict.'
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove student from class'
      });
    }
  }

  // Get class performance stats
  async getClassStats(req, res) {
    try {
      const cls = await Class.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

      const [totalStudents, totalTasks, submissions] = await Promise.all([
        StudentProfile.count({ where: { class_id: cls.id } }),
        Task.count({ where: { class_id: cls.id, status: 'published' } }),
        Submission.findAll({
          include: [{ model: Task, as: 'task', where: { class_id: cls.id }, attributes: [] }],
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('Submission.id')), 'count']],
          group: ['status'],
          raw: true
        })
      ]);

      const submissionMap = {};
      submissions.forEach(s => { submissionMap[s.status] = parseInt(s.count); });

      res.json({
        success: true,
        data: {
          class: { id: cls.id, name: cls.name, code: cls.code },
          total_students: totalStudents,
          total_tasks: totalTasks,
          submissions: submissionMap,
          completion_rate: totalStudents && totalTasks
            ? Math.round(((submissionMap.submitted || 0) + (submissionMap.graded || 0)) / (totalStudents * totalTasks) * 100)
            : 0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch class stats', error: error.message });
    }
  }
}

export default new ClassController();
