import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, approveAndSend, createCustomer, expectStatus, findKeys, prisma, uid,
} from './helpers.js';
import { COST_KEYS } from '../../src/utils/moneyWall.js';

/** Phase L3: the quotation as a bill of quantities — sections, measured rows, frozen recipes, the cost wall. */

let sales;
let manager;
let dispatcher;
let customer;
const lib = {};
const costKeys = (value) => findKeys(value, (k) => COST_KEYS.includes(k));

/**
 * The worked BOQ (paisa):
 *   A  Waterproofing
 *   A.1 Plaster, measured: 2 × 12 × 9 = 216 less a door 3 × 7 = 21 → 195 sq.ft × Rs 60   = 11,70,000
 *       (a NOTE row, unnumbered)
 *   B  Materials
 *   B.1 OPC cement 10 bags + 5% wastage = 10.5 × Rs 980                               = 10,29,000
 *   B.2 Furniture shifting, OPTIONAL, 1 × Rs 2,000 — priced, not totalled             =  2,00,000
 *   C  Sundries
 *   C.1 Debris removal 2 trips × Rs 1,500 (no cost known)                              =  3,00,000
 *   subtotal 24,99,000 · VAT 13% 3,24,870 · total 28,23,870
 */
const boqRows = () => [
  { rowType: 'SECTION', description: 'Waterproofing' },
  {
    rateCardItemId: lib.plaster.id, kind: 'SERVICE', description: 'Internal plaster 12 mm', unit: 'sq.ft', rate: 60,
    measurements: [
      { area: 'Bedroom', description: 'Long walls', nos: 2, l: 12, h: 9 },
      { area: 'Bedroom', description: 'Door', l: 3, h: 7, deduct: true },
    ],
  },
  { rowType: 'NOTE', description: 'Surfaces must be dry before treatment.' },
  { rowType: 'SECTION', description: 'Materials' },
  { kind: 'MATERIAL', materialId: lib.cement.id, description: 'OPC cement', unit: 'bag', qty: 10, wastagePct: 5, rate: 980 },
  { description: 'Furniture shifting', unit: 'lump', qty: 1, rate: 2000, isOptional: true },
  { rowType: 'SECTION', description: 'Sundries' },
  { description: 'Debris removal', unit: 'trip', qty: 2, rate: 1500 },
];

const createBoq = async (items = boqRows(), client = sales) => expectStatus(await client.post('/admin/quotations').send({
  customerId: customer.id, items,
}), 201).data;

beforeAll(async () => {
  [sales, manager, dispatcher] = await Promise.all([as('SALES'), as('MANAGER'), as('DISPATCHER')]);
  customer = await createCustomer(sales);
  const material = async (code, unit, purchaseRate, extra = {}) => expectStatus(await dispatcher.post('/admin/materials').send({
    code: `${code}-${uid()}`, name: `${code} (L3)`, unit, purchaseRate, sellRate: purchaseRate * 1.2, ...extra,
  }), 201).data;
  const trade = async (code, dayWage) => expectStatus(await manager.post('/admin/trades').send({ code: `${code}-${uid()}`, name: `${code} (L3)`, dayWage }), 201).data;
  lib.cement = await material('CEM', 'bag', 850, { packSize: 1, packLabel: '50 kg bag' });
  lib.sand = await material('SAND', 'cu.ft', 95, { packSize: 100, packLabel: 'tractor trip' });
  lib.mason = await trade('MASON', 1500);
  lib.helper = await trade('HELPER', 1000);
  // The L2 plaster recipe: unit cost 4927 paisa a sq.ft (the hand calculation in 17-rate-library).
  lib.plaster = expectStatus(await manager.post('/admin/rate-card').send({
    code: `PLASTER-${uid()}`, name: 'Internal plaster (L3)', unit: 'sq.ft', rateMode: 'DERIVED', recipeQty: 100,
    overheadPct: 10, profitPct: 15, roundTo: 1,
    components: [
      { kind: 'MATERIAL', materialId: lib.cement.id, qty: 0.9, wastagePct: 2 },
      { kind: 'MATERIAL', materialId: lib.sand.id, qty: 5.5, wastagePct: 5 },
      { kind: 'LABOUR', tradeId: lib.mason.id, qty: 1.2 },
      { kind: 'LABOUR', tradeId: lib.helper.id, qty: 1.2 },
      { kind: 'OTHER', description: 'Scaffolding and curing water', qty: 1, cost: 150 },
    ],
  }), 201).data;
});

