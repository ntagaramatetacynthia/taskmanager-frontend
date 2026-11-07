import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Exported so the attachment module can resolve a stored file without re-deriving the path.
export const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  // Spreadsheet submissions. Browsers report a .csv as any of these three depending on
  // OS and browser, so all of them must be accepted or a valid CSV is rejected.
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/x-csv': 'csv'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = req.uploadSubDir || 'submissions';
    const dir = path.join(UPLOAD_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${Object.values(ALLOWED_TYPES).join(', ')}`), false);
  }
};

export const uploadSubmission = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 }
}).single('file');

export const uploadCSV = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_DIR, 'imports');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed for imports'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('file');

// Teacher worksheets. Filtered by extension rather than MIME because a .csv arrives as
// text/csv, application/csv or application/vnd.ms-excel depending on the browser.
const WORKSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export const uploadWorksheet = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_DIR, 'worksheets');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `worksheet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (WORKSHEET_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel or CSV worksheets are supported (.xlsx, .xls, .csv).'), false);
    }
  },
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 }
}).single('file');

export const getFileUrl = (filename, subDir = 'submissions') => {
  return `/uploads/${subDir}/${filename}`;
};

export const deleteFile = (filePath) => {
  const fullPath = path.join(UPLOAD_DIR, filePath.replace('/uploads/', ''));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};
