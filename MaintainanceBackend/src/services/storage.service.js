import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const ROOT = path.resolve(process.cwd(), env.storage.uploadDir);

await fs.mkdir(ROOT, { recursive: true }).catch(() => {});

const WIDTHS = [400, 800, 1600];

/**
 * Writes a buffer to the configured storage driver.
 * @returns {Promise<string>} the storage key (relative path)
 */
export async function putObject(key, buffer) {
  if (env.storage.driver === 's3') {
    // S3 driver intentionally left as a thin seam — install @aws-sdk/client-s3 and
    // implement here. Local disk is the supported default.
    throw new Error('S3 storage driver is not configured. Set STORAGE_DRIVER=local or implement putObject.');
  }
  const dest = path.join(ROOT, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return key;
}

export async function deleteObject(key) {
  if (!key) return;
  if (env.storage.driver === 's3') return;
  await fs.rm(path.join(ROOT, key), { force: true }).catch(() => {});
}

/** Public URL for a stored key. */
export const publicUrl = (key) =>
  key ? `${env.storage.publicPath}/${key}`.replace(/\/{2,}/g, '/') : null;

/**
 * Processes an uploaded image: strips EXIF, writes the original plus WebP
 * derivatives at 400/800/1600px, and returns metadata for the Media row.
 */
export async function processImage(buffer, originalName) {
  const stamp = new Date();
  const folder = `${stamp.getUTCFullYear()}/${String(stamp.getUTCMonth() + 1).padStart(2, '0')}`;
  const hash = crypto.randomBytes(8).toString('hex');
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  const stem = `${folder}/${base}-${hash}`;

  const image = sharp(buffer, { failOn: 'none' }).rotate(); // rotate() applies EXIF then drops it
  const meta = await image.metadata();

  // Original, re-encoded so metadata (GPS, device) never reaches storage.
  const originalKey = `${stem}.webp`;
  const originalBuf = await image.clone().webp({ quality: 90 }).toBuffer();
  await putObject(originalKey, originalBuf);

  const variants = {};
  for (const width of WIDTHS) {
    if (meta.width && meta.width < width) continue;
    const key = `${stem}-${width}.webp`;
    const buf = await image.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    await putObject(key, buf);
    variants[String(width)] = publicUrl(key);
  }

  // Tiny base64 LQIP placeholder — cheaper than a real blurhash and needs no extra dep.
  let blurhash = null;
  try {
    const tiny = await image.clone().resize({ width: 16 }).webp({ quality: 30 }).toBuffer();
    blurhash = `data:image/webp;base64,${tiny.toString('base64')}`;
  } catch (err) {
    logger.debug({ err: err.message }, 'placeholder generation skipped');
  }

  return {
    path: originalKey,
    variants,
    blurhash,
    mime: 'image/webp',
    size: originalBuf.length,
    width: meta.width ?? null,
    height: meta.height ?? null,
  };
}

/** Non-image files (PDF bills, certificates) are stored as-is. */
export async function storeRaw(buffer, originalName, mime) {
  const stamp = new Date();
  const folder = `${stamp.getUTCFullYear()}/${String(stamp.getUTCMonth() + 1).padStart(2, '0')}`;
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName) || '.bin';
  const key = `${folder}/file-${hash}${ext}`;
  await putObject(key, buffer);
  return { path: key, variants: null, blurhash: null, mime, size: buffer.length, width: null, height: null };
}
