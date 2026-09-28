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

/** `GET /admin/leads?nextAction=` — the follow-up views (Phase L1). `none` is open leads with nothing next. */
export const NEXT_ACTION_FILTERS = [
  { value: 'due_today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'none', label: 'No next action' },
];

/**
 * One-click saved views. Each is a set of list params written to the URL, so a view can be
 * bookmarked and shared; every key a preset may set is cleared by the others.
 *
 * `keepView` presets narrow whichever of My leads / All leads is showing instead of switching to All:
 * a salesperson's "Due today" is their own list (the morning digest links to it), a manager's is everyone's.
 */
export const LEAD_PRESETS = [
  { key: 'due-today', label: 'Due today', hint: 'Next action due today, Nepal time', keepView: true, params: () => ({ nextAction: 'due_today' }) },
  { key: 'overdue', label: 'Overdue', hint: 'Next action time has passed', keepView: true, params: () => ({ nextAction: 'overdue' }) },
  { key: 'no-next-action', label: 'No next action', hint: 'Open leads with nothing scheduled', keepView: true, params: () => ({ nextAction: 'none' }) },
  { key: 'breached', label: 'Breached', hint: 'Response deadline passed', params: () => ({ view: 'all', slaRisk: 'breached' }) },
  { key: 'due-soon', label: 'Due soon', hint: 'Answer before the clock runs out', params: () => ({ view: 'all', slaRisk: 'at_risk' }) },
  { key: 'unassigned', label: 'Unassigned', hint: 'Nobody owns these yet', params: () => ({ view: 'all', assignedToId: 'none' }) },
  { key: 'urgent', label: 'Urgent', hint: 'Marked urgent, any status', params: () => ({ view: 'all', priority: 'URGENT' }) },
  {
    key: 'new-today',
    label: 'New today',
    hint: 'Not yet contacted, received today',
    params: (now = new Date()) => ({ view: 'all', status: 'NEW', from: ktmDay(now), to: ktmDay(now) }),
  },
  {
    key: 'bookings-week',
    label: 'Bookings this week',
    hint: 'Online bookings since Sunday',
    params: (now = new Date()) => ({ view: 'all', source: 'booking', from: weekStart(now), to: ktmDay(now) }),
  },
];

const PRESET_KEYS = [
  'view', 'slaRisk', 'assignedToId', 'source', 'from', 'to', 'status', 'priority', 'serviceId', 'requestedVisit', 'nextAction',
];

/** The keys a preset owns: all of them, less `view` for a preset that keeps it. */
const keysOf = (preset) => (preset.keepView ? PRESET_KEYS.filter((k) => k !== 'view') : PRESET_KEYS);

/** The params after applying a preset: its own values, every other filter cleared, page 1. */
export function applyPreset(params, preset, now = new Date()) {
  const cleared = Object.fromEntries(keysOf(preset).map((k) => [k, undefined]));
  return { ...params, ...cleared, q: undefined, page: 1, ...preset.params(now) };
}

/** The params with a preset switched off: back to the whole list, keeping the page size, order and (for a `keepView` preset) the view. */
export function clearPreset(params, preset) {
  return { limit: params.limit, sort: params.sort, view: preset?.keepView ? params.view : 'all', page: 1 };
}

/** The preset the current params are exactly, if any. */
export function activePreset(params, now = new Date()) {
  return LEAD_PRESETS.find((preset) => {
    const wanted = preset.params(now);
    return keysOf(preset).every((k) => String(params[k] ?? '') === String(wanted[k] ?? ''))
      && !params.q;
  })?.key ?? null;
}
