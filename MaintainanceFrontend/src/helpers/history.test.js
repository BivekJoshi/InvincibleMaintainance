import { describe, it, expect } from 'vitest';
import { describeHistoryEntry, diffRows, fieldLabel, foldHistory, formatDiffValue } from '@/helpers/history';

const base = { model: 'Lead', recordId: 'l1', requestId: 'r1', actorType: 'user', createdAt: '2026-09-16T05:00:00Z' };

describe('history lines', () => {
  it('names events and plain row writes in plain words', () => {
    expect(describeHistoryEntry({ ...base, event: 'lead.status_changed', before: { status: 'NEW' }, after: { status: 'INSPECTION_SCHEDULED' }, changes: { note: 'Lead converted' } }))
      .toEqual({ label: 'Status changed', detail: 'New → Visit booked · Lead converted' });
    expect(describeHistoryEntry({ ...base, event: 'lead.assigned', after: { assignedToId: null } }))
      .toEqual({ label: 'Assigned', detail: 'Unassigned' });
    expect(describeHistoryEntry({ ...base, event: 'customer.email_confirmed', model: 'Customer', before: { email: null }, after: { email: 'a@b.np' } }).detail)
      .toBe('no email → a@b.np');
    expect(describeHistoryEntry({ ...base, event: null, action: 'update', before: { priority: 'NORMAL', firstResponseAt: null }, after: { priority: 'HIGH', firstResponseAt: 'x' } }))
      .toEqual({ label: 'Lead changed', detail: 'Priority, First response at' });
    expect(describeHistoryEntry({ ...base, event: null, action: 'create', model: 'CustomerSite', after: { label: 'Home' } }))
      .toEqual({ label: 'Site added', detail: null });
  });

  it('lists the diff, and words the values', () => {
    expect(diffRows({ status: 'NEW' }, { status: 'LOST', lostReason: 'Price' })).toEqual([
      { field: 'status', before: 'NEW', after: 'LOST' },
      { field: 'lostReason', before: undefined, after: 'Price' },
    ]);
    expect(diffRows(null, null, { type: 'call' })).toEqual([{ field: 'type', before: undefined, after: 'call' }]);
    expect(fieldLabel('assignedToId')).toBe('Assigned to');
    expect(formatDiffValue(null)).toBe('—');
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
    expect(formatDiffValue('नेपाली')).toBe('नेपाली');
  });
});

describe('folding a request into its event', () => {
  it('shows a status change once, with the row write’s extra fields in its details', () => {
    const event = { ...base, id: 'e1', event: 'lead.status_changed', action: 'status_changed', before: { status: 'NEW' }, after: { status: 'LOST' } };
    const row = { ...base, id: 'm1', event: null, action: 'update', before: { status: 'NEW', closedAt: null }, after: { status: 'LOST', closedAt: 'T' } };
    const other = { ...base, id: 'm2', requestId: 'r2', event: null, action: 'update', before: { area: null }, after: { area: 'Patan' } };
    const folded = foldHistory([event, row, other]);
    expect(folded.map((e) => e.id)).toEqual(['e1', 'm2']);
    expect(folded[0].before).toEqual({ status: 'NEW', closedAt: null });
    expect(folded[0].after).toEqual({ status: 'LOST', closedAt: 'T' });
  });

  it('never folds another record’s rows, or rows with no request', () => {
    const event = { ...base, id: 'e1', event: 'lead.converted', before: { customerId: null }, after: { customerId: 'c1' } };
    const note = { ...base, id: 'm1', model: 'LeadNote', recordId: 'n1', event: null, action: 'create', after: { note: 'x' } };
    const system = { ...base, id: 'm2', requestId: null, event: null, action: 'update', after: { slaBreached: true } };
    expect(foldHistory([event, note, system]).map((e) => e.id)).toEqual(['e1', 'm1', 'm2']);
  });

  it('gives each row write to the event that already names its fields', () => {
    const contacted = { ...base, id: 'e1', event: 'lead.status_changed', before: { status: 'NEW' }, after: { status: 'CONTACTED' } };
    const converted = { ...base, id: 'e2', event: 'lead.converted', before: { customerId: null }, after: { customerId: 'c1' } };
    const link = { ...base, id: 'm1', event: null, action: 'update', before: { customerId: null }, after: { customerId: 'c1' } };
    const folded = foldHistory([contacted, converted, link]);
    expect(folded.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(folded[0].after).toEqual({ status: 'CONTACTED' });
  });
});
