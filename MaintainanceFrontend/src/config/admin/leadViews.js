import { toKathmanduParts } from '@/helpers/format';

/**
 * The leads list's views, all kept in the URL.
 *
 * `view` is the one-click switch (D6): `mine` — the default — asks the API for
 * `assignedToId=me`; `all` asks for everything. Picking an owner in the filter bar, or a
 * preset, overrides it.
 */
export const LEAD_VIEWS = [
  { value: 'mine', label: 'My leads' },
  { value: 'all', label: 'All leads' },
];

export const DEFAULT_LEAD_VIEW = 'mine';

/** List params (from the URL) → the API query. */
export function leadQueryFor(params) {
  const { view = DEFAULT_LEAD_VIEW, ...rest } = params;
  if (rest.assignedToId) return rest;
  return view === 'all' ? rest : { ...rest, assignedToId: 'me' };
}

/** Kathmandu's calendar day, `YYYY-MM-DD`, for an instant. */
const ktmDay = (date) => toKathmanduParts(date.toISOString()).date;

/** The Sunday that starts the Kathmandu week holding `now`. Nepal's week starts on Sunday. */
export function weekStart(now) {
  const day = ktmDay(now);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return new Date(Date.parse(`${day}T00:00:00Z`) - weekday * 86_400_000).toISOString().slice(0, 10);
}

/**
 * One-click saved views. Each is a set of list params written to the URL, so a view can be
 * bookmarked and shared; every key a preset may set is cleared by the others.
 */
export const LEAD_PRESETS = [
  { key: 'breached', label: 'Breached', params: () => ({ view: 'all', slaRisk: 'breached' }) },
  { key: 'unassigned', label: 'Unassigned', params: () => ({ view: 'all', assignedToId: 'none' }) },
  {
    key: 'bookings-week',
    label: 'Bookings this week',
    params: (now = new Date()) => ({ view: 'all', source: 'booking', from: weekStart(now), to: ktmDay(now) }),
  },
];

const PRESET_KEYS = ['view', 'slaRisk', 'assignedToId', 'source', 'from', 'to', 'status', 'priority', 'serviceId', 'requestedVisit'];

/** The params after applying a preset: its own values, every other filter cleared, page 1. */
export function applyPreset(params, preset, now = new Date()) {
  const cleared = Object.fromEntries(PRESET_KEYS.map((k) => [k, undefined]));
  return { ...params, ...cleared, q: undefined, page: 1, ...preset.params(now) };
}

/** The preset the current params are exactly, if any. */
export function activePreset(params, now = new Date()) {
  return LEAD_PRESETS.find((preset) => {
    const wanted = preset.params(now);
    return PRESET_KEYS.every((k) => String(params[k] ?? '') === String(wanted[k] ?? ''))
      && !params.q;
  })?.key ?? null;
}