describe('a BOQ', () => {
  it('saves exactly what the preview showed — sections, measured and optional rows, to the paisa', async () => {
    const preview = expectStatus(await sales.post('/admin/quotations/preview').send({ items: boqRows() }), 200).data;
    const q = await createBoq();
    expect(preview.totals).toMatchObject({ subtotal: 2499000, vatAmount: 324870, total: 2823870, optionalTotal: 200000 });
    expect(q).toMatchObject({ subtotal: 2499000, vatAmount: 324870, total: 2823870 });
    expect(q.items.map((r) => r.number)).toEqual(['A', 'A.1', null, 'B', 'B.1', 'B.2', 'C', 'C.1']);
    expect(preview.items.map((r) => r.number)).toEqual(q.items.map((r) => r.number));
    expect(q.items.map((r) => r.amount)).toEqual([0, 1170000, 0, 0, 1029000, 200000, 0, 300000]);
    expect(q.items[1]).toMatchObject({ netQty: 195, qty: 195, rowType: 'ITEM' });
    expect(q.items[4]).toMatchObject({ netQty: 10, qty: 10.5, wastagePct: 5 });
    expect(q.boq.sections.map((sec) => [sec.number, sec.title, sec.subtotal])).toEqual([
      ['A', 'Waterproofing', 1170000], ['B', 'Materials', 1029000], ['C', 'Sundries', 300000],
    ]);
    expect(q.boq.optionalTotal).toBe(200000);
  });

  it('refuses a line that is not positive: typed, or measured with too much deducted', async () => {
    const typed = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Credit', unit: 'lump', qty: -5, rate: 100 }],
    }), 422);
    expect(typed.error.code).toBe('NEGATIVE_LINE');
    const measured = expectStatus(await sales.post('/admin/quotations/preview').send({
      items: [{ description: 'Over-deducted', unit: 'sq.ft', rate: 10, measurements: [{ l: 2, h: 2 }, { l: 3, h: 3, deduct: true }] }],
    }), 422);
    expect(measured.error.code).toBe('NEGATIVE_LINE');
  });

  it('a blank draft is allowed; submitting needs a priced, non-optional row', async () => {
    const blank = await createBoq([]);
    expect(blank.total).toBe(0);
    const onlyOptional = await createBoq([{ description: 'Maybe', unit: 'lump', qty: 1, rate: 100, isOptional: true }]);
    for (const q of [blank, onlyOptional]) {
      expect(expectStatus(await sales.post(`/admin/quotations/${q.id}/submit`), 422).error.code).toBe('QUOTATION_INCOMPLETE');
    }
  });

  it('the discount helpers are the server\'s: a percentage, and a target total landed to the paisa', async () => {
    const pct = expectStatus(await sales.post('/admin/quotations/preview').send({ items: boqRows(), discountPct: 5 }), 200).data;
    expect(pct.totals.discount).toBe(124950);
    // "Rs 26,000 flat" is reachable exactly; Rs 27,000 is not — 13% VAT rounds either side of it — so the
    // helper lands on the nearest total below it, never above.
    const flat = expectStatus(await sales.post('/admin/quotations/preview').send({ items: boqRows(), targetTotal: 26000 }), 200).data;
    expect(flat.totals.total).toBe(2600000);
    const near = expectStatus(await sales.post('/admin/quotations/preview').send({ items: boqRows(), targetTotal: 27000 }), 200).data;
    expect(near.totals.total).toBe(2699999);
  });
});

