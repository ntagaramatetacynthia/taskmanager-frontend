import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import fs from 'fs';
import sequelize, { User, StudentProfile, EmployeeProfile, Organization, Class, Submission, Reminder } from '../database.js';
import { Op } from 'sequelize';
import Feedback from '../parent/Feedback.js';
import ParentLink from '../parent/ParentLink.js';
import FocusSession from '../focus/FocusSession.js';

// Generate unique student ID: ST-xxxx (4-digit sequential)
async function generateStudentId() {
  // Get all existing student IDs that match the pattern
  const profiles = await StudentProfile.findAll({
    attributes: ['student_id'],
    where: {
      student_id: { [Op.like]: 'ST-%' }
    }
  });


  // Extract numbers and find max
  let maxNum = 0;
  profiles.forEach(profile => {
    const match = profile.student_id.match(/^ST-(\d{4})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  // Next number
  const nextNum = maxNum + 1;
  const newId = `ST-${nextNum.toString().padStart(4, '0')}`;

  // Check if exists (to handle race conditions)
  const existing = await StudentProfile.findOne({ where: { student_id: newId } });
  if (existing) {
    // If collision, recurse (though unlikely with sequential)
    return await generateStudentId();
  }

  return newId;
}

class UserController {
  // Create user (teacher/worker/student) by Org Admin or Teacher (for students)
  async createUser(req, res) {
    try {
      const { name, email, password, phone, role, employee_id, position, department, employment_type } = req.body;
      const organization_id = req.user.organization_id;

      // Teachers can only create students/interns
      if (req.user.role === 'teacher' && !['student', 'intern'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Teachers can only create student accounts' });
      }

      const organization = await Organization.findByPk(organization_id);
      // if (!organization.canAddUsers()) {
      //   return res.status(403).json({ success: false, message: 'User limit reached for this organization' });
      // }

      const normalizedEmail = email ? email.trim().toLowerCase() : '';
      const existing = await User.findOne({ where: { email: normalizedEmail, organization_id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already exists in this organization' });
      }

      const cleanedPhone = phone && phone.trim() ? phone.trim() : null;

      const user = await User.create({
        name: name ? name.trim() : '',
        email: normalizedEmail,
        password,
        phone: cleanedPhone,
        role,
        organization_id,
        status: 'active',
        created_by: req.user.id
      });

      if (['teacher', 'worker'].includes(role)) {
        const empId = employee_id || `EMP-${organization_id}-${user.id}`;
        await EmployeeProfile.create({
          user_id: user.id,
          employee_id: empId,
          position: position || role,
          department: department || 'General',
          employment_type: employment_type || 'full_time'
        });
      } else if (['student', 'intern'].includes(role)) {
        // Generate student ID
        let studentId;
        try {
          studentId = await generateStudentId();
        } catch (error) {
          return res.status(500).json({ success: false, message: 'Failed to generate student ID', error: error.message });
        }

        let classId = req.body.class_id;
        if (classId) {
          // Validate class exists and belongs to org
          const cls = await Class.findOne({ where: { id: classId, organization_id } });
          if (!cls) {
            return res.status(400).json({ success: false, message: 'Invalid class' });
          }
          // Check if class has space
          if (cls.current_students >= cls.max_students) {
            return res.status(400).json({ success: false, message: 'Class is full' });
          }
        }

        await StudentProfile.create({
          user_id: user.id,
          student_id: studentId,
          class_id: classId || null,
          status: 'active'
        });

        // Increment class current_students if assigned
        if (classId) {
          await Class.increment('current_students', { where: { id: classId } });
        }
      }

      await organization.increment('current_users');

      const created = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] },
        include: [
          { model: EmployeeProfile, as: 'employeeProfile' },
          { model: StudentProfile, as: 'studentProfile' }
        ]
      });

      res.status(201).json({ success: true, message: 'User created successfully', data: created });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
    }
  }

  // Student self-signup via org code + student ID
  async studentSignup(req, res) {
    try {
      const { organization_code, student_id, name, email, password, phone } = req.body;

      const organization = await Organization.findOne({
        where: { code: organization_code, status: 'approved' }
      });

      if (!organization) {
        return res.status(404).json({ success: false, message: 'Invalid organization code' });
      }

      if (!organization.isSubscriptionActive()) {
        return res.status(403).json({ success: false, message: 'Organization subscription expired' });
      }

      // Check if student ID is pre-loaded (pending user with this student_id)
      const preloaded = await StudentProfile.findOne({
        where: { student_id },
        include: [{
          model: User,
          as: 'user',
          where: { organization_id: organization.id, status: 'pending' }
        }]
      });

      if (!preloaded) {
        return res.status(404).json({
          success: false,
          message: 'Student ID not found. Please contact your organization admin.'
        });
      }

      const existingEmail = await User.findOne({ where: { email, organization_id: organization.id } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      // Activate the pre-loaded user
      await preloaded.user.update({ name, email, password, phone, status: 'active' });

      const user = await User.findByPk(preloaded.user.id, {
        attributes: { exclude: ['password'] },
        include: [
          { model: StudentProfile, as: 'studentProfile', include: [{ model: Class, as: 'class' }] },
          { model: Organization, as: 'organization' }
        ]
      });

      res.status(200).json({
        success: true,
        message: 'Account activated successfully. You can now log in.',
        data: user
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Signup failed', error: error.message });
    }
  }

  // Bulk import users (JSON payload OR legacy Excel upload)
  async bulkImport(req, res) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const normalizeKeysToLowercase = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[String(k).toLowerCase()] = v;
      }
      return out;
    };

    const trimStringsDeep = (val) => {
      if (typeof val === 'string') return val.trim();
      return val;
    };

    const normalizeRowToContract = (rawRow) => {
      const lowered = normalizeKeysToLowercase(rawRow);

      // Accept common header variants for each field.
      const id =
        lowered.id ??
        lowered.user_id ??
        lowered.userid ??
        lowered['user id'] ??
        lowered.student_id ??
        lowered.studentid ??
        lowered.student_id_ ??
        lowered['student id'] ??
        lowered.employee_id ??
        lowered.employeeid ??
        lowered['employee id'] ??
        null;

      const name = lowered.name ?? lowered.full_name ?? lowered['full name'] ?? null;
      const email =
        lowered.email ??
        lowered['e-mail'] ??
        lowered['email address'] ??
        lowered.mail ??
        null;

      const role =
        lowered.role ??
        lowered.user_role ??
        lowered['user role'] ??
        lowered.type ??
        null;

      return { id, name, email, role };
    };

    const sanitizeContract = (contract) => {
      const c = { ...contract };
      c.id = trimStringsDeep(c.id);
      c.name = trimStringsDeep(c.name);
      c.email = trimStringsDeep(c.email);
      if (typeof c.role === 'string') c.role = c.role.trim().toLowerCase();
      return c;
    };

    const validateContract = (u) => {
      const errors = [];
      const role = u.role;

      // id is NOT required for user creation in our model (DB auto-increment).
      // It’s only accepted for backward compatibility with older import templates.
      if (typeof u.id !== 'undefined' && u.id !== null && typeof u.id !== 'string') {
        errors.push('id must be a string');
      }

      if (typeof u.name !== 'string' || u.name.length === 0) errors.push('name must be a non-empty string');
      if (typeof role !== 'string' || role.length === 0) errors.push('role must be a non-empty string');
      if (typeof u.email !== 'string' || u.email.length === 0) errors.push('email must be a non-empty string');
      if (typeof u.email === 'string' && !emailRegex.test(u.email)) errors.push('email must be a valid email');

      const allowedRoles = ['organization_admin', 'teacher', 'student', 'worker', 'intern'];
      if (typeof role === 'string' && !allowedRoles.includes(role)) errors.push('role is invalid');

      return errors;
    };

    const upsertUserByEmail = async (contract) => {
      const organization_id = req.user.organization_id;

      const [user] = await Promise.all([
        User.findOne({ where: { organization_id, email: contract.email } })
      ]);

      if (user) {
        await user.update({
          name: contract.name,
          role: contract.role,
          status: 'active'
        });
        return { imported: false, user };
      }

      const created = await User.create({
        name: contract.name,
        email: contract.email,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role: contract.role,
        organization_id,
        status: 'active',
        created_by: req.user.id
      });

      return { imported: true, user: created };
    };

    try {
      // JSON input: { users: [...] }
      if (req.body && req.body.users) {
        const rawUsers = req.body.users;
        if (!Array.isArray(rawUsers)) {
          return res.status(400).json({ success: false, message: 'Invalid payload: users must be an array' });
        }

        let imported = 0;
        let failed = 0;

        for (let i = 0; i < rawUsers.length; i++) {
          const contract = sanitizeContract(normalizeRowToContract(rawUsers[i]));
          const errors = validateContract(contract);
          if (errors.length) {
            failed++;
            continue;
          }

          const result = await upsertUserByEmail(contract);
          if (result.imported) imported++;
        }

        return res.json({
          success: true,
          imported,
          failed,
          message: 'Bulk import completed successfully'
        });
      }

      // Legacy multipart/form-data input: Excel file in req.file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request format: provide application/json { users: [...] } or upload an Excel file'
        });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: 'File is empty' });
      }

      let imported = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const contract = sanitizeContract(normalizeRowToContract(row));
          const errors = validateContract(contract);
          if (errors.length) {
            failed++;
            continue;
          }

          const result = await upsertUserByEmail(contract);
          if (result.imported) imported++;
        } catch (_e) {
          failed++;
        }
      }

      fs.unlinkSync(req.file.path);

      return res.json({
        success: true,
        imported,
        failed,
        message: 'Bulk import completed successfully'
      });
    } catch (error) {
      // Cleanup best-effort if a file exists
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(500).json({ success: false, message: error?.message || 'Import failed' });
    }
  }

  // Get all users in organization
  async getUsers(req, res) {
    try {
      const { role, status, page = 1, limit = 20, search } = req.query;
      const offset = (page - 1) * limit;

      const where = { organization_id: req.user.organization_id };
      if (role) where.role = role;
      if (status) where.status = status;
      if (search) where.name = { [Op.like]: `%${search}%` };

      const { count, rows } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        include: [
          { model: StudentProfile, as: 'studentProfile', required: false },
          { model: EmployeeProfile, as: 'employeeProfile', required: false }
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
      res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
    }
  }

  // Get single user
  async getUser(req, res) {
    try {
      const user = await User.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id },
        attributes: { exclude: ['password'] },
        include: [
          { model: StudentProfile, as: 'studentProfile', include: [{ model: Class, as: 'class' }] },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ]
      });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
    }
  }

  // Update user and associated StudentProfile / EmployeeProfile
  async updateUser(req, res) {
    try {
      const {
        name,
        email,
        phone,
        status,
        role,
        guardian_name,
        guardian_phone,
        class_id,
        department,
        position,
        employment_type
      } = req.body;

      const user = await User.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id },
        include: [
          { model: StudentProfile, as: 'studentProfile' },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ]
      });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const userUpdates = {};
      if (name !== undefined) userUpdates.name = name;
      if (email !== undefined) userUpdates.email = email;
      if (phone !== undefined) userUpdates.phone = phone;
      if (status !== undefined) userUpdates.status = status;
      if (role !== undefined) userUpdates.role = role;

      await user.update(userUpdates);

      // Update StudentProfile if present or applicable
      if (user.studentProfile) {
        const studentUpdates = {};
        if (guardian_name !== undefined) studentUpdates.guardian_name = guardian_name || null;
        if (guardian_phone !== undefined) studentUpdates.guardian_phone = guardian_phone || null;
        if (class_id !== undefined) studentUpdates.class_id = class_id ? Number(class_id) : null;
        if (status !== undefined && ['active', 'inactive', 'graduated', 'dropped'].includes(status)) {
          studentUpdates.status = status;
        }
        if (Object.keys(studentUpdates).length > 0) {
          await user.studentProfile.update(studentUpdates);
        }
      }

      // Update EmployeeProfile if present or applicable
      if (user.employeeProfile) {
        const empUpdates = {};
        if (department !== undefined) empUpdates.department = department;
        if (position !== undefined) empUpdates.position = position;
        if (employment_type !== undefined) empUpdates.employment_type = employment_type;
        if (status !== undefined && ['active', 'inactive', 'on_leave', 'terminated'].includes(status)) {
          empUpdates.status = status;
        }
        if (Object.keys(empUpdates).length > 0) {
          await user.employeeProfile.update(empUpdates);
        }
      }

      const updatedUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] },
        include: [
          { model: StudentProfile, as: 'studentProfile', include: [{ model: Class, as: 'class' }] },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ]
      });

      res.json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
    }
  }

  // Delete user / student safely by unique Primary Key (id)
  async deleteUser(req, res) {
    const rawId = req.params.id;
    const targetId = parseInt(rawId, 10);

    if (isNaN(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID: "${rawId}". Expected a unique numeric primary key.`
      });
    }

    let t = null;
    try {
      const organization_id = req.user.organization_id;

      // 1. Locate User strictly by unique numeric primary key ID and organization
      let user = await User.findOne({
        where: { id: targetId, organization_id },
        include: [
          { model: StudentProfile, as: 'studentProfile', required: false },
          { model: EmployeeProfile, as: 'employeeProfile', required: false }
        ]
      });

      // Fallback: If not found by User.id, check if targetId was passed as StudentProfile.id
      if (!user) {
        const profile = await StudentProfile.findByPk(targetId, {
          include: [{ model: User, as: 'user', where: { organization_id } }]
        });
        if (profile && profile.user) {
          user = await User.findOne({
            where: { id: profile.user_id, organization_id },
            include: [
              { model: StudentProfile, as: 'studentProfile', required: false },
              { model: EmployeeProfile, as: 'employeeProfile', required: false }
            ]
          });
        }
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found in this organization' });
      }

      // 2. Authorization check: Teachers can only delete students/interns
      if (req.user.role === 'teacher' && !['student', 'intern'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Teachers are only authorized to delete student accounts'
        });
      }

      // 3. Start explicit database transaction
      t = await sequelize.transaction();

      // Clean up dependent child records FIRST on transaction t:
      if (user.studentProfile) {
        if (user.studentProfile.class_id) {
          await Class.decrement('current_students', {
            where: { id: user.studentProfile.class_id },
            transaction: t
          });
        }

        if (Submission && sequelize.models.Submission) {
          await Submission.destroy({
            where: { student_id: user.id },
            force: true,
            transaction: t
          });
        }

        if (Reminder && sequelize.models.Reminder) {
          await Reminder.destroy({
            where: { user_id: user.id },
            force: true,
            transaction: t
          });
        }

        if (FocusSession && sequelize.models.FocusSession) {
          await FocusSession.destroy({
            where: { student_id: user.id },
            force: true,
            transaction: t
          });
        }

        if (Feedback && sequelize.models.Feedback) {
          await Feedback.destroy({
            where: { student_user_id: user.id },
            force: true,
            transaction: t
          });
        }

        if (ParentLink && sequelize.models.ParentLink) {
          await ParentLink.destroy({
            where: {
              [Op.or]: [
                { student_user_id: user.id },
                { student_profile_id: user.studentProfile.id }
              ]
            },
            force: true,
            transaction: t
          });
        }

        // Delete the StudentProfile record
        await user.studentProfile.destroy({ force: true, transaction: t });
      }

      // Handle EmployeeProfile cleanup if applicable
      if (user.employeeProfile) {
        await user.employeeProfile.destroy({ force: true, transaction: t });
      }

      // Destroy the user record (force delete ensures duplicate records are completely purged)
      await user.destroy({ force: true, transaction: t });

      // Decrement organization user count
      await Organization.decrement('current_users', {
        where: { id: organization_id },
        transaction: t
      });

      // Commit transaction cleanly
      await t.commit();

      return res.json({
        success: true,
        message: `${user.role === 'student' ? 'Student' : 'User'} deleted successfully`,
        data: { id: user.id, name: user.name }
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
      console.error('Original transaction error in deleteUser:', error);

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
          message: 'Cannot delete user because related records exist in another table.'
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete user'
      });
    }
  }

  // Validate student ID before signup (public endpoint)
  async validateStudentId(req, res) {
    try {
      const { organization_code, student_id } = req.body;

      const organization = await Organization.findOne({
        where: { code: organization_code, status: 'approved' }
      });

      if (!organization) {
        return res.status(404).json({ success: false, message: 'Invalid organization code' });
      }

      const profile = await StudentProfile.findOne({
        where: { student_id },
        include: [{
          model: User,
          as: 'user',
          where: { organization_id: organization.id, status: 'pending' },
          attributes: ['id', 'name', 'role']
        }]
      });

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Student ID not found or already registered' });
      }

      res.json({
        success: true,
        message: 'Student ID verified',
        data: {
          organization: { id: organization.id, name: organization.name, type: organization.type },
          student: { name: profile.user.name, class_id: profile.class_id }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Validation failed', error: error.message });
    }
  }

  // Get notifications for current user (latest first)
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;

      const reminders = await (await import('../database.js')).Reminder.findAll({
        where: {
          user_id: userId,
          ...(req.query.status ? { status: req.query.status } : {})
        },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load notifications', error: error.message });
    }
  }

  // Mark a notification as read
  async markNotificationRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const reminder = await (await import('../database.js')).Reminder.findOne({
        where: { id, user_id: userId },
      });

      if (!reminder) return res.status(404).json({ success: false, message: 'Notification not found' });

      // If model has read_at/use is_read, set it; otherwise keep status-based flow.
      if (reminder.read_at !== undefined || Object.prototype.hasOwnProperty.call(reminder.dataValues || {}, 'read_at')) {
        await reminder.update({ read_at: new Date(), status: reminder.status === 'pending' ? 'sent' : reminder.status });
      } else if (reminder.is_read !== undefined || Object.prototype.hasOwnProperty.call(reminder.dataValues || {}, 'is_read')) {
        await reminder.update({ is_read: true, read_at: new Date() });
      } else {
        // Fallback: set status to sent (no real read tracking in DB yet)
        await reminder.update({ status: 'sent' });
      }

      res.json({ success: true, message: 'Notification marked as read', data: reminder });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to mark notification as read', error: error.message });
    }
  }

  // Student Dashboard - shows tasks, submissions, and notifications
  async getStudentDashboard(req, res) {
    try {
      const userId = req.user.id;
      const now = new Date();

      // Get student's profile and class
      const profile = await StudentProfile.findOne({
        where: { user_id: userId },
        include: [
          { model: Class, as: 'class', include: [{ model: Organization, as: 'organization' }] }
        ]
      });

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }

      console.log('Student profile found:', {
        userId,
        student_id: profile.student_id,
        class_id: profile.class_id,
        class_name: profile.class?.name
      });

      // Get assigned tasks for the student's class
      const { Task, Submission, Reminder } = await import('../database.js');

      const tasks = await Task.findAll({
        where: {
          class_id: profile.class_id,
          status: 'published'
        },
        include: [
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
          { model: User, as: 'creator', attributes: ['id', 'name'] }
        ],
        order: [['due_date', 'ASC']]
      });

      console.log('Tasks found for class:', {
        class_id: profile.class_id,
        taskCount: tasks.length,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, class_id: t.class_id }))
      });

      // Get student's submissions for these tasks
      const taskIds = tasks.map(t => t.id);
      const submissions = await Submission.findAll({
        where: { task_id: { [Op.in]: taskIds }, student_id: userId },
        attributes: ['task_id', 'status', 'score', 'submitted_at', 'is_late', 'feedback']
      });

      // Create submission map
      const submissionMap = {};
      submissions.forEach(sub => {
        submissionMap[sub.task_id] = sub;
      });

      // Attach submission status to tasks
      const tasksWithSubmissions = tasks.map(task => ({
        ...task.toJSON(),
        my_submission: submissionMap[task.id] || null,
        days_until_due: Math.ceil((new Date(task.due_date) - now) / (1000 * 60 * 60 * 24)),
        is_overdue: new Date(task.due_date) < now,
        needs_submission: !submissionMap[task.id] || submissionMap[task.id].status === 'draft'
      }));

      // Get recent reminders (last 7 days)
      const recentReminders = await Reminder.findAll({
        where: {
          user_id: userId,
          created_at: { [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        },
        include: [{ model: Task, as: 'task', attributes: ['id', 'title', 'due_date'] }],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      // Calculate dashboard stats
      const totalTasks = tasksWithSubmissions.length;
      const submittedTasks = tasksWithSubmissions.filter(t => t.my_submission && t.my_submission.status !== 'draft').length;
      const overdueTasks = tasksWithSubmissions.filter(t => t.is_overdue && t.needs_submission).length;
      const dueSoonTasks = tasksWithSubmissions.filter(t => !t.is_overdue && t.days_until_due <= 3 && t.needs_submission).length;

      res.json({
        success: true,
        data: {
          profile: {
            student_id: profile.student_id,
            class: profile.class,
            organization: profile.class.organization
          },
          tasks: tasksWithSubmissions,
          stats: {
            total_tasks: totalTasks,
            submitted_tasks: submittedTasks,
            overdue_tasks: overdueTasks,
            due_soon_tasks: dueSoonTasks,
            completion_rate: totalTasks > 0 ? Math.round((submittedTasks / totalTasks) * 100) : 0
          },
          recent_reminders: recentReminders,
          upcoming_deadlines: tasksWithSubmissions
            .filter(t => !t.is_overdue && t.needs_submission)
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
            .slice(0, 5)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load dashboard', error: error.message });
    }
  }
}

export default new UserController();
