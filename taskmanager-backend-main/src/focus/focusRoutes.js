import express from 'express';
import FocusController from './focusController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware, organizationScopeMiddleware } from '../middleware/authorization.js';
import { auditLogger } from '../middleware/security.js';
import Joi from 'joi';
import { validateParams, validateRequest } from '../middleware/validation.js';

const router = express.Router();

router.use(authMiddleware);
router.use(organizationScopeMiddleware);

const taskIdParam = validateParams(Joi.object({ taskId: Joi.number().integer().positive().required() }));
const sessionIdParam = validateParams(Joi.object({ id: Joi.number().integer().positive().required() }));

const STUDENT_ROLES = ['student', 'intern', 'worker'];

// Student: current verified focus against the task's configured requirement.
router.get('/tasks/:taskId/status', roleMiddleware(STUDENT_ROLES), taskIdParam, FocusController.getStatus);

// Student: start or resume a focus session for a task (idempotent).
router.post(
  '/tasks/:taskId/sessions',
  roleMiddleware(STUDENT_ROLES),
  taskIdParam,
  auditLogger('start_focus_session', 'focus_session'),
  FocusController.startSession
);

// Student: session lifecycle. Time is accrued from server timestamps on each call.
router.post('/sessions/:id/heartbeat', roleMiddleware(STUDENT_ROLES), sessionIdParam, FocusController.heartbeat);
router.post(
  '/sessions/:id/pause',
  roleMiddleware(STUDENT_ROLES),
  sessionIdParam,
  validateRequest(Joi.object({ reason: Joi.string().max(40).optional() })),
  FocusController.pause
);
router.post('/sessions/:id/resume', roleMiddleware(STUDENT_ROLES), sessionIdParam, FocusController.resume);
router.post(
  '/sessions/:id/complete',
  roleMiddleware(STUDENT_ROLES),
  sessionIdParam,
  auditLogger('complete_focus_session', 'focus_session'),
  FocusController.complete
);
router.post('/sessions/:id/abandon', roleMiddleware(STUDENT_ROLES), sessionIdParam, FocusController.abandon);

// Teacher / org admin: focus history for one of their tasks.
router.get(
  '/tasks/:taskId/sessions',
  roleMiddleware(['teacher', 'organization_admin']),
  taskIdParam,
  FocusController.listTaskSessions
);

export default router;
