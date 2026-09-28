import { PAYMENT_SCHEDULE_PRESETS } from '@/config/constants';

/**
 * A quotation's payment schedule on the client (L-D3, Phase L4) — **shares, never money**. The API stores each
 * stage's share in basis points (5000 = 50 %) and works out every amount (`money.js#paymentSchedule`); the builder
 * edits percentages, and this file converts between the two and checks that they add up to 100 %. Nothing here
 * multiplies a share by a total.
 */

let seq = 0;
const nextKey = () => {
  seq += 1;
  return `new-stage-${seq}`;
};

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/** A percentage as typed (`50`, `33.33`, `12.5 %`) → a number, or NaN when it cannot be read; undefined when blank. */
export function parsePct(value) {
  if (blank(value)) return undefined;
  if (typeof value === 'number') return value;
  const n = Number(String(value).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

/** A percentage → basis points, rounded to the whole basis point (0.01 %). */
export const basisPointsOf = (pct) => Math.round(Number(pct) * 100);

/** Basis points as the customer reads a share: `5000` → `50%`, `3333` → `33.33%`. */
export function formatShare(basisPoints) {
  if (basisPoints == null || !Number.isFinite(Number(basisPoints))) return '—';
  return `${(Number(basisPoints) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

/** A stage row the builder added and left empty. */
export const isBlankStage = (row) => !row || (blank(row.label) && blank(row.pct));

/**
 * The API's stages (`{ label, basisPoints, trigger, … }`) → the grid's rows (`{ _key, label, pct, trigger }`). A row
 * keeps the server's figures out: amounts are shown from the server beside the row, never carried in it.
 * @param {{ label: string, basisPoints: number, trigger: string }[]} [stages]
 */
export function toStageRows(stages = []) {
  // A stable key per loaded stage, so reloading the same record gives the same rows (the form compares by value).
  return (stages ?? []).map((st, i) => ({
    _key: st.id ?? st._key ?? `stage-${i}`,
    label: st.label ?? '',
    pct: st.basisPoints != null ? st.basisPoints / 100 : st.pct ?? '',
    trigger: st.trigger ?? 'MILESTONE',
  }));
}

/** One grid row → the request's stage. */
export const stageBody = (row) => ({
  label: String(row.label ?? '').trim(),
  basisPoints: basisPointsOf(parsePct(row.pct)),
  trigger: row.trigger,
});

/** The rows → the request's `paymentStages`: blank rows dropped. */
export const scheduleBody = (rows = []) => (rows ?? []).filter((r) => !isBlankStage(r)).map(stageBody);

/**
 * How far the rows are from 100 %, in basis points (the API's rule: the stages sum to exactly 10000).
 * @returns {{ totalBp: number, readable: boolean }}  `readable` is false while a share cannot be read
 */
export function scheduleTotal(rows = []) {
  let totalBp = 0;
  let readable = true;
  for (const row of rows ?? []) {
    if (isBlankStage(row)) continue;
    const pct = parsePct(row.pct);
    if (pct === undefined || !Number.isFinite(pct)) {
      readable = false;
      continue;
    }
    totalBp += basisPointsOf(pct);
  }
  return { totalBp, readable };
}

/** A new, empty stage — a milestone, the most common one to add. */
export const blankStage = () => ({ _key: nextKey(), label: '', pct: '', trigger: 'MILESTONE' });

/** A preset's rows (`PAYMENT_SCHEDULE_PRESETS`), with fresh keys. */
export function presetRows(key) {
  const preset = PAYMENT_SCHEDULE_PRESETS.find((p) => p.key === key);
  return preset ? preset.stages.map((st) => ({ _key: nextKey(), ...st })) : [];
}

/** The preset the rows match exactly (labels aside), for the presets' pressed state. */
export function matchingPreset(rows = []) {
  const shown = (rows ?? []).filter((r) => !isBlankStage(r));
  return PAYMENT_SCHEDULE_PRESETS.find((p) => p.stages.length === shown.length
    && p.stages.every((st, i) => basisPointsOf(st.pct) === basisPointsOf(parsePct(shown[i].pct)) && st.trigger === shown[i].trigger))?.key ?? null;
}

/**
 * The rows as the request's `paymentStages` when the API would take them — every stage named, 0.01–100 %, a known
 * trigger, 1–10 of them making exactly 100 %, at most one advance — or null. The builder's live preview sends a
 * schedule only when it is whole, so the stage amounts it shows are always for the schedule on screen.
 */
export function validScheduleBody(rows = []) {
  const body = scheduleBody(rows);
  if (!body.length || body.length > 10) return null;
  const whole = body.every((st) => st.label && st.label.length <= 80 && Number.isInteger(st.basisPoints)
    && st.basisPoints >= 1 && st.basisPoints <= 10000 && Boolean(st.trigger));
  if (!whole) return null;
  if (body.reduce((sum, st) => sum + st.basisPoints, 0) !== 10000) return null;
  if (body.filter((st) => st.trigger === 'ON_ACCEPT').length > 1) return null;
  return body;
}
