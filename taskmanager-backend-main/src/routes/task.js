import express from 'express';
import TaskController from '../controllers/TaskController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware, organizationScopeMiddleware, taskDeleteAuthorization } from '../middleware/authorization.js';
import { validateRequest, validateParams, schemas } from '../middleware/validation.js';
import { auditLogger } from '../middleware/security.js';
import { uploadSubmission, uploadWorksheet } from '../services/FileUploadService.js';
import AttachmentController from '../attachments/attachmentController.js';
import Joi from 'joi';

const router = express.Router();

// Multer rejects bad types and oversized files by calling back with an error. Passed
// straight to the global handler that surfaced as a misleading 500, so translate it into
// a client error that the submission form can display.
const uploadSubmissionSafe = (req, res, next) => {
  uploadSubmission(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: 'This file is too large. The maximum size is 10 MB.'
      });
    }
    return res.status(400).json({
      success: false,
      code: 'FILE_NOT_ALLOWED',
      message: err.message || 'This file type is not supported.'
    });
  });
};

// Same translation for teacher worksheets: a rejected spreadsheet is a 400 with a
// readable message, not an opaque 500.
const uploadWorksheetSafe = (req, res, next) => {
  uploadWorksheet(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: 'This file is too large. The maximum size is 10 MB.'
      });
    }
    return res.status(400).json({
      success: false,
      code: 'FILE_NOT_ALLOWED',
      message: err.message || 'This file type is not supported.'
    });
  });
};

router.use(authMiddleware);
router.use(organizationScopeMiddleware);

// Create task (draft or published)
router.post('/',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff', 'district_admin']),
  validateRequest(schemas.taskCreation),
  auditLogger('create_task', 'task'),
  TaskController.createTask
);

// Get all tasks (role-aware)
router.get('/',
  roleMiddleware(['organization_admin', 'teacher', 'student', 'worker', 'intern']),
  auditLogger('view_tasks', 'task'),
  TaskController.getTasks
);

// Task analytics (org admin)
router.get('/analytics',
  roleMiddleware(['organization_admin', 'district_admin']),
  auditLogger('view_task_analytics', 'analytics'),
  TaskController.getTaskAnalytics
);

// Get single task
router.get('/:id',
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('view_task_details', 'task'),
  TaskController.getTask
);

// Publish task
router.put('/:id/publish',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('publish_task', 'task'),
  TaskController.publishTask
);

// Submit task (with optional file)
router.post('/:id/submit',
  roleMiddleware(['student', 'intern', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  (req, res, next) => { req.uploadSubDir = 'submissions'; next(); },
  uploadSubmissionSafe,
  auditLogger('submit_task', 'submission'),
  TaskController.submitTask
);

// Teacher worksheet (XLSX / XLS / CSV) attached to a task. The student opens these from
// the assessment page; access is authorized in the controller, not by the static /uploads.
router.post('/:id/attachment',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  uploadWorksheetSafe,
  auditLogger('attach_task_worksheet', 'task_attachment'),
  AttachmentController.uploadWorksheet
);

router.get('/:id/attachment',
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('view_task_worksheet', 'task_attachment'),
  AttachmentController.downloadWorksheet
);

router.delete('/:id/attachment',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('remove_task_worksheet', 'task_attachment'),
  AttachmentController.deleteWorksheet
);

// Teacher downloads a student's submitted file.
router.get('/:id/submissions/:submissionId/file',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({
    id: Joi.number().integer().positive().required(),
    submissionId: Joi.number().integer().positive().required()
  })),
  auditLogger('download_submission_file', 'submission'),
  AttachmentController.downloadSubmissionFile
);

// Get all submissions for a task
router.get('/:id/submissions',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('view_submissions', 'submission'),
  TaskController.getSubmissions
);

// Grade a submission
router.put('/:id/submissions/:submissionId/grade',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateRequest(Joi.object({
    score: Joi.number().min(0).required(),
    feedback: Joi.string().optional(),
    grade: Joi.string().valid('A', 'B', 'C', 'D', 'F').optional()
  })),
  auditLogger('grade_submission', 'submission'),
  TaskController.gradeSubmission
);

// Update task
router.put('/:id',
  roleMiddleware(['teacher', 'organization_admin', 'admin', 'worker', 'staff']),
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  auditLogger('update_task', 'task'),
  TaskController.updateTask
);

// Delete task (allows Admin, Teacher, or task creator)
router.delete('/:id',
  validateParams(Joi.object({ id: Joi.number().integer().positive().required() })),
  taskDeleteAuthorization,
  auditLogger('delete_task', 'task'),
  TaskController.deleteTask
);

export default router;
