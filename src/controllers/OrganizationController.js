import { Organization, District, Payment, ApprovalRequest, User, sequelize } from '../database.js';
import { Op } from 'sequelize';

// All 30 Rwanda districts — used to auto-create if not in DB yet
const RWANDA_DISTRICTS = [
  { id: 1,  name: 'Gasabo',     code: 'GSB' }, { id: 2,  name: 'Kicukiro',   code: 'KCK' },
  { id: 3,  name: 'Nyarugenge', code: 'NYR' }, { id: 4,  name: 'Bugesera',   code: 'BGS' },
  { id: 5,  name: 'Gatsibo',    code: 'GTS' }, { id: 6,  name: 'Kayonza',    code: 'KYZ' },
  { id: 7,  name: 'Kirehe',     code: 'KRH' }, { id: 8,  name: 'Ngoma',      code: 'NGM' },
  { id: 9,  name: 'Nyagatare',  code: 'NYG' }, { id: 10, name: 'Rwamagana',  code: 'RWM' },
  { id: 11, name: 'Burera',     code: 'BUR' }, { id: 12, name: 'Gakenke',    code: 'GKK' },
  { id: 13, name: 'Gicumbi',    code: 'GCM' }, { id: 14, name: 'Musanze',    code: 'MSZ' },
  { id: 15, name: 'Rulindo',    code: 'RLD' }, { id: 16, name: 'Gisagara',   code: 'GSG' },
  { id: 17, name: 'Huye',       code: 'HUY' }, { id: 18, name: 'Kamonyi',    code: 'KMN' },
  { id: 19, name: 'Muhanga',    code: 'MHG' }, { id: 20, name: 'Nyamagabe',  code: 'NYM' },
  { id: 21, name: 'Nyamasheke', code: 'NYS' }, { id: 22, name: 'Nyanza',     code: 'NYZ' },
  { id: 23, name: 'Nyaruguru',  code: 'NYU' }, { id: 24, name: 'Ruhango',    code: 'RHG' },
  { id: 25, name: 'Karongi',    code: 'KRG' }, { id: 26, name: 'Ngororero',  code: 'NGR' },
  { id: 27, name: 'Nyabihu',    code: 'NYB' }, { id: 28, name: 'Rubavu',     code: 'RBV' },
  { id: 29, name: 'Rusizi',     code: 'RSZ' }, { id: 30, name: 'Rutsiro',    code: 'RTS' },
];

// Ensure a district exists in DB (upsert by id)
async function ensureDistrict(districtId) {
  let district = await District.findByPk(districtId);
  if (!district) {
    const meta = RWANDA_DISTRICTS.find(d => d.id === parseInt(districtId));
    if (!meta) return null;
    [district] = await District.findOrCreate({
      where: { code: meta.code },
      defaults: { name: meta.name, code: meta.code, status: 'active' },
    });
  }
  return district;
}

class OrganizationController {

