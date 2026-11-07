import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { authLimiter, auditLogger } from '../middleware/security.js';

const router = express.Router();

// District Admin Login
router.post('/district-admin/login',
  authLimiter,
  validateRequest(schemas.login),
  auditLogger('district_admin_login', 'authentication'),
  AuthController.districtAdminLogin
);

// Regular User Login
router.post('/login',
  authLimiter,
  validateRequest(schemas.login),
  auditLogger('user_login', 'authentication'),
  AuthController.userLogin
);

// Organization Code Login (for students/interns)
router.post('/organization-login',
  authLimiter,
  validateRequest(schemas.organizationCodeLogin),
  auditLogger('organization_code_login', 'authentication'),
  AuthController.organizationCodeLogin
);

// Get current user profile
router.get('/profile',
  authMiddleware,
  auditLogger('get_profile', 'user'),
  AuthController.getProfile
);

// Update current user profile
router.put('/profile',
  authMiddleware,
  auditLogger('update_profile', 'user'),
  AuthController.updateProfile
);

// Logout
router.post('/logout',
  authMiddleware,
  auditLogger('logout', 'authentication'),
  AuthController.logout
);

// Change password
router.put('/change-password',
  authMiddleware,
  validateRequest(schemas.passwordUpdate),
  auditLogger('change_password', 'user'),
  AuthController.changePassword
);

export default router;