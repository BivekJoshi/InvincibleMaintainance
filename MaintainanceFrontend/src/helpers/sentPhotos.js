/**
 * Photos this phone has sent, remembered with their thumbnail address.
 *
 * `GET /tech/jobs/:id` lists a job's photos by `mediaId` only, and `GET /tech/surveys/:id` lists none, so the
 * field app cannot show a picture it did not upload itself. The upload's answer carries the media's `thumb`;
 * keeping it here (per browser, the newest `LIMIT`) lets the job and survey screens show what was sent.
 * Nothing here is needed for correctness — a missing entry shows a plain tile.
 */

const KEY = 'gharjatan-field-sent-photos';
const LIMIT = 150;

let rows = null;

function load() {
  if (rows) return rows;
  try {
    rows = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  return rows;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // private mode or full — the thumbnails simply are not remembered
  }
}

/**
 * @param {{ target: string, targetId: string, kind?: string, caption?: string, at?: string }} entry the upload
 * @param {Array<{ id: string, thumb?: string, url?: string }>} media the API's answer
 */
export function rememberSent(entry, media = []) {
  const list = load();
  for (const m of media) {
    if (!m?.id || list.some((r) => r.mediaId === m.id)) continue;
    list.unshift({
      mediaId: m.id,
      target: entry.target,
      targetId: entry.targetId,
      kind: entry.kind ?? null,
      caption: entry.caption ?? null,
      thumb: m.thumb ?? m.url ?? null,
      at: entry.at ?? new Date().toISOString(),
    });
  }
  rows = list.slice(0, LIMIT);
  save();
}

/** What this phone sent for one job or survey, newest first. */
export const sentFor = (target, targetId) => load().filter((r) => r.target === target && r.targetId === targetId);

export const thumbFor = (mediaId) => load().find((r) => r.mediaId === mediaId)?.thumb ?? null;

/** Tests only. */
export function resetSentPhotosForTests() {
  rows = null;
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}