  // POST /api/organizations/register
  async register(req, res) {
    try {
      const { name, type, district_id, contact_email, contact_phone, address, subscription_type } = req.body;

      const district = await ensureDistrict(district_id);
      if (!district) {
        return res.status(400).json({ success: false, message: 'Invalid district selected.' });
      }

      const existing = await Organization.findOne({
        where: { name, district_id: district.id, status: { [Op.in]: ['pending', 'approved'] } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An organization with this name already exists in this district.' });
      }

      // Each registration creates an admin account for contact_email, so registering
      // twice with the same address produced two rows and made login ambiguous.
      // Refuse the duplicate before any organization or payment rows are written.
      const emailTaken = await User.findOne({ where: { email: contact_email } });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: 'An account already exists for this email. Sign in with it, or register using a different contact email.'
        });
      }

      const subType = subscription_type || 'monthly';
      const code    = await generateOrgCode(district.code);
      const subscriptionEnd = calculateSubscriptionEnd(subType, new Date());
      const amount  = getSubscriptionAmount(subType, type);

      // Auto-approve immediately after payment — district admin manages later
      const organization = await Organization.create({
        name, type,
        district_id:          district.id,
        contact_email,
        contact_phone:        contact_phone || null,
        address:              address       || null,
        subscription_type:    subType,
        status:               'approved',
        payment_status:       'paid',
        code,
        approved_at:          new Date(),
        subscription_expires: subscriptionEnd,
      });

      // Record payment as completed
      await Payment.create({
        organization_id:   organization.id,
        amount,
        currency:          'RWF',
        payment_method:    'mobile_money',
        status:            'completed',
        payment_date:      new Date(),
        due_date:          new Date(),
        subscription_type: subType,
        description:       `${subType} subscription for ${name}`,
        total_amount:      amount,
        invoice_number:    `INV-${Date.now()}`,
      });

      // Create org admin user (status pending until they set their password)
      await User.create({
        name:            `${name} Admin`,
        email:           contact_email,
        password:        Math.random().toString(36) + Date.now().toString(36),
        role:            'organization_admin',
        organization_id: organization.id,
        status:          'pending',
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful! Your organization is now active.',
        data: {
          organization: {
            id:       organization.id,
            name:     organization.name,
            type:     organization.type,
            status:   organization.status,
            code,
            district: district.name,
          },
          code,
          payment_amount: amount,
        },
      });

    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ success: false, message: 'Registration failed.', error: error.message });
    }
  }

  // GET /api/organizations/districts
  async getDistricts(req, res) {
    try {
      let districts = await District.findAll({
        where:      { status: 'active' },
        attributes: ['id', 'name', 'code'],
        order:      [['name', 'ASC']],
      });

      // If DB is empty, return static list
      if (districts.length === 0) {
        districts = RWANDA_DISTRICTS.map(d => ({ id: d.id, name: d.name, code: d.code }));
      }

      return res.json({ success: true, data: districts });
    } catch (error) {
      // Fallback to static list on any DB error
      return res.json({ success: true, data: RWANDA_DISTRICTS.map(d => ({ id: d.id, name: d.name, code: d.code })) });
    }
  }

  // GET /api/organizations/check-code/:code
  async checkOrganizationCode(req, res) {
    try {
      const { code } = req.params;
      const organizations = await Organization.findAll({
        where:   { code: code.toUpperCase(), status: 'approved' },
        include: [{ model: District, as: 'district' }],
      });

      if (!organizations.length) {
        return res.status(404).json({ success: false, message: 'Invalid organization code.' });
      }

      // Return district info from first org (all share same district)
      const first = organizations[0];
      return res.json({
        success: true,
        data: {
          organization: {
            id:       first.id,
            name:     first.district?.name ? `${first.district.name} District` : first.name,
            type:     first.type,
            district: first.district?.name,
            count:    organizations.length,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to verify code.', error: error.message });
    }
  }

  // GET /api/organizations/my-status?email=...
  async checkMyStatus(req, res) {
    try {
      const { email } = req.query;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

      const organization = await Organization.findOne({
        where: { contact_email: email },
        include: [{ model: District, as: 'district' }],
        order: [['created_at', 'DESC']],
      });

      if (!organization) {
        return res.status(404).json({ success: false, message: 'No organization found with this email.' });
      }

      // account_setup = true only if admin has logged in at least once (meaning they set their own password)
      const adminUser = await User.findOne({
        where: { organization_id: organization.id, role: 'organization_admin' }
      });
      const accountSetup = !!(adminUser && adminUser.status === 'active');

      return res.json({
        success: true,
        data: {
          id:               organization.id,
          name:             organization.name,
          type:             organization.type,
          status:           organization.status,
          code:             organization.status === 'approved' ? organization.code : null,
          district:         organization.district?.name,
          payment_status:   organization.payment_status,
          rejection_reason: organization.rejection_reason || null,
          account_setup:    accountSetup,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to check status.', error: error.message });
    }
  }

  // POST /api/organizations/setup-account
  async setupAccount(req, res) {
    try {
      const { organization_code, contact_email, admin_name, password } = req.body;

      const organization = await Organization.findOne({
        where: { code: organization_code.toUpperCase(), status: 'approved', contact_email },
      });

      if (!organization) {
        return res.status(404).json({ success: false, message: 'Invalid code or email. Make sure your organization is approved.' });
      }

      // If admin was auto-created on approval, update their name + password
      const existing = await User.findOne({
        where: { organization_id: organization.id, role: 'organization_admin' }
      });

      if (existing) {
        await existing.update({ name: admin_name, password, status: 'active' });
        return res.status(200).json({
          success: true,
          message: 'Account updated successfully. You can now log in.',
          data: { email: existing.email, role: existing.role },
        });
      }

      // No admin yet — create fresh
      const admin = await User.create({
        name:            admin_name,
        email:           contact_email,
        password,
        role:            'organization_admin',
        organization_id: organization.id,
        status:          'active',
        email_verified:  true,
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. You can now log in.',
        data: { email: admin.email, role: admin.role },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Account setup failed.', error: error.message });
    }
  }

  // GET /api/organizations/profile
  async getProfile(req, res) {
    try {
      const orgId = req.userType === 'district_admin'
        ? req.params.id
        : req.user.organization_id;

      const organization = await Organization.findByPk(orgId, {
        include: [
          { model: District, as: 'district' },
          { model: Payment,  as: 'payments', order: [['created_at', 'DESC']], limit: 5 },
        ],
      });

      if (!organization) {
        return res.status(404).json({ success: false, message: 'Organization not found.' });
      }

      return res.json({ success: true, data: organization });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch profile.', error: error.message });
    }
  }

  // PUT /api/organizations/profile
  async updateProfile(req, res) {
    try {
      const { name, contact_email, contact_phone, address } = req.body;
      const organization = await Organization.findByPk(req.user.organization_id);

      if (!organization) return res.status(404).json({ success: false, message: 'Organization not found.' });
      if (organization.status !== 'approved') return res.status(403).json({ success: false, message: 'Organization must be approved to update profile.' });

      await organization.update({ name, contact_email, contact_phone, address });
      return res.json({ success: true, message: 'Profile updated.', data: organization });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Update failed.', error: error.message });
    }
  }

  // GET /api/organizations/stats
  async getStats(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { Class, Task } = await import('../database.js');

      const [total_users, users_by_role, active_users, total_classes, total_tasks, recent_payments] = await Promise.all([
        User.count({ where: { organization_id: organizationId } }),
        User.findAll({
          where:      { organization_id: organizationId },
          attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group:      ['role'],
          raw:        true,
        }),
        User.count({ where: { organization_id: organizationId, status: 'active' } }),
        Class.count({ where: { organization_id: organizationId } }),
        Task.count({
          include: [{ model: Class, as: 'class', where: { organization_id: organizationId }, attributes: [] }]
        }),
        Payment.findAll({ where: { organization_id: organizationId }, order: [['created_at', 'DESC']], limit: 10 }),
      ]);

      return res.json({ success: true, data: { total_users, users_by_role, active_users, total_classes, total_tasks, recent_payments } });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch stats.', error: error.message });
    }
  }
}

function getSubscriptionAmount(subscriptionType, orgType) {
  const prices = {
    school:  { monthly: 50000, quarterly: 135000, yearly: 480000 },
    company: { monthly: 75000, quarterly: 202500, yearly: 720000 },
  };
  return prices[orgType]?.[subscriptionType] || 50000;
}

async function generateOrgCode(districtCode = 'RW') {
  const year = new Date().getFullYear();
  const prefix = `${districtCode.substring(0, 3).toUpperCase()}-${year}`;
  // Get all existing codes that match the pattern
  const organizations = await Organization.findAll({
    attributes: ['code'],
    where: {
      code: { [Op.like]: `${prefix}-%` }
    }
  });

  // Extract numbers and find max
  let maxNum = 0;
  organizations.forEach(org => {
    const match = org.code.match(new RegExp(`^${prefix}-(\\d{3})$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  // Next number
  const nextNum = maxNum + 1;
  const newCode = `${prefix}-${nextNum.toString().padStart(3, '0')}`;

  // Check if exists (to handle race conditions)
  const existing = await Organization.findOne({ where: { code: newCode } });
  if (existing) {
    // If collision, recurse (though unlikely)
    return await generateOrgCode(districtCode);
  }

  return newCode;
}

function calculateSubscriptionEnd(subscriptionType, fromDate) {
  const d = new Date(fromDate);
  if (subscriptionType === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (subscriptionType === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export default new OrganizationController();
