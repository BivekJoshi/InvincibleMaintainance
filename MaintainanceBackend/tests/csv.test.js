import { describe, it, expect } from 'vitest';
import { CSV_MAX_ROWS, day, money, text, toCsv } from '../src/utils/csv.js';

describe('toCsv (Phase I report downloads)', () => {
  const columns = [text('Invoice', (r) => r.number), text('Customer', (r) => r.name), money('Amount (Rs)', (r) => r.amount), day('Due', (r) => r.due)];

  it('money as exact rupees (signed), Kathmandu dates, quoting and Devanagari', () => {
    const { csv, rows, truncated } = toCsv(columns, [
      { number: 'INV-1', name: 'राम, "बहादुर"', amount: 123456, due: new Date('2026-07-16T18:15:00Z') },
      { number: 'INV-2', name: 'Sita', amount: -5, due: null },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'Invoice,Customer,Amount (Rs),Due',
      'INV-1,"राम, ""बहादुर""",1234.56,2026-07-17',
      'INV-2,Sita,-0.05,',
    ]);
    expect(rows).toBe(2);
    expect(truncated).toBe(false);
  });

  it('a text a spreadsheet would run as a formula is defused', () => {
    const { csv } = toCsv([text('Note', (r) => r.note)], [{ note: '=HYPERLINK("x")' }, { note: '-2+3' }, { note: '@SUM(A1)' }]);
    expect(csv.split('\r\n').slice(1)).toEqual([`"'=HYPERLINK(""x"")"`, `"'-2+3"`, `"'@SUM(A1)"`]);
  });

  it('never unbounded', () => {
    const many = Array.from({ length: CSV_MAX_ROWS + 5 }, (_, i) => ({ number: `INV-${i}`, amount: i }));
    const out = toCsv(columns, many);
    expect(out.rows).toBe(CSV_MAX_ROWS);
    expect(out.truncated).toBe(true);
    expect(out.csv.split('\r\n')).toHaveLength(CSV_MAX_ROWS + 1);
  });
});
