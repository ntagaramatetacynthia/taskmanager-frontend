import multer from 'multer';

// Memory storage keeps file buffer in memory (req.file.buffer) without saving to disk.
const storage = multer.memoryStorage();

export const uploadMemory = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const isAllowed = ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv');
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV file.'));
    }
  },
});

export default uploadMemory;
