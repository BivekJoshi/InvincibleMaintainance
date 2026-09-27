import { describe, expect, it } from 'vitest';
import {
  isMultiCell, parseClipboard, parseGridNumber, pastedBoqRows, readPastedRows,
} from './gridPaste';

describe('parseClipboard', () => {
  it('splits Excel TSV into rows and cells, dropping the trailing newline and empty rows', () => {
    expect(parseClipboard('a\tb\r\nc\td\r\n\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('reads quoted cells with tabs, newlines and doubled quotes', () => {
    expect(parseClipboard('"Wall, 9"" thick\nwith plaster"\tnos\n')).toEqual([['Wall, 9" thick\nwith plaster', 'nos']]);
  });

  it('knows one cell from a range', () => {
    expect(isMultiCell('1,250\n')).toBe(false);
    expect(isMultiCell('a\tb')).toBe(true);
    expect(isMultiCell('a\nb')).toBe(true);
  });
});

describe('parseGridNumber', () => {
  it('reads Indian digit grouping and strips Rs / Rs. / NPR', () => {
    expect(parseGridNumber('1,23,456.50')).toBe(123456.5);
    expect(parseGridNumber('Rs 1,200')).toBe(1200);
    expect(parseGridNumber('Rs. 95.50')).toBe(95.5);
    expect(parseGridNumber('rs.1,00,000/-')).toBe(100000);
    expect(parseGridNumber('NPR 500')).toBe(500);
    expect(parseGridNumber('12.5%')).toBe(12.5);
  });

  it('treats blank and a dash as empty, and anything else as unreadable', () => {
    expect(parseGridNumber('')).toBeUndefined();
    expect(parseGridNumber(' - ')).toBeUndefined();
    expect(parseGridNumber('—')).toBeUndefined();
    expect(parseGridNumber('twelve')).toBeNaN();
    expect(parseGridNumber('-5')).toBeNaN();
  });
});

describe('pastedBoqRows', () => {
  it('pastes description · unit · qty · rate in order, rupees as typed in Excel', () => {
    expect(pastedBoqRows('Brick wall 9"\tcu.ft\t1,250\tRs. 1,23,456.50\n')).toEqual([
      { rowType: 'ITEM', description: 'Brick wall 9"', unit: 'cu.ft', qty: 1250, rate: 123456.5 },
    ]);
  });

  it('turns a row with text but no quantity and no rate into a section', () => {
    const rows = pastedBoqRows('SUBSTRUCTURE\t\t\t\nExcavation\tcu.m\t45\t650\nसतह तयारी\n');
    expect(rows).toEqual([
      { rowType: 'SECTION', description: 'SUBSTRUCTURE' },
      { rowType: 'ITEM', description: 'Excavation', unit: 'cu.m', qty: 45, rate: 650 },
      { rowType: 'SECTION', description: 'सतह तयारी' },
    ]);
  });

  it('keeps an item that has a quantity but no rate yet as an item', () => {
    expect(pastedBoqRows('Plaster\tsq.ft\t120\t\n')).toEqual([
      { rowType: 'ITEM', description: 'Plaster', unit: 'sq.ft', qty: 120, rate: '' },
    ]);
  });

  it('detects a header row, maps columns by it, and ignores the ones it does not know', () => {
    const text = [
      'S.N.\tParticulars\tQty\tUnit\tRate (Rs)\tAmount',
      'A\tFLOORING\t\t\t\t',
      '1\tVitrified tiles 600x600\t320\tsq.ft\t1,450.00\t4,64,000.00',
    ].join('\n');
    const { header } = readPastedRows(text, [{ key: 'description', aliases: ['particulars'] }, { key: 'qty', aliases: ['qty'] }]);
    expect(header).toBe(true);
    expect(pastedBoqRows(text)).toEqual([
      { rowType: 'SECTION', description: 'FLOORING' },
      { rowType: 'ITEM', description: 'Vitrified tiles 600x600', unit: 'sq.ft', qty: 320, rate: 1450 },
    ]);
  });

  it('drops a leading serial-number column when there is no header', () => {
    const text = 'A\tWATERPROOFING\t\t\t\t\nA.1\tTerrace membrane\tsq.ft\t800\t275\t2,20,000\n';
    expect(pastedBoqRows(text)).toEqual([
      { rowType: 'SECTION', description: 'WATERPROOFING' },
      { rowType: 'ITEM', description: 'Terrace membrane', unit: 'sq.ft', qty: 800, rate: 275 },
    ]);
  });

  it('keeps an unreadable number as the text, for the form to flag', () => {
    expect(pastedBoqRows('Paint\tsq.ft\tabout 40\t45\n')[0]).toMatchObject({ qty: 'about 40', rate: 45 });
  });
});
