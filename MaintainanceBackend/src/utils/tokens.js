import crypto from 'node:crypto';

/** Opaque, URL-safe, 32-byte random token for public links. */
export const publicToken = () => crypto.randomBytes(32).toString('base64url');

/** SHA-256 hex digest — used to store refresh/reset tokens without the plaintext. */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Constant-time string compare. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
