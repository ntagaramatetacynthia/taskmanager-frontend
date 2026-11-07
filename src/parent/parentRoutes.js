import express from 'express';
import ParentController from './parentController.js';
import { parentAuthMiddleware } from './parentAuth.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/authorization.js';
import { authLimiter } from '../middleware/security.js';

const router = express.Router();

// Public: parent login (rate-limited like the other login endpoints).
router.post('/login', authLimiter, ParentController.login);

// Teacher inbox: normal staff token (parent tokens fail authMiddleware by design).
router.get('/teacher-inbox',
  authMiddleware, roleMiddleware(['teacher', 'worker', 'organization_admin']),
  ParentController.teacherInbox);
router.patch('/teacher-inbox/:id/read',
  authMiddleware, roleMiddleware(['teacher', 'worker', 'organization_admin']),
  ParentController.markRead);

// Parent-only routes.
router.get('/dashboard', parentAuthMiddleware, ParentController.dashboard);
router.get('/teachers', parentAuthMiddleware, ParentController.teachers);
router.get('/feedback', parentAuthMiddleware, ParentController.myFeedback);
router.post('/feedback', parentAuthMiddleware, ParentController.sendFeedback);

export default router;
