/**
 * Shrinks a phone photo before it is queued for upload. A 12-megapixel camera shot is 4–8 MB; on a
 * Kathmandu 4G connection inside a building that is the difference between a photo that arrives and one
 * that does not. The server strips EXIF and makes its own variants; this only saves the bytes.
 *
 * - The longest edge becomes at most `MAX_EDGE` (1600 px); a smaller picture is **never upscaled**.
 * - Re-encoded as JPEG at `QUALITY` (0.8) — or WebP when asked and the browser can encode it.
 * - The original is kept when it is already no larger than the re-encoding and needs no resizing, as long
 *   as it is a type the API accepts (JPEG, PNG, WebP). A HEIC or anything else is always re-encoded.
 * - A picture this browser cannot decode is returned as it is, for the server to accept or refuse.
 */

export const MAX_EDGE = 1600;
export const QUALITY = 0.8;

/** What the API's upload accepts as it is (`middleware/upload.js`, less GIF and AVIF which a camera never makes). */
const KEEPABLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The size a picture is drawn at: the longest edge capped at `maxEdge`, the proportions kept.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [maxEdge]
 * @returns {{ width: number, height: number, scaled: boolean }}
 */
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxEdge) return { width, height, scaled: false };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/**
 * The picture, decoded and turned upright (a phone stores "rotate me" in EXIF, which the server strips).
 * @returns {Promise<{ source: CanvasImageSource, width: number, height: number, release: () => void } | null>}
 */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    for (const options of [{ imageOrientation: 'from-image' }, undefined]) {
      try {
        const bitmap = await createImageBitmap(file, options);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
      } catch {
        // an option this browser does not know, or a picture it cannot read — try the next way
      }
    }
  }
  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

const encode = (canvas, type, quality) => new Promise((resolve) => {
  try {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  } catch {
    resolve(null);
  }
});

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

function asFile(blob, originalName) {
  const base = String(originalName || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  const name = `${base}.${EXTENSIONS[blob.type] ?? 'jpg'}`;
  return typeof File === 'function' ? new File([blob], name, { type: blob.type, lastModified: Date.now() }) : blob;
}

/**
 * @param {File|Blob} file the picture the camera or the gallery gave
 * @param {{ maxEdge?: number, quality?: number, type?: 'image/jpeg'|'image/webp' }} [options]
 * @returns {Promise<File|Blob>} what to upload
 */
export async function compressImage(file, { maxEdge = MAX_EDGE, quality = QUALITY, type = 'image/jpeg' } = {}) {
  const image = await decode(file);
  if (!image) return file;
  try {
    const { width, height, scaled } = fitWithin(image.width, image.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext?.('2d');
    if (!context) return file;
    // JPEG has no transparency: a PNG's clear pixels would otherwise turn black.
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);

    let blob = await encode(canvas, type, quality);
    // A browser that cannot encode WebP hands back a PNG instead — fall back to JPEG.
    if (blob && blob.type !== type) blob = await encode(canvas, 'image/jpeg', quality);
    if (!blob) return file;

    if (!scaled && KEEPABLE.includes(file.type) && file.size <= blob.size) return file;
    return asFile(blob, file.name);
  } finally {
    image.release();
  }
}
