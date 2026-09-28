import { useEffect, useState } from 'react';
import { getUpload } from '@/helpers/uploadQueue';

/**
 * A picture still in the field app's upload queue (`helpers/uploadQueue.js`), as an object URL for a
 * thumbnail — released when the component goes. Null while it loads, or when the entry has gone (sent).
 *
 * @param {string|null|undefined} id the upload entry's id
 * @returns {string|null}
 */
export function usePendingPicture(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    setUrl(null);
    if (!id) return undefined;
    getUpload(id).then((entry) => {
      if (!alive || !entry?.file || typeof URL?.createObjectURL !== 'function') return;
      objectUrl = URL.createObjectURL(entry.file);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}
