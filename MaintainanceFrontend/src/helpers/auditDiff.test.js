import { describe, it, expect } from 'vitest';
import { diffEntries } from '@/helpers/auditDiff';

describe('diffEntries', () => {
  it('marks added, removed and changed scalar fields, and leaves out the same ones', () => {
    expect(diffEntries(
      { status: 'NEW', priority: 'NORMAL', lostReason: 'Price' },
      { status: 'LOST', priority: 'NORMAL', note: 'वर्षा पछि' },
    )).toEqual([
      { path: 'status', kind: 'changed', before: 'NEW', after: 'LOST' },
      { path: 'lostReason', kind: 'removed', before: 'Price', after: undefined },
      { path: 'note', kind: 'added', before: undefined, after: 'वर्षा पछि' },
    ]);
    expect(diffEntries({ a: 1 }, { a: 1 }, { includeSame: true })).toEqual([{ path: 'a', kind: 'same', before: 1, after: 1 }]);
  });

  it('a create is all added and a delete all removed', () => {
    expect(diffEntries(null, { name: 'Sita', total: 0 }).map((e) => e.kind)).toEqual(['added', 'added']);
    expect(diffEntries({ name: 'Sita' }, null)).toEqual([{ path: 'name', kind: 'removed', before: 'Sita', after: undefined }]);
    expect(diffEntries(null, null)).toEqual([]);
  });

  it('walks nested objects to the field that moved', () => {
    expect(diffEntries(
      { translations: { name: { en: 'Seepage', ne: 'चुहावट' } }, meta: { a: { b: 1 } } },
      { translations: { name: { en: 'Seepage repair', ne: 'चुहावट' } }, meta: { a: { b: 1, c: null } } },
    )).toEqual([
      { path: 'translations.name.en', kind: 'changed', before: 'Seepage', after: 'Seepage repair' },
      { path: 'meta.a.c', kind: 'added', before: undefined, after: null },
    ]);
  });

  it('keeps a setting key with dots whole, and an object replacing a value is a change', () => {
    expect(diffEntries({ 'contact.phones': ['01-5407720'] }, { 'contact.phones': ['01-5407720', '9808338255'] })).toEqual([
      { path: 'contact.phones', kind: 'changed', before: ['01-5407720'], after: ['01-5407720', '9808338255'] },
    ]);
    expect(diffEntries({ skills: 'plumbing' }, { skills: { main: 'plumbing' } })).toEqual([
      { path: 'skills', kind: 'changed', before: 'plumbing', after: { main: 'plumbing' } },
    ]);
  });

  it('indexes arrays of objects by position', () => {
    expect(diffEntries(
      { items: [{ qty: 1, unit: 'sq.ft' }] },
      { items: [{ qty: 2, unit: 'sq.ft' }, { qty: 5, unit: 'nos' }] },
    )).toEqual([
      { path: 'items.0.qty', kind: 'changed', before: 1, after: 2 },
      { path: 'items.1', kind: 'added', before: undefined, after: { qty: 5, unit: 'nos' } },
    ]);
  });

  it('an empty object that gains keys lists the keys', () => {
    expect(diffEntries({ values: {} }, { values: { x: 1 } })).toEqual([{ path: 'values.x', kind: 'added', before: undefined, after: 1 }]);
    expect(diffEntries({ values: {} }, { values: null })).toEqual([{ path: 'values', kind: 'changed', before: {}, after: null }]);
  });
});
