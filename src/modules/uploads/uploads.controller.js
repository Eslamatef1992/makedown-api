const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { ok } = require('../../utils/apiResponse');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Images (product thumbnails, quiz cover images, school logos, category
// icons, question images) plus common audio formats (for "listening" quiz
// question media).
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
]);

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB — keep in sync with Nginx's client_max_body_size

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_TYPE'));
    }
    cb(null, true);
  },
}).single('file');

// Not wrapped in asyncHandler — multer's callback-style API needs its error
// handled directly so we can turn it into a proper ApiError instead of a
// raw 500.
function uploadImage(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(`File is too large. Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`));
      }
      if (err.message === 'UNSUPPORTED_TYPE') {
        return next(ApiError.badRequest('Unsupported file type. Allowed formats: PNG, JPG, GIF, WEBP, SVG, AVIF, ICO, MP3, WAV, OGG, M4A.'));
      }
      return next(ApiError.badRequest('Upload failed'));
    }
    if (!req.file) {
      return next(ApiError.badRequest('No file uploaded'));
    }
    const url = `${env.apiBaseUrl}/uploads/${req.file.filename}`;
    ok(res, { url, filename: req.file.filename, size: req.file.size, mimeType: req.file.mimetype }, 'Uploaded');
  });
}

module.exports = { uploadImage };
