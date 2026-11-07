import { Organization, ApprovalRequest, Payment, User, District, sequelize } from '../database.js';
import { Op } from 'sequelize';
import EmailService from '../services/EmailService.js';

class DistrictController {
  // Get pending organizations for approval
  async getPendingOrganizations(req, res) {
    try {
      const organizations = await Organization.findAll({
        where: {
          district_id: req.admin.district_id,
          status: 'pending'
        },
        include: [
          {
            model: ApprovalRequest,
            as: 'approvalRequest',
            required: false
          },
          {
            model: Payment,
            as: 'payments',
            required: false,
            order: [['created_at', 'DESC']],
            limit: 1
          }
        ],
        order: [['created_at', 'ASC']]
      });

      res.json({
        success: true,
        data: organizations,
        count: organizations.length
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending organizations',
        error: error.message
      });
    }
  }

  // Get all organizations in district
  async getDistrictOrganizations(req, res) {
    try {
      const { status, type, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {
        district_id: req.admin.district_id
      };

      if (status) whereClause.status = status;
      if (type) whereClause.type = type;

      const { count, rows: organizations } = await Organization.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'users',
            attributes: ['id', 'name', 'role', 'status'],
            required: false
          },
          {
            model: Payment,
            as: 'payments',
            required: false,
            order: [['created_at', 'DESC']],
            limit: 1
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: organizations,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: error.message
      });
    }
  }

  // Approve organization
  async approveOrganization(req, res) {
    try {
      const { id } = req.params;
      const { approval_notes, conditions } = req.body;

      const organization = await Organization.findOne({
        where: {
          id,
          district_id: req.admin.district_id,
          status: 'pending'
        }
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found or already processed'
        });
      }

      // Generate organization code using district code (e.g., GASA-8821)
      const district = await District.findByPk(organization.district_id);
      const code = generateOrganizationCode(district?.code || 'RW');

      // Update organization
      await organization.update({
        status: 'approved',
        code,
        approved_by: req.admin.id,
        approved_at: new Date()
      });

      // Update approval request
      await ApprovalRequest.update({
        status: 'approved',
        reviewed_by: req.admin.id,
        reviewed_at: new Date(),
        approval_notes,
        conditions
      }, {
        where: { organization_id: id }
      });

      // Set subscription — use existing payment or default to 1 year from now
      const latestPayment = await Payment.findOne({
        where: { organization_id: id, status: 'completed' },
        order: [['created_at', 'DESC']]
      });

      const subscriptionEnd = latestPayment
        ? calculateSubscriptionEnd(latestPayment.subscription_type, latestPayment.payment_date)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // default 1 year

      await organization.update({
        payment_status: 'paid',
        subscription_expires: subscriptionEnd
      });

      // Create org admin user if none exists
      const existingAdmin = await User.findOne({
        where: { organization_id: id, role: 'organization_admin' }
      });

      let orgAdminCredentials = null;
      if (!existingAdmin) {
        const tempPassword = `Org@${Math.floor(1000 + Math.random() * 9000)}`;
        await User.create({
          name: `${organization.name} Admin`,
          email: organization.contact_email,
          password: tempPassword,
          role: 'organization_admin',
          organization_id: organization.id,
          status: 'active'
        });
        orgAdminCredentials = { email: organization.contact_email, password: tempPassword };
      }

      // Send approval email with code and login credentials
      try {
        await EmailService.sendOrganizationApproved(organization, code, orgAdminCredentials);
      } catch (emailErr) {
        console.error('Email send failed (non-fatal):', emailErr.message);
      }

      return res.json({
        success: true,
        message: 'Organization approved successfully',
        data: {
          organization_code: code,
          organization,
          login_credentials: orgAdminCredentials
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to approve organization',
        error: error.message
      });
    }
  }

  // Reject organization
  async rejectOrganization(req, res) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;

      const organization = await Organization.findOne({
        where: {
          id,
          district_id: req.admin.district_id,
          status: 'pending'
        }
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found or already processed'
        });
      }

      // Update organization
      await organization.update({
        status: 'rejected',
        rejection_reason,
        approved_by: req.admin.id,
        approved_at: new Date()
      });

      // Update approval request
      await ApprovalRequest.update({
        status: 'rejected',
        reviewed_by: req.admin.id,
        reviewed_at: new Date(),
        rejection_reason
      }, {
        where: { organization_id: id }
      });

      return res.json({ success: true, message: 'Organization rejected successfully' });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to reject organization',
        error: error.message
      });
    }
  }

  // Get district statistics
  async getDistrictStats(req, res) {
    try {
      const districtId = req.admin.district_id;

      const [total, byStatus, byType, totalUsers, paymentStats] = await Promise.all([
        Organization.count({ where: { district_id: districtId } }),

        Organization.findAll({
          where: { district_id: districtId },
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('Organization.id')), 'count']],
          group: ['status'],
          raw: true
        }),

        Organization.findAll({
          where: { district_id: districtId },
          attributes: ['type', [sequelize.fn('COUNT', sequelize.col('Organization.id')), 'count']],
          group: ['type'],
          raw: true
        }),

        User.count({
          include: [{ model: Organization, as: 'organization', where: { district_id: districtId }, attributes: [] }]
        }),

        Payment.findAll({
          include: [{ model: Organization, as: 'organization', where: { district_id: districtId }, attributes: [] }],
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('Payment.id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('Payment.amount')), 'total_amount']
          ],
          group: ['Payment.status'],
          raw: true
        })
      ]);

      res.json({
        success: true,
        data: {
          total_organizations:    total,
          organizations_by_status: byStatus,
          organizations_by_type:   byType,
          total_users:             totalUsers,
          payment_stats:           paymentStats
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch district statistics', error: error.message });
    }
  }

  // Suspend organization
  async suspendOrganization(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const organization = await Organization.findOne({
        where: {
          id,
          district_id: req.admin.district_id,
          status: { [Op.in]: ['approved', 'suspended'] }
        }
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const newStatus = organization.status === 'suspended' ? 'approved' : 'suspended';
      
      await organization.update({
        status: newStatus,
        rejection_reason: newStatus === 'suspended' ? reason : null
      });

      res.json({
        success: true,
        message: `Organization ${newStatus === 'suspended' ? 'suspended' : 'reactivated'} successfully`
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update organization status',
        error: error.message
      });
    }
  }
}

// Helper functions
function generateOrganizationCode(districtCode = 'RW') {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${districtCode.substring(0, 4).toUpperCase()}-${num}`;
}

function calculateSubscriptionEnd(subscriptionType, paymentDate) {
  const startDate = new Date(paymentDate);
  
  switch (subscriptionType) {
    case 'monthly':
      return new Date(startDate.setMonth(startDate.getMonth() + 1));
    case 'quarterly':
      return new Date(startDate.setMonth(startDate.getMonth() + 3));
    case 'yearly':
      return new Date(startDate.setFullYear(startDate.getFullYear() + 1));
    default:
      return new Date(startDate.setMonth(startDate.getMonth() + 1));
  }
}

export default new DistrictController();