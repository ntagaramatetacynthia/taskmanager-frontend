/**
 * Attachment rules shared by the upload/download endpoints and the task detail payload.
 *
 * Authorization is deliberately explicit here rather than reusing the generic
 * ownership middleware: a worksheet has to be readable by the *assigned student*, who is
 * not the task owner and not an administrator.
 */
import fs from 'fs';
import path from 'path';
import { Class, StudentProfile } from '../database.js';
import { UPLOAD_DIR } from '../services/FileUploadService.js';

export const WORKSHEET_KIND = 'worksheet';
export const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
export const SPREADSHEET_MESSAGE = 'Only Excel or CSV worksheets are supported (.xlsx, .xls, .csv).';

const STUDENT_ROLES = ['student', 'intern', 'worker'];

export function spreadsheetExtension(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

export function isSpreadsheet(filename) {
  return SPREADSHEET_EXTENSIONS.includes(spreadsheetExtension(filename));
}

/** Stored files are addressed by their public URL, never by a client-supplied path. */
export function absolutePathFor(fileUrl) {
  const relative = String(fileUrl || '').replace(/^\/?uploads\/?/, '');
  if (!relative || relative.includes('..')) return null;
  return path.join(UPLOAD_DIR, relative);
}

export function fileExists(fileUrl) {
  const full = absolutePathFor(fileUrl);
  return Boolean(full) && fs.existsSync(full);
}

export function publicAttachment(row) {
  if (!row) return null;
  const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    kind: plain.kind || WORKSHEET_KIND,
    file_url: plain.file_url,
    file_name: plain.file_name,
    file_size: Number(plain.file_size) || 0,
    file_type: plain.file_type || null,
    extension: spreadsheetExtension(plain.file_name),
    uploaded_at: plain.updatedAt || plain.createdAt || null,
  };
}

async function taskOrganizationId(task) {
  if (!task?.class_id) return null;
  if (task.class && task.class.organization_id !== undefined) {
    return Number(task.class.organization_id);
  }
  const cls = await Class.findByPk(task.class_id, { attributes: ['id', 'organization_id'] });
  return cls ? Number(cls.organization_id) : null;
}

/** Returns an error message, or null when the user may manage (upload/replace) the file. */
export async function manageProblem(task, user) {
  if (!task) return 'Task not found.';
  if (!user) return 'Authentication required.';

  if (user.role === 'organization_admin') {
    const orgId = await taskOrganizationId(task);
    if (orgId && Number(orgId) !== Number(user.organization_id)) {
      return 'This task belongs to another organization.';
    }
    return null;
  }

  if (String(task.created_by) !== String(user.id)) {
    return 'You can only attach worksheets to your own tasks.';
  }
  return null;
}

/** Returns an error message, or null when the user may open/download the worksheet. */
export async function readProblem(task, user) {
  if (!task) return 'Task not found.';
  if (!user) return 'Authentication required.';

  if (user.role === 'organization_admin') {
    const orgId = await taskOrganizationId(task);
    if (orgId && Number(orgId) === Number(user.organization_id)) return null;
    return 'This task belongs to another organization.';
  }

  if (String(task.created_by) === String(user.id)) return null;

  if (STUDENT_ROLES.includes(user.role)) {
    const profile = await StudentProfile.findOne({ where: { user_id: user.id } });
    if (!profile) return 'You are not assigned to this task.';
    if (Number(profile.class_id) !== Number(task.class_id)) return 'You are not assigned to this task.';
    return null;
  }

  return 'You are not allowed to open this attachment.';
}
