import { describe, it, expect } from 'vitest';
import {
  blankRecipeRow, deriveRequest, formRateToPaisa, isBlankRecipeRow, recipeBody, sortRecipeRows, toRecipeRows,
} from '@/helpers/recipe';

const CEMENT = { id: 'm-cem', code: 'CEM-OPC', name: 'OPC cement', unit: 'kg', packSize: 50, packLabel: 'bag' };
const MASON = { id: 'tr-mason', code: 'MASON', name: 'Mason (राजमिस्त्री)' };

/** Components as the API sends them: money in paisa, the material or trade embedded. */
const COMPONENTS = [
  { id: 'c3', kind: 'EQUIPMENT', description: 'Scaffolding hire', unit: 'lump', qty: 1, cost: 120050, sortOrder: 2 },
  { id: 'c1', kind: 'MATERIAL', materialId: 'm-cem', material: CEMENT, unit: 'kg', qty: 32, wastagePct: 5, sortOrder: 0 },
  { id: 'c2', kind: 'LABOUR', tradeId: 'tr-mason', trade: MASON, unit: 'day', qty: 1.5, wastagePct: 0, sortOrder: 1 },
];

describe('the recipe between the API and the form', () => {
  it('turns the API’s paisa into rupees and groups lines materials, labour, then equipment', () => {
    const rows = toRecipeRows(COMPONENTS);
    expect(rows.map((r) => r.kind)).toEqual(['MATERIAL', 'LABOUR', 'EQUIPMENT']);
    expect(rows[0]).toMatchObject({ materialId: 'm-cem', material: CEMENT, qty: 32, wastagePct: 5 });
    expect(rows[1]).toMatchObject({ tradeId: 'tr-mason', trade: MASON, qty: 1.5 });
    expect(rows[2]).toMatchObject({ description: 'Scaffolding hire', qty: 1, cost: 1200.5 });
    expect(toRecipeRows(undefined)).toEqual([]);
  });

  it('sends rupees and ids only, per kind, and drops a line left empty', () => {
    const rows = [
      ...toRecipeRows(COMPONENTS),
      blankRecipeRow('LABOUR'),
      { ...blankRecipeRow('OTHER'), description: ' Transport ', qty: '2', cost: 'Rs. 1,500' },
    ];
    expect(recipeBody(rows)).toEqual([
      { kind: 'MATERIAL', materialId: 'm-cem', qty: 32, wastagePct: 5 },
      { kind: 'LABOUR', tradeId: 'tr-mason', qty: 1.5 },
      { kind: 'EQUIPMENT', description: 'Scaffolding hire', qty: 1, cost: 1200.5 },
      { kind: 'OTHER', description: 'Transport', qty: 2, cost: 1500 },
    ]);
  });

  it('knows a blank row from a started one', () => {
    for (const kind of ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'OTHER']) expect(isBlankRecipeRow(blankRecipeRow(kind))).toBe(true);
    expect(isBlankRecipeRow({ ...blankRecipeRow('MATERIAL'), qty: '3' })).toBe(false);
    expect(isBlankRecipeRow({ ...blankRecipeRow('LABOUR'), tradeId: 'x' })).toBe(false);
    expect(isBlankRecipeRow({ ...blankRecipeRow('EQUIPMENT'), cost: '10' })).toBe(false);
  });

  it('keeps a section’s own order when lines are added', () => {
    const rows = sortRecipeRows([blankRecipeRow('OTHER'), { ...blankRecipeRow('MATERIAL'), qty: 1 }, blankRecipeRow('LABOUR'), { ...blankRecipeRow('MATERIAL'), qty: 2 }]);
    expect(rows.map((r) => [r.kind, r.qty])).toEqual([['MATERIAL', 1], ['MATERIAL', 2], ['LABOUR', ''], ['OTHER', '']]);
  });
});

describe('the live cost card’s request', () => {
  const values = { recipeQty: 10, overheadPct: 10, profitPct: '', roundTo: '1', components: toRecipeRows(COMPONENTS) };

  it('asks the server once every line is complete, in rupees, with blank settings as null', () => {
    expect(deriveRequest(values)).toEqual({
      ready: true,
      unfinished: 0,
      body: {
        recipeQty: 10, overheadPct: 10, profitPct: null, roundTo: 1,
        components: recipeBody(values.components),
      },
    });
  });

  it('waits while a line is unfinished, and when there is no recipe', () => {
    const half = { ...values, components: [...values.components, { ...blankRecipeRow('MATERIAL'), materialId: 'm-sand' }] };
    expect(deriveRequest(half)).toMatchObject({ ready: false, unfinished: 1, body: null });
    const noCost = { ...values, components: [{ ...blankRecipeRow('OTHER'), description: 'Transport', qty: 1 }] };
    expect(deriveRequest(noCost)).toMatchObject({ ready: false, unfinished: 1 });
    expect(deriveRequest({ recipeQty: 1, components: [] })).toMatchObject({ ready: false, unfinished: 0 });
  });

  it('treats a missing or zero batch size as one unit', () => {
    expect(deriveRequest({ ...values, recipeQty: '' }).body.recipeQty).toBe(1);
    expect(deriveRequest({ ...values, recipeQty: 0 }).body.recipeQty).toBe(1);
  });
});

describe('the form’s rate', () => {
  it('reads the form’s rate in rupees as paisa', () => {
    expect(formRateToPaisa(380)).toBe(38000);
    expect(formRateToPaisa('1,23,456.78')).toBe(12345678);
    expect(formRateToPaisa('')).toBeNull();
    expect(formRateToPaisa(undefined)).toBeNull();
  });
});
