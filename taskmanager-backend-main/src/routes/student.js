import express from 'express';
import StudentBulkUploadController from '../controllers/StudentBulkUploadController.js';
import UserController from '../controllers/UserController.js';
import uploadMemory from '../middleware/uploadMemory.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware, organizationScopeMiddleware } from '../middleware/authorization.js';
import { auditLogger } from '../middleware/security.js';

const router = express.Router();

router.use(authMiddleware);
router.use(organizationScopeMiddleware);

// Download Excel template
router.get('/template',
  roleMiddleware(['organization_admin', 'teacher']),
  StudentBulkUploadController.downloadTemplate
);

// Bulk upload students via Excel or CSV held in memory
router.post('/bulk-upload',
  roleMiddleware(['organization_admin', 'teacher']),
  (req, res, next) => {
    uploadMemory.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  auditLogger('bulk_upload_students', 'student'),
  StudentBulkUploadController.bulkUpload
);

// Delete student by unique primary key ID
router.delete('/:id',
  roleMiddleware(['organization_admin', 'teacher']),
  auditLogger('delete_student', 'student'),
  UserController.deleteUser
);

export default router;
