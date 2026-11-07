import express from 'express';
import OrganizationController from '../controllers/OrganizationController.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { roleMiddleware, organizationScopeMiddleware } from '../middleware/authorization.js';
import { validateRequest, validateParams, schemas } from '../middleware/validation.js';
import { organizationRegistrationLimiter, auditLogger } from '../middleware/security.js';
import Joi from 'joi';
import { Op } from 'sequelize';

const router = express.Router();

// Public routes (no authentication required)

// Get all districts for registration form
router.get('/districts',
  auditLogger('view_districts', 'district'),
  OrganizationController.getDistricts
);

// Check organization code validity
router.get('/check-code/:code',
  validateParams(Joi.object({
    code: Joi.string().min(4).max(20).required()
  })),
  auditLogger('check_organization_code', 'organization'),
  OrganizationController.checkOrganizationCode
);

// Register new organization
router.post('/register',
  organizationRegistrationLimiter,
  validateRequest(schemas.organizationRegistration),
  auditLogger('register_organization', 'organization'),
  OrganizationController.register
);

// Check organization status by contact email (public)
router.get('/my-status',
  auditLogger('check_org_status', 'organization'),
  OrganizationController.checkMyStatus
);

// Setup admin account after approval (public) — also resets password if auto-created
router.post('/setup-account',
  validateRequest(Joi.object({
    organization_code: Joi.string().min(4).max(20).required(),
    contact_email:     Joi.string().email().required(),
    admin_name:        Joi.string().min(2).max(100).required(),
    password:          Joi.string().min(6).required(),
  })),
  auditLogger('setup_org_account', 'organization'),
  OrganizationController.setupAccount
);

// Protected routes (authentication required)

// Get organization profile
router.get('/profile',
  authMiddleware,
  roleMiddleware(['organization_admin', 'teacher', 'student', 'worker', 'intern']),
  auditLogger('view_organization_profile', 'organization'),
  OrganizationController.getProfile
);

// Get organization statistics — must be before /:id
router.get('/stats',
  authMiddleware,
  roleMiddleware(['organization_admin']),
  auditLogger('view_organization_stats', 'analytics'),
  OrganizationController.getStats
);

// Update organization profile
router.put('/profile',
  authMiddleware,
  roleMiddleware(['organization_admin']),
  validateRequest(Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    contact_email: Joi.string().email().optional(),
    contact_phone: Joi.string().pattern(/^[+]?[0-9\s\-()]+$/).optional(),
    address: Joi.string().max(500).optional()
  })),
  auditLogger('update_organization_profile', 'organization'),
  OrganizationController.updateProfile
);

// Get specific organization profile (for district admins) — must be LAST
router.get('/:id',
  authMiddleware,
  roleMiddleware(['district_admin']),
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required()
  })),
  auditLogger('view_organization_details', 'organization'),
  OrganizationController.getProfile
);

export default router;