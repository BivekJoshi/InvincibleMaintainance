import multer from 'multer';
import { badRequest } from '../utils/AppError.js';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const DOC_MIMES = ['application/pdf'];

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIMES.includes(file.mimetype)) {
      return cb(badRequest(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

export const uploadAny = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (![...IMAGE_MIMES, ...DOC_MIMES].includes(file.mimetype)) {
      return cb(badRequest(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/**
 * Magic-byte check — the declared mimetype from the client is never trusted.
 * @param {Buffer} buf
 */
export function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 12).toString('ascii').includes('ftyp')) return 'image/avif';
  if (hex.startsWith('25504446')) return 'application/pdf';
  return null;
}