describe('frozen recipes and cost (L-D1, L-D4)', () => {
  let q;
  beforeAll(async () => { q = await createBoq(); });

  it('a library row freezes its recipe and unit cost; a MATERIAL row its purchase rate; nothing known is not zero', async () => {
    const got = expectStatus(await manager.get(`/admin/quotations/${q.id}`), 200).data;
    expect(got.items[1].recipe).toMatchObject({ v: 1, rateCardItemId: lib.plaster.id, recipeQty: 100, unitCost: 4927, complete: true });
    expect(got.items[1]).toMatchObject({ unitCost: 4927, costAmount: 960765 });
    expect(got.items[4]).toMatchObject({ unitCost: 85000, costAmount: 892500 });
    expect(got.items[7]).toMatchObject({ unitCost: null, costAmount: null });
    // Debris removal has no known cost, so the BOQ's margin is unknown rather than flattered.
    expect(got.boq.cost).toMatchObject({ costComplete: false, margin: null });
  });

  it('with every cost known, the margin is on the taxable amount', async () => {
    const rows = boqRows().filter((r) => r.description !== 'Debris removal' && r.description !== 'Sundries');
    const preview = expectStatus(await manager.post('/admin/quotations/preview').send({ items: rows }), 200).data;
    // taxable 11,70,000 + 10,29,000 = 21,99,000 · cost 9,60,765 + 8,92,500 = 18,53,265 · margin 3,45,735 = 15.72%
    expect(preview.cost).toEqual({ costTotal: 1853265, costComplete: true, margin: { amount: 345735, pct: 15.72 } });
  });

  it('a cost the client sends is ignored', async () => {
    const sneaky = await createBoq([{
      rateCardItemId: lib.plaster.id, description: 'Plaster', unit: 'sq.ft', qty: 100, rate: 60,
      unitCost: 1, costAmount: 1, recipe: { v: 1, unitCost: 1, components: [] },
    }]);
    const got = expectStatus(await manager.get(`/admin/quotations/${sneaky.id}`), 200).data;
    expect(got.items[0]).toMatchObject({ unitCost: 4927, costAmount: 492700 });
    expect(got.items[0].recipe.components).toHaveLength(5);
  });

  it('a library price change never reaches the row; a reprice on the draft does — preview first', async () => {
    const draft = await createBoq();
    // Cement Rs 850 → 950: the plaster recipe's unit cost becomes 5028 (see 17-rate-library).
    expectStatus(await dispatcher.put(`/admin/materials/${lib.cement.id}`).send({ purchaseRate: 950 }), 200);
    const still = expectStatus(await manager.get(`/admin/quotations/${draft.id}`), 200).data;
    expect(still.items[1]).toMatchObject({ unitCost: 4927, rate: 6000 });
    expect(still.items[1].recipe.components[0].cost).toBe(85000);

    const preview = expectStatus(await manager.post(`/admin/quotations/${draft.id}/reprice`).send({ apply: false }), 200).data;
    expect(preview.applied).toBe(0);
    expect(preview.rows).toContainEqual(expect.objectContaining({ number: 'A.1', rate: 6000, newRate: lib.plaster.rate, unitCost: 4927, newUnitCost: 5028 }));
    expect((await prisma.quotationItem.findFirst({ where: { quotationId: draft.id, rateCardItemId: lib.plaster.id } })).unitCost).toBe(4927);

    const applied = expectStatus(await manager.post(`/admin/quotations/${draft.id}/reprice`).send({ apply: true }), 200).data;
    expect(applied.applied).toBeGreaterThan(0);
    expect(applied.quotation.items[1]).toMatchObject({ unitCost: 5028, rate: lib.plaster.rate });
    expect(applied.quotation.items[1].recipe.components[0].cost).toBe(95000);
    // Put cement back, for the tests that follow.
    expectStatus(await dispatcher.put(`/admin/materials/${lib.cement.id}`).send({ purchaseRate: 850 }), 200);
  });

  it('only a draft is repriced', async () => {
    const sent = await createBoq();
    await approveAndSend(sent.id);
    expect(expectStatus(await manager.post(`/admin/quotations/${sent.id}/reprice`).send({ apply: false }), 422).error.code).toBe('QUOTATION_NOT_DRAFT');
  });

  it('SALES sees rates and quantities and no cost — quotation, preview, take-off, history, the customer\'s view', async () => {
    const got = expectStatus(await sales.get(`/admin/quotations/${q.id}`), 200).data;
    const preview = expectStatus(await sales.post('/admin/quotations/preview').send({ items: boqRows() }), 200).data;
    const takeoff = expectStatus(await sales.get(`/admin/quotations/${q.id}/takeoff`), 200).data;
    const history = expectStatus(await sales.get(`/admin/quotations/${q.id}/history`), 200).data;
    for (const body of [got, preview, takeoff, history]) expect(costKeys(body)).toEqual([]);
    expect(got.items[1].recipe.components[0]).toMatchObject({ kind: 'MATERIAL', qty: 0.9, wastagePct: 2 });
    expect(got.items[1].rate).toBe(6000);
    // The manager's read of the same carries it.
    expect(costKeys(expectStatus(await manager.get(`/admin/quotations/${q.id}`), 200).data).length).toBeGreaterThan(0);
    const { publicToken } = await approveAndSend((await createBoq()).id);
    const pub = expectStatus(await anon().get(`/public/quotations/${publicToken}`), 200).data;
    expect(costKeys(pub)).toEqual([]);
    expect(pub.items.map((r) => r.rowType)).toEqual(['SECTION', 'ITEM', 'NOTE', 'SECTION', 'ITEM', 'ITEM', 'SECTION', 'ITEM']);
    expect(pub.items.every((r) => r.recipe === undefined && r.measurements === undefined)).toBe(true);
    expect(pub.boq).toEqual({ sections: expect.any(Array), optionalTotal: 200000 });
    expect(pub.boq.sections.map((sec) => sec.subtotal)).toEqual([1170000, 1029000, 300000]);
  });
});

