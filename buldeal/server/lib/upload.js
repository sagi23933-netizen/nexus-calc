import multer from 'multer';
import path from 'node:path';
import { UPLOAD_DIR } from '../config.js';
import { randomId, bad } from './utils.js';

const TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${Date.now().toString(36)}-${randomId(8)}${TYPES[file.mimetype] || path.extname(file.originalname)}`),
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TYPES[file.mimetype]) return cb(bad('ניתן להעלות רק תמונות PNG, JPG, WEBP או GIF'));
    cb(null, true);
  },
}).single('file');

export const uploadedUrl = (file) => (file ? `/uploads/${file.filename}` : '');
