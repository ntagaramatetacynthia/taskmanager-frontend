import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, DistrictAdmin, Organization, StudentProfile, EmployeeProfile, District } from '../database.js';

class AuthController {
  constructor() {
    this.districtAdminLogin = this.districtAdminLogin.bind(this);
    this.userLogin = this.userLogin.bind(this);
    this.organizationCodeLogin = this.organizationCodeLogin.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.logout = this.logout.bind(this);
    this.changePassword = this.changePassword.bind(this);
  }

  // Generate JWT token
  generateToken(user, type = 'user') {
    return jwt.sign(
      { 
        id: user.id, 
        type,
        organization_id: type === 'user' ? user.organization_id : null,
        district_id: type === 'district_admin' ? user.district_id : null
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  // District Admin Login
  async districtAdminLogin(req, res) {
    try {
      const { email, password } = req.body;

      const admin = await DistrictAdmin.findOne({
        where: { email },
        include: [{ model: District, as: 'district' }]
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (admin.locked_until && admin.locked_until > new Date()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to multiple failed attempts'
        });
      }

      const isValidPassword = await admin.validatePassword(password);

      if (!isValidPassword) {
        await admin.incrementLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Reset login attempts on successful login
      await admin.update({
        login_attempts: 0,
        locked_until: null,
        last_login: new Date()
      });

      const token = this.generateToken(admin, 'district_admin');

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            type: 'district_admin',
            district: admin.district
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  // Regular User Login
  async userLogin(req, res) {
    try {
      const { email, password } = req.body;

      // The same email can appear on more than one row: registering an organization
      // creates one admin account per organization, so a repeated registration with
      // the same contact email leaves a second (placeholder) row behind. findOne()
      // always returned the oldest row, so the correct password for the other row was
      // reported as "Invalid credentials". Load every row for the email and use the
      // one whose password actually matches.
      const candidates = await User.findAll({
        where: { email },
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ],
        order: [['id', 'ASC']]
      });

      if (!candidates.length) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (candidates.length > 1) {
        console.warn(
          `[auth] ${candidates.length} accounts share the email ${email} ` +
          `(ids: ${candidates.map(candidate => candidate.id).join(', ')}); ` +
          'the account whose password matches will be used.'
        );
      }

      // Try live, approved accounts before stale placeholder rows so a leftover row
      // can never shadow the real one.
      const rank = (candidate) => {
        let score = 0;
        if (candidate.status === 'pending') score += 4;
        if (!candidate.organization) score += 2;
        else if (candidate.organization.status !== 'approved') score += 1;
        return score;
      };
      const ordered = [...candidates].sort((a, b) => rank(a) - rank(b));

      // Match the password first: that is what identifies the intended account.
      let user = null;
      for (const candidate of ordered) {
        if (await candidate.validatePassword(password)) {
          user = candidate;
          break;
        }
      }

      if (!user) {
        // Record the failure on every row holding this email so brute-force
        // protection still applies whichever account is being targeted.
        await Promise.all(ordered.map(candidate => candidate.incrementLoginAttempts()));
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.locked_until && user.locked_until > new Date()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to multiple failed attempts'
        });
      }

      if (!user.organization) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check organization status (allow org_admin even if pending)
      if (user.role !== 'organization_admin' && user.organization.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Organization not approved yet'
        });
      }

      // Reset login attempts on successful login
      await user.update({
        login_attempts: 0,
        locked_until: null,
        last_login: new Date()
      });

      const token = this.generateToken(user);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization,
            profile: user.studentProfile || user.employeeProfile
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  // Organization Code Login (for students/interns)
  async organizationCodeLogin(req, res) {
    try {
      const { organization_code, student_id, password } = req.body;

      // Find all approved orgs sharing this district-year code
      const organizations = await Organization.findAll({
        where: { code: organization_code.toUpperCase(), status: 'approved' }
      });

      if (!organizations.length) {
        return res.status(404).json({ success: false, message: 'Invalid organization code' });
      }

      const orgIds = organizations.map(o => o.id);

      // Find the student/employee across all orgs with this code
      const user = await User.findOne({
        include: [
          {
            model: StudentProfile,
            as: 'studentProfile',
            where: { student_id },
            required: false
          },
          {
            model: EmployeeProfile,
            as: 'employeeProfile',
            where: { employee_id: student_id },
            required: false
          },
          { model: Organization, as: 'organization' }
        ],
        where: { organization_id: { [Op.in]: orgIds } }
      });

      if (!user || (!user.studentProfile && !user.employeeProfile)) {
        return res.status(404).json({ success: false, message: 'Student/Employee ID not found' });
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        await user.incrementLoginAttempts();
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }

      await user.update({ login_attempts: 0, locked_until: null, last_login: new Date() });

      const token = this.generateToken(user);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id:           user.id,
            name:         user.name,
            email:        user.email,
            role:         user.role,
            organization: user.organization,
            profile:      user.studentProfile || user.employeeProfile
          }
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      if (req.userType === 'district_admin') {
        const admin = await DistrictAdmin.findByPk(req.admin.id, {
          include: [{ model: District, as: 'district' }],
          attributes: { exclude: ['password'] }
        });

        res.json({
          success: true,
          data: {
            user: admin,
            type: 'district_admin'
          }
        });
      } else {
        const user = await User.findByPk(req.user.id, {
          include: [
            { model: Organization, as: 'organization' },
            { model: StudentProfile, as: 'studentProfile' },
            { model: EmployeeProfile, as: 'employeeProfile' }
          ],
          attributes: { exclude: ['password'] }
        });

        res.json({
          success: true,
          data: {
            user,
            type: 'user'
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get profile',
        error: error.message
      });
    }
  }

  // Update current user profile
  async updateProfile(req, res) {
    try {
      const { name, phone, guardian_name, guardian_phone, department, position } = req.body;

      if (req.userType === 'district_admin') {
        const admin = await DistrictAdmin.findByPk(req.admin.id);
        if (!admin) return res.status(404).json({ success: false, message: 'Profile not found' });

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        await admin.update(updates);

        const refreshed = await DistrictAdmin.findByPk(req.admin.id, {
          include: [{ model: District, as: 'district' }],
          attributes: { exclude: ['password'] }
        });

        return res.json({
          success: true,
          message: 'Profile updated successfully',
          data: { user: refreshed, type: 'district_admin' }
        });
      }

      const user = await User.findByPk(req.user.id, {
        include: [
          { model: StudentProfile, as: 'studentProfile' },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ]
      });

      if (!user) return res.status(404).json({ success: false, message: 'Profile not found' });

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (phone !== undefined) updates.phone = phone;
      await user.update(updates);

      if (user.studentProfile) {
        const spUpdates = {};
        if (guardian_name !== undefined) spUpdates.guardian_name = guardian_name;
        if (guardian_phone !== undefined) spUpdates.guardian_phone = guardian_phone;
        if (Object.keys(spUpdates).length > 0) await user.studentProfile.update(spUpdates);
      }

      if (user.employeeProfile) {
        const epUpdates = {};
        if (department !== undefined) epUpdates.department = department;
        if (position !== undefined) epUpdates.position = position;
        if (Object.keys(epUpdates).length > 0) await user.employeeProfile.update(epUpdates);
      }

      const refreshed = await User.findByPk(req.user.id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: EmployeeProfile, as: 'employeeProfile' }
        ],
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: refreshed, type: 'user' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }

  // Logout (invalidate token - in a real app, you'd maintain a blacklist)
  async logout(req, res) {
    try {
      // In a production app, you would add the token to a blacklist
      // For now, we'll just return success
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      
      const userModel = req.userType === 'district_admin' ? DistrictAdmin : User;
      const userId = req.userType === 'district_admin' ? req.admin.id : req.user.id;
      
      const user = await userModel.findByPk(userId);
      
      const isValidPassword = await user.validatePassword(current_password);
      
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      await user.update({ password: new_password });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message
      });
    }
  }
}

export default new AuthController();