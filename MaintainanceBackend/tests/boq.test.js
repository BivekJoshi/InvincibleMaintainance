import { describe, it, expect } from 'vitest';
import { boqNumbers } from '../src/services/boq.service.js';

describe('BOQ numbering (Phase L3)', () => {
  it('sections are lettered, items numbered within them, notes unnumbered', () => {
    const rows = [
      { rowType: 'ITEM' }, { rowType: 'ITEM' },
      { rowType: 'SECTION' }, { rowType: 'ITEM' }, { rowType: 'NOTE' }, { rowType: 'ITEM' },
      { rowType: 'SECTION' }, { rowType: 'NOTE' }, { rowType: 'ITEM' },
    ];
    expect(boqNumbers(rows)).toEqual(['1', '2', 'A', 'A.1', null, 'A.2', 'B', null, 'B.1']);
  });

  it('runs past Z the way a spreadsheet does', () => {
    const numbers = boqNumbers(Array.from({ length: 28 }, () => ({ rowType: 'SECTION' })));
    expect(numbers.slice(24)).toEqual(['Y', 'Z', 'AA', 'AB']);
  });
});
