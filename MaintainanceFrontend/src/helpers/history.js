import { AUDIT_EVENT_LABELS, AUDIT_MODEL_LABELS } from '@/config/auditEvents';
import { ACTIVITY_LABELS, LEAD_STATUS_LABELS } from '@/config/constants';
import { titleCase } from '@/helpers/format';

const VERBS = { create: 'added', update: 'changed', delete: 'deleted' };

/**
 * One audit row as a History line: a label, and the detail line beneath it.
 *
 * A named event reads as the business moment ("Status changed"); a plain model row
 * reads as what happened to which kind of record ("Lead changed", "Site added").
 *
 * @param {{ event?: string|null, action: string, model: string, before?: object, after?: object, changes?: object }} entry
 * @returns {{ label: string, detail: string|null }}
 */
export function describeHistoryEntry(entry) {
  const { event, action, model, before, after, changes } = entry;
  if (event) {
    const label = AUDIT_EVENT_LABELS[event] ?? titleCase(event.replace('.', ' '));
    return { label, detail: eventDetail(entry) };
  }
  const noun = AUDIT_MODEL_LABELS[model] ?? model;
  const label = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${VERBS[action] ?? action}`;
  const fields = diffRows(before, after, changes).map((r) => r.field);
  return { label, detail: fields.length && action === 'update' ? fields.map(fieldLabel).join(', ') : null };
}

function eventDetail({ event, before, after, changes }) {
  switch (event) {
    case 'lead.status_changed':
      return `${statusLabel(before?.status)} → ${statusLabel(after?.status)}${changes?.note ? ` · ${changes.note}` : ''}`;
    case 'lead.activity_logged':
      return [ACTIVITY_LABELS[changes?.type] ?? changes?.type, changes?.summary].filter(Boolean).join(' · ')
        + (after?.firstResponseAt ? ' · stopped the response clock' : '');
    case 'lead.merged':
      return changes?.duplicateIds ? `${changes.duplicateIds.length} duplicate lead(s)` : null;
    case 'lead.assigned':
      return after?.assignedToId ? null : 'Unassigned';
    case 'customer.email_confirmed':
      return `${before?.email ?? 'no email'} → ${after?.email}`;
    default:
      return changes?.note ?? null;
  }
}

const statusLabel = (s) => LEAD_STATUS_LABELS[s] ?? (s ? titleCase(s) : '—');

/** `firstResponseAt` → "First response at". */
export const fieldLabel = (key) => {
  const words = String(key).replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The fields a row touched, with their before and after values, for the expandable diff.
 * A create has only afters, a delete only befores; `changes` (an event's extra detail)
 * is listed as afters when there is nothing else.
 *
 * @returns {{ field: string, before: unknown, after: unknown }[]}
 */
export function diffRows(before, after, changes) {
  const b = before ?? {};
  const a = after ?? (before ? {} : changes ?? {});
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .map((field) => ({ field, before: b[field], after: a[field] }));
}

/** A diff value as text. Money is not special-cased: the row holds what the column holds. */
export function formatDiffValue(value) {
  if (value === undefined) return '';
  if (value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * One line per thing that happened. A named event and the plain row writes of the same
 * request and record are one step ("Status changed" and "Lead changed · status"), so the
 * row writes fold into the event: their fields join its before/after, and they are not
 * listed on their own. Rows from a request with no event for the record stay as they are.
 *
 * @param {object[]} entries  one page of history, newest first
 * @returns {object[]}
 */
export function foldHistory(entries = []) {
  const key = (e) => (e.requestId ? `${e.requestId}|${e.model}|${e.recordId}` : null);
  const eventsByKey = new Map();
  for (const e of entries) {
    if (e.event && key(e)) {
      const list = eventsByKey.get(key(e)) ?? [];
      list.push(e);
      eventsByKey.set(key(e), list);
    }
  }
  const absorbed = new Map(); // event id → row writes
  const out = [];
  for (const e of entries) {
    const events = !e.event && key(e) ? eventsByKey.get(key(e)) : null;
    if (!events?.length) {
      out.push(e);
      continue;
    }
    // The event that already speaks about most of these fields; else the first.
    const fields = Object.keys({ ...e.before, ...e.after });
    const overlap = (ev) => fields.filter((f) => f in { ...ev.before, ...ev.after }).length;
    const host = events.reduce((best, ev) => (overlap(ev) > overlap(best) ? ev : best), events[0]);
    absorbed.set(host.id, [...(absorbed.get(host.id) ?? []), e]);
  }
  return out.map((e) => {
    const rows = absorbed.get(e.id);
    if (!rows) return e;
    const before = { ...e.before };
    const after = { ...e.after };
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.before ?? {})) if (!(k in before)) before[k] = v;
      for (const [k, v] of Object.entries(r.after ?? {})) if (!(k in after)) after[k] = v;
    }
    return { ...e, before, after };
  });
}
