import { newKey } from '@/helpers/fieldDb';
import {
  isBlankMeasurement, isReadableMeasurement, measurementTotal, measurementsBody, savedMeasurements,
} from '@/helpers/measurements';

/**
 * The final measurement on a phone (Phase L8), without a DOM: a job line's rows as cards, the one body `PUT
 * /tech/jobs/:id/lines/:lineId/measure` takes, and what stops a save. **Quantities only** — a line from `/tech` has no
 * rate, and nothing here reads or sends one.
 */

/** The API's limit on one line's measurement rows. */
export const MAX_ROWS = 200;

/** A new card, in `area` (a room) when given. */
export const blankRow = (area = '') => ({
  _key: newKey(), area, description: '', nos: '', l: '', b: '', h: '', deduct: false,
});

const shown = (v) => (v === undefined || v === null ? '' : v);

/** The server's rows (numbers) → the cards, shown as the numbers they are. */
export function rowsFromLine(line) {
  return (line?.measurements ?? []).map((m) => ({
    _key: newKey(),
    area: shown(m.area),
    description: shown(m.description),
    nos: shown(m.nos),
    l: shown(m.l),
    b: shown(m.b),
    h: shown(m.h),
    deduct: Boolean(m.deduct),
  }));
}

/** The request body: the rows that read, as numbers — blanks dropped, text trimmed. Never a rate. */
export const measureBody = (rows) => ({ measurements: measurementsBody(savedMeasurements(rows)) });

/** The line's quantity on this phone — a preview; the saved one is the server's `measuredQty`. */
export const phoneTotal = (rows) => measurementTotal(savedMeasurements(rows));

/** Whether the cards say what the server holds (so its `measuredQty` is the quantity of what is on screen). */
export function sameAsSaved(rows, line) {
  const saved = measurementsBody(line?.measurements ?? []);
  return JSON.stringify(measureBody(rows).measurements) === JSON.stringify(saved);
}

/**
 * Why the cards cannot be saved yet — `notSaved` (a row whose size does not read: `FIELD.sheet.notSaved`), `needRow`
 * (nothing to save — the API takes 1–200 rows) or `tooMany` (`FIELD.measure.*`) — or null.
 * @param {object[]} rows
 */
export function measureProblem(rows) {
  const filled = (rows ?? []).filter((r) => !isBlankMeasurement(r));
  if (filled.some((r) => !isReadableMeasurement(r))) return 'notSaved';
  if (!filled.length) return 'needRow';
  if (filled.length > MAX_ROWS) return 'tooMany';
  return null;
}

/** The job's lines by section, in order: `[{ title, lines }]` (a line with no section sits under `fallback`). */
export function linesBySection(lines = [], fallback = '') {
  const sections = [];
  for (const line of lines ?? []) {
    const title = line.section ?? fallback;
    if (sections.at(-1)?.title !== title) sections.push({ title, lines: [] });
    sections.at(-1).lines.push(line);
  }
  return sections;
}
