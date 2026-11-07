import express from 'express';
import ClassController from '../controllers/ClassController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware, organizationScopeMiddleware } from '../middleware/authorization.js';
import { validateRequest, validateParams, schemas } from '../middleware/validation.js';
import { auditLogger } from '../middleware/security.js';
import Joi from 'joi';

const router = express.Router();

router.use(authMiddleware);
router.use(organizationScopeMiddleware);

// Create class/department
router.post('/',
  roleMiddleware(['organization_admin', 'teacher']),
  validateRequest(schemas.classCreation),
  auditLogger('create_class', 'class'),
  ClassController.createClass
);

// Get all classes
router.get('/',
  roleMiddleware(['organization_admin', 'teacher', 'student', 'worker', 'intern']),
  auditLogger('view_classes', 'class'),
  ClassController.getClasses
);

// Get class details
router.get('/:id',
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('view_class_details', 'class'),
  ClassController.getClass
);

// Get class performance stats
router.get('/:id/stats',
  roleMiddleware(['organization_admin', 'teacher']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('view_class_stats', 'analytics'),
  ClassController.getClassStats
);

// Add student to class
router.post('/:id/students',
  roleMiddleware(['organization_admin', 'teacher']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  validateRequest(Joi.object({ student_id: Joi.number().integer().positive().required() })),
  auditLogger('add_student_to_class', 'class'),
  ClassController.addStudent
);

// Remove student from class
router.delete('/:id/students/:studentId',
  roleMiddleware(['organization_admin', 'teacher']),
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required(),
    studentId: Joi.number().integer().positive().required()
  })),
  auditLogger('remove_student_from_class', 'class'),
  ClassController.removeStudent
);

// Create subject in a class
router.post('/:id/subjects',
  roleMiddleware(['organization_admin']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  validateRequest(Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().min(2).max(20).required(),
    description: Joi.string().optional(),
    teacher_id: Joi.number().integer().positive().required(),
    credits: Joi.number().integer().min(1).max(10).default(1),
    hours_per_week: Joi.number().integer().min(1).max(40).default(1),
    syllabus: Joi.string().optional()
  })),
  auditLogger('create_subject', 'class'),
  ClassController.createSubject
);

// Update class
router.put('/:id',
  roleMiddleware(['organization_admin', 'teacher']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('update_class', 'class'),
  ClassController.updateClass
);

// Delete class
router.delete('/:id',
  roleMiddleware(['organization_admin']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('delete_class', 'class'),
  ClassController.deleteClass
);

export default router;
