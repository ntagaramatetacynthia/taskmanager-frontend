import { Op } from 'sequelize';
import Joi from 'joi';
import { User, StudentProfile, Organization, Class, Subject, AuditLog } from '../database.js';
import ParentLink from './ParentLink.js';
import { normalizePhone } from './phone.js';

const registerSchema = Joi.object({
  organization_code: Joi.string().trim().min(2).max(30).required(),
  student_id: Joi.string().trim().min(1).max(50).required(),
  parent_name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().min(6).max(20).pattern(/^[+\d\s()-]+$/)
    .messages({ 'string.pattern.base': 'Enter a valid phone number' }).required(),
  relationship: Joi.string().valid('mother', 'father', 'guardian', 'parent', 'other').default('parent'),
  email: Joi.string().trim().email().max(150).allow('', null),
});

const audit = (req, data) =>
  AuditLog.create({
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    category: 'parent_portal',
    resource_type: 'parent_link',
    ...data,
  }).catch(() => {});

// Class ids the reviewer may act on. Org admins: every class in the org. Teachers: classes
// they manage plus classes where they teach a subject.
async function reviewableClassIds(user) {
  if (user.role === 'organization_admin') return null; // null = whole organization
  const [managed, subjects] = await Promise.all([
    Class.findAll({ where: { manager_id: user.id, organization_id: user.organization_id }, attributes: ['id'] }),
    Subject.findAll({ where: { teacher_id: user.id }, attributes: ['class_id'] }),
  ]);
  return [...new Set([...managed.map((c) => c.id), ...subjects.map((s) => s.class_id)])];
}

async function findReviewableLink(req) {
  const link = await ParentLink.findOne({
    where: { id: req.params.id, organization_id: req.user.organization_id },
  });
  if (!link) return null;
  const allowed = await reviewableClassIds(req.user);
  if (allowed && !allowed.includes(link.class_id)) return null;
  return link;
}

class ParentLinkController {
  // POST /api/parent/register  (public)
  async register(req, res) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });

      const phoneNormalized = normalizePhone(value.phone);
      if (phoneNormalized.length < 6) {
        return res.status(400).json({ success: false, message: 'Enter a valid phone number' });
      }

      const organizations = await Organization.findAll({
        where: { code: value.organization_code.toUpperCase(), status: 'approved' },
        attributes: ['id'],
      });
      const profile = organizations.length
        ? await StudentProfile.findOne({
          where: { student_id: value.student_id },
          include: [{
            model: User, as: 'user', required: true,
            where: { organization_id: { [Op.in]: organizations.map((o) => o.id) } },
          }],
        })
        : null;

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'No student was found with that organization code and Student ID. Please check with the school.',
        });
      }

      const existing = await ParentLink.findOne({
        where: { student_profile_id: profile.id, phone_normalized: phoneNormalized },
      });

      if (existing) {
        if (existing.status === 'approved') {
          return res.status(409).json({ success: false, code: 'ALREADY_APPROVED', message: 'This phone is already approved for this student. You can sign in now.' });
        }
        if (existing.status === 'pending') {
          return res.status(409).json({ success: false, code: 'ALREADY_PENDING', message: 'A request with this phone is already waiting for the teacher\'s approval.' });
        }
        // Rejected before: allow a fresh request.
        await existing.update({
          parent_name: value.parent_name, phone: value.phone, relationship: value.relationship,
          email: value.email || null, status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null,
        });
        audit(req, { action: 'parent_register_resubmit', organization_id: profile.user.organization_id, resource_id: existing.id });
        return res.status(201).json({ success: true, message: 'Request re-submitted. The class teacher will review it.', data: { status: 'pending' } });
      }

      const link = await ParentLink.create({
        student_user_id: profile.user.id,
        student_profile_id: profile.id,
        student_code: profile.student_id,
        class_id: profile.class_id,
        organization_id: profile.user.organization_id,
        parent_name: value.parent_name,
        phone: value.phone,
        phone_normalized: phoneNormalized,
        relationship: value.relationship,
        email: value.email || null,
      });

      audit(req, {
        action: 'parent_register', organization_id: link.organization_id, resource_id: link.id,
        description: `Parent registration request for student ${profile.student_id}`,
      });

      res.status(201).json({
        success: true,
        message: 'Request sent. You can sign in once the class teacher approves it.',
        data: { status: 'pending' },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }

  // GET /api/parent/requests?status=pending  (teacher / org admin)
  async list(req, res) {
    try {
      const where = { organization_id: req.user.organization_id };
      if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
      const allowed = await reviewableClassIds(req.user);
      if (allowed) where.class_id = { [Op.in]: allowed.length ? allowed : [-1] };

      const rows = await ParentLink.findAll({
        where,
        include: [
          { model: User, as: 'student', attributes: ['id', 'name'] },
          { model: Class, as: 'class', attributes: ['id', 'name'] },
          { model: User, as: 'reviewer', attributes: ['id', 'name'] },
        ],
        order: [['created_at', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load parent requests' });
    }
  }

  // PUT /api/parent/requests/:id/approve
  async approve(req, res) {
    try {
      const link = await findReviewableLink(req);
      if (!link) return res.status(404).json({ success: false, message: 'Request not found' });
      await link.update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date(), rejection_reason: null });
      audit(req, { action: 'parent_link_approved', user_id: req.user.id, organization_id: link.organization_id, resource_id: link.id });
      res.json({ success: true, message: 'Parent approved', data: link });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to approve request' });
    }
  }

  // PUT /api/parent/requests/:id/reject   body: { reason? }
  // Also used to revoke an already-approved parent: their next request is refused.
  async reject(req, res) {
    try {
      const link = await findReviewableLink(req);
      if (!link) return res.status(404).json({ success: false, message: 'Request not found' });
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;
      await link.update({ status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date(), rejection_reason: reason });
      audit(req, { action: 'parent_link_rejected', user_id: req.user.id, organization_id: link.organization_id, resource_id: link.id });
      res.json({ success: true, message: 'Request rejected', data: link });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to reject request' });
    }
  }
}

export default new ParentLinkController();