describe('the take-off', () => {
  it('scales each recipe by its row, adds the MATERIAL rows, in buying units with stock and shortfall', async () => {
    const q = await createBoq();
    const takeoff = expectStatus(await manager.get(`/admin/quotations/${q.id}/takeoff`), 200).data;
    // Plaster 195 sq.ft on a recipe per 100: cement 0.9 × 1.95 × 1.02 = 1.790 bags; sand 5.5 × 1.95 × 1.05 = 11.261 cu.ft;
    // mason and helper 1.2 × 1.95 = 2.34 days each. The cement row adds its 10.5 bags → 12.29 bags.
    const cement = takeoff.materials.find((m) => m.materialId === lib.cement.id);
    expect(cement).toMatchObject({ qty: 12.29, packSize: 1, packs: 13, packLabel: '50 kg bag', onHand: 0, shortfall: 12.29 });
    expect(takeoff.materials.find((m) => m.materialId === lib.sand.id)).toMatchObject({ qty: 11.261, packs: 1 });
    expect(takeoff.labour.map((l) => [l.tradeId, l.days]).sort()).toEqual([[lib.helper.id, 2.34], [lib.mason.id, 2.34]].sort());
    expect(takeoff.other).toContainEqual(expect.objectContaining({ description: 'Scaffolding and curing water', qty: 1.95 }));
    // The optional row is left out; the unpriced debris row is listed as having no recipe.
    expect(takeoff.rowsWithoutRecipe.map((r) => r.number)).toEqual(['C.1']);
  });
});

describe('revisions, copies and old quotations', () => {
  const shape = (rows) => rows.map(({ rowType, description, measurements, netQty, qty, wastagePct, rate, isOptional, recipe, unitCost }) => ({
    rowType, description, measurements, netQty, qty, wastagePct, rate, isOptional, recipe, unitCost,
  }));

  it('a revision copies rows, measurements and frozen recipes as they are', async () => {
    const q = await createBoq();
    await approveAndSend(q.id);
    const v2 = expectStatus(await sales.post(`/admin/quotations/${q.id}/revise`), 201).data;
    const [a, b] = await Promise.all([
      expectStatus(await manager.get(`/admin/quotations/${q.id}`), 200).data,
      expectStatus(await manager.get(`/admin/quotations/${v2.id}`), 200).data,
    ]);
    expect(shape(b.items)).toEqual(shape(a.items));
    expect(b.total).toBe(a.total);
  });

  it('copy makes a new draft with the same rows, for another customer', async () => {
    const q = await createBoq();
    const other = await createCustomer(sales);
    const copy = expectStatus(await sales.post(`/admin/quotations/${q.id}/copy`).send({ customerId: other.id }), 201).data;
    expect(copy).toMatchObject({ status: 'DRAFT', version: 1, customerId: other.id, total: q.total });
    expect(copy.number).not.toBe(q.number);
    expect(copy.items.map((r) => r.number)).toEqual(q.items.map((r) => r.number));
  });

  it('a line saved before BOQs reads as an ITEM with an unknown cost', async () => {
    // A row whose quotation is older than the BOQ migration — saved as a flat line and backfilled.
    const [{ finished_at: migratedAt }] = await prisma.$queryRaw`SELECT finished_at FROM _prisma_migrations WHERE migration_name = '20260927120100_quotation_boq_backfill'`;
    const legacy = await prisma.quotationItem.findFirst({ where: { quotation: { createdAt: { lt: migratedAt }, deletedAt: null } }, orderBy: { id: 'asc' } });
    const q = expectStatus(await manager.get(`/admin/quotations/${legacy.quotationId}`), 200).data;
    const row = q.items.find((r) => r.id === legacy.id);
    expect(row).toMatchObject({ rowType: 'ITEM', unitCost: null, costAmount: null });
    expect(row.number).toBeTruthy();
    expect(q.boq.cost.costComplete).toBe(false);
  });
});
