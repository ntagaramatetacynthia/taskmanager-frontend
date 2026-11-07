import express from 'express';
import DistrictController from '../controllers/DistrictController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware, districtScopeMiddleware } from '../middleware/authorization.js';
import { validateRequest, validateParams, schemas } from '../middleware/validation.js';
import { auditLogger } from '../middleware/security.js';
import Joi from 'joi';

const router = express.Router();

// All district routes require district admin authentication
router.use(authMiddleware);
router.use(roleMiddleware(['district_admin']));
router.use(districtScopeMiddleware);

// Get pending organizations for approval
router.get('/organizations/pending',
  auditLogger('view_pending_organizations', 'organization'),
  DistrictController.getPendingOrganizations
);

// Get all organizations in district
router.get('/organizations',
  auditLogger('view_district_organizations', 'organization'),
  DistrictController.getDistrictOrganizations
);

// Approve organization
router.put('/organizations/approve/:id',
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required()
  })),
  validateRequest(Joi.object({
    approval_notes: Joi.string().optional(),
    conditions: Joi.string().optional()
  })),
  auditLogger('approve_organization', 'organization'),
  DistrictController.approveOrganization
);

// Reject organization
router.put('/organizations/reject/:id',
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required()
  })),
  validateRequest(Joi.object({
    rejection_reason: Joi.string().required(),
    status: Joi.string().optional()
  })),
  auditLogger('reject_organization', 'organization'),
  DistrictController.rejectOrganization
);

// Suspend/Reactivate organization
router.put('/organizations/suspend/:id',
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required()
  })),
  validateRequest(Joi.object({
    reason: Joi.string().max(500).optional()
  })),
  auditLogger('suspend_organization', 'organization'),
  DistrictController.suspendOrganization
);

// Get district statistics
router.get('/stats',
  auditLogger('view_district_stats', 'analytics'),
  DistrictController.getDistrictStats
);

export default router;