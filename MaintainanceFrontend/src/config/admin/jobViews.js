import { ktmDay } from '@/helpers/dispatchBoard';

/**
 * The jobs list's one-click views, all kept in the URL, so a view can be bookmarked and shared.
 * Each is a set of list params; applying one clears every key the others set. `from` / `to` are
 * Kathmandu days (the API reads them that way).
 */
export const JOB_PRESETS = [
  { key: 'today', label: 'Today', params: (now = new Date()) => ({ from: ktmDay(now), to: ktmDay(now) }) },
  { key: 'unassigned', label: 'Unassigned', params: () => ({ unassigned: 'true' }) },
  { key: 'on-hold', label: 'On hold', params: () => ({ status: 'ON_HOLD' }) },
  { key: 'to-verify', label: 'Completed, not verified', params: () => ({ status: 'COMPLETED' }) },
  { key: 'not-invoiced', label: 'Not invoiced', params: () => ({ invoiced: 'false' }) },
];

const PRESET_KEYS = ['status', 'type', 'priority', 'technicianId', 'customerId', 'unassigned', 'invoiced', 'from', 'to'];

/** The params after applying a preset: its own values, every other filter cleared, page 1. */
export function applyJobPreset(params, preset, now = new Date()) {
  const cleared = Object.fromEntries(PRESET_KEYS.map((k) => [k, undefined]));
  return { ...params, ...cleared, q: undefined, page: 1, ...preset.params(now) };
}

/** The preset the current params are exactly, if any. */
export function activeJobPreset(params, now = new Date()) {
  return JOB_PRESETS.find((preset) => {
    const wanted = preset.params(now);
    return PRESET_KEYS.every((k) => String(params[k] ?? '') === String(wanted[k] ?? '')) && !params.q;
  })?.key ?? null;
}

/** Customers, as the job forms and filters pick them. */
export const CUSTOMER_RELATION = { path: '/admin/customers', labelKey: (r) => (r.phone ? `${r.name} · ${r.phone}` : r.name) };
export const TECHNICIAN_RELATION = { path: '/admin/technicians', labelKey: (r) => r.user?.name ?? r.employeeCode ?? r.id };
export const TEMPLATE_RELATION = { path: '/admin/job-templates', labelKey: 'name', params: { onlyActive: 'true' } };
export const MATERIAL_RELATION = {
  path: '/admin/materials', labelKey: (r) => `${r.code} · ${r.name} (${r.unit})`, params: { onlyActive: 'true' },
};

/** A technician as a choice in a checklist: name, and what helps pick them. */
export function technicianOption(t) {
  const bits = [
    t.user?.role === 'SURVEYOR' ? 'Surveyor' : null,
    t.skills?.length ? t.skills.slice(0, 3).join(', ') : null,
    `${t.loadThisWeek ?? 0} job${t.loadThisWeek === 1 ? '' : 's'} this week`,
    t.isAvailable === false ? 'unavailable' : null,
  ].filter(Boolean);
  return { value: t.id, label: t.user?.name ?? t.employeeCode ?? t.id, description: bits.join(' · ') };
}
