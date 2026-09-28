/**
 * File downloads that came through RTK Query (see "File downloads" in STRUCTURE.md): the request carries the
 * Bearer token and survives a 401 → refresh → retry, and the page turns the answer into a file here.
 *
 * A binary file (the quotation's .xlsx) is cached as **base64 text**, because the store only holds serialisable
 * values; `arrayBufferToBase64` encodes it in the query's response handler and `downloadBase64` decodes it into a
 * Blob and clicks a temporary link.
 */

/** An ArrayBuffer → base64, in chunks (a spread of a large array overflows the call stack). */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 → bytes. */
export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Saves a Blob under `filename` through a temporary link. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves a file that arrived as base64.
 * @param {string} base64
 * @param {string} filename
 * @param {string} type  the media type
 */
export function downloadBase64(base64, filename, type) {
  saveBlob(new Blob([base64ToBytes(base64)], { type }), filename);
}
