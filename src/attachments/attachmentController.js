import fs from 'fs';
import { Task, Submission, Class } from '../database.js';
import TaskAttachment from './TaskAttachment.js';
import {
  WORKSHEET_KIND,
  absolutePathFor,
  fileExists,
  isSpreadsheet,
  manageProblem,
  publicAttachment,
  readProblem,
  SPREADSHEET_MESSAGE,
} from './attachmentService.js';
import { getFileUrl } from '../services/FileUploadService.js';

const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });

class AttachmentController {
  /** POST /api/tasks/:id/attachment — teacher attaches (or replaces) the worksheet. */
  async uploadWorksheet(req, res) {
    try {
      const task = await Task.findByPk(req.params.id, { include: [{ model: Class, as: 'class' }] });
      if (!task) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');
      }

      const problem = await manageProblem(task, req.user);
      if (problem) {
        // Never keep a file we are not going to reference.
        if (req.file) fs.unlink(req.file.path, () => {});
        return fail(res, 403, 'NOT_TASK_OWNER', problem);
      }

      if (!req.file) return fail(res, 400, 'FILE_REQUIRED', 'Choose an Excel or CSV file to attach.');
      if (!isSpreadsheet(req.file.originalname)) {
        fs.unlink(req.file.path, () => {});
        return fail(res, 400, 'FILE_NOT_ALLOWED', SPREADSHEET_MESSAGE);
      }

      const previous = await TaskAttachment.findOne({
        where: { task_id: task.id, kind: WORKSHEET_KIND },
      });

      const values = {
        task_id: task.id,
        uploaded_by: req.user.id,
        organization_id: req.user.organization_id,
        kind: WORKSHEET_KIND,
        file_url: getFileUrl(req.file.filename, 'worksheets'),
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype,
      };

      const attachment = previous
        ? await previous.update(values)
        : await TaskAttachment.create(values);

      // Drop the replaced file only after the row points at the new one.
      if (previous && previous.file_url && previous.file_url !== values.file_url) {
        const stale = absolutePathFor(previous.file_url);
        if (stale) fs.unlink(stale, () => {});
      }

      return res.status(previous ? 200 : 201).json({
        success: true,
        message: previous ? 'Worksheet replaced.' : 'Worksheet attached.',
        data: publicAttachment(attachment),
      });
    } catch (error) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: 'Failed to attach the worksheet.', error: error.message });
    }
  }

  /** GET /api/tasks/:id/attachment — owner teacher, org admin, or assigned student. */
  async downloadWorksheet(req, res) {
    try {
      const task = await Task.findByPk(req.params.id, { include: [{ model: Class, as: 'class' }] });
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');

      const problem = await readProblem(task, req.user);
      if (problem) return fail(res, 403, 'NOT_ALLOWED', problem);

      const attachment = await TaskAttachment.findOne({
        where: { task_id: task.id, kind: WORKSHEET_KIND },
      });
      if (!attachment) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'This task has no worksheet attached.');
      if (!fileExists(attachment.file_url)) {
        return fail(res, 410, 'FILE_MISSING', 'The worksheet file is no longer available on the server.');
      }

      // Send the original bytes under the original name: the download must stay an
      // Excel/CSV file, never a re-encoded copy.
      return res.download(absolutePathFor(attachment.file_url), attachment.file_name);
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to download the worksheet.', error: error.message });
    }
  }

  /** DELETE /api/tasks/:id/attachment — owner teacher removes the worksheet. */
  async deleteWorksheet(req, res) {
    try {
      const task = await Task.findByPk(req.params.id, { include: [{ model: Class, as: 'class' }] });
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');

      const problem = await manageProblem(task, req.user);
      if (problem) return fail(res, 403, 'NOT_TASK_OWNER', problem);

      const attachment = await TaskAttachment.findOne({
        where: { task_id: task.id, kind: WORKSHEET_KIND },
      });
      if (!attachment) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'This task has no worksheet attached.');

      const fileUrl = attachment.file_url;
      await attachment.destroy();
      const stored = absolutePathFor(fileUrl);
      if (stored) fs.unlink(stored, () => {});

      return res.json({ success: true, message: 'Worksheet removed.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to remove the worksheet.', error: error.message });
    }
  }

  /** GET /api/tasks/:id/submissions/:submissionId/file — teacher downloads a submission. */
  async downloadSubmissionFile(req, res) {
    try {
      const task = await Task.findByPk(req.params.id, { include: [{ model: Class, as: 'class' }] });
      if (!task) return fail(res, 404, 'TASK_NOT_FOUND', 'Task not found.');

      const isOwner = String(task.created_by) === String(req.user.id);
      const isOrgAdmin = req.user.role === 'organization_admin';
      if (!isOwner && !isOrgAdmin) {
        return fail(res, 403, 'NOT_ALLOWED', 'You can only review submissions for your own tasks.');
      }

      const submission = await Submission.findOne({
        where: { id: req.params.submissionId, task_id: task.id },
      });
      if (!submission) return fail(res, 404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
      if (!submission.file_url) return fail(res, 404, 'NO_FILE', 'This submission has no attached file.');
      if (!fileExists(submission.file_url)) {
        return fail(res, 410, 'FILE_MISSING', 'The submitted file is no longer available on the server.');
      }

      return res.download(absolutePathFor(submission.file_url), submission.file_name || 'submission');
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to download the file.', error: error.message });
    }
  }
}

export default new AttachmentController();
