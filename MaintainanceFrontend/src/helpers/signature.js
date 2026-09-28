/**
 * The customer's signature, as data: strokes of points in the pad's own CSS pixels, plus the pad's size.
 * `components/tech/SignaturePad.jsx` draws and collects them; this turns them into the PNG that is uploaded
 * as the job's SIGNATURE photo.
 *
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ strokes: Point[][], width: number, height: number }} Signature
 */

/** Less ink than this (CSS px of line) is a tap or a slip, not a signature. */
export const MIN_INK = 60;
/** …and a signature has at least this many points drawn. */
export const MIN_POINTS = 8;

export const EMPTY_SIGNATURE = Object.freeze({ strokes: [], width: 0, height: 0 });

/** The total length of every stroke, in the pad's CSS pixels. */
export function inkLength(strokes = []) {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      total += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
  }
  return total;
}

export const pointCount = (strokes = []) => strokes.reduce((n, s) => n + s.length, 0);

/** @param {Signature} signature */
export const hasSignature = (signature) => pointCount(signature?.strokes) > 0;

/**
 * Enough ink to be a signature — more than a dot or a stray tap.
 * @param {Signature} signature
 */
export const isSignatureLongEnough = (signature) =>
  pointCount(signature?.strokes) >= MIN_POINTS && inkLength(signature?.strokes) >= MIN_INK;

/**
 * Draws the strokes into a 2D context. The pad uses it with the theme's ink; the export with black on white.
 * @param {CanvasRenderingContext2D} context
 * @param {Point[][]} strokes
 * @param {{ ink: string, lineWidth?: number, scale?: number }} style
 */
export function drawStrokes(context, strokes, { ink, lineWidth = 2.5, scale = 1 }) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = ink;
  context.fillStyle = ink;
  context.lineWidth = lineWidth * scale;
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    if (stroke.length === 1) {
      context.beginPath();
      context.arc(stroke[0].x * scale, stroke[0].y * scale, (lineWidth * scale) / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(stroke[0].x * scale, stroke[0].y * scale);
    for (let i = 1; i < stroke.length; i += 1) context.lineTo(stroke[i].x * scale, stroke[i].y * scale);
    context.stroke();
  }
}

/**
 * The signature as a PNG: black ink on white paper at twice the pad's size, whatever the app's theme —
 * the office and the customer's warranty read it on white.
 *
 * @param {Signature} signature
 * @returns {Promise<File|Blob>}
 */
export function signatureToPng(signature, { scale = 2 } = {}) {
  const width = Math.max(1, Math.round((signature.width || 320) * scale));
  const height = Math.max(1, Math.round((signature.height || 160) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, width, height);
  drawStrokes(context, signature.strokes, { ink: 'black', lineWidth: 2.5, scale });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The signature could not be saved as a picture'));
        return;
      }
      resolve(typeof File === 'function' ? new File([blob], 'signature.png', { type: 'image/png' }) : blob);
    }, 'image/png');
  });
}
