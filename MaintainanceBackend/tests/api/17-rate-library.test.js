import { describe, it, expect, beforeAll } from 'vitest';
import { as, createCompletedJob, expectStatus, findKeys, prisma, uid } from './helpers.js';
import { COST_KEYS } from '../../src/utils/moneyWall.js';

/** Phase L2: a recipe-priced rate library (L-D1) behind the cost wall (L-D4). */

let manager;
let sales;
let dispatcher;
const costKeys = (value) => findKeys(value, (k) => COST_KEYS.includes(k));

/** This run's own materials and trades, so the arithmetic below never depends on the seed. */
const fixture = {};

async function createMaterial(code, unit, purchaseRate) {
  return expectStatus(await dispatcher.post('/admin/materials').send({
    code: `${code}-${uid()}`, name: `${code} for L2`, unit, purchaseRate, sellRate: purchaseRate * 1.2,
  }), 201).data;
}

async function createTrade(code, dayWage) {
  return expectStatus(await manager.post('/admin/trades').send({ code: `${code}-${uid()}`, name: `${code} (L2)`, dayWage }), 201).data;
}

/**
 * Internal plaster 12 mm, 1:4, per 100 sq.ft — the hand calculation (paisa):
 *   cement 0.9 bag  +2% × Rs 850      = 0.9 × 85000 × 102/100 = 78030
 *   sand   5.5 cu.ft +5% × Rs 95      = 5.5 × 9500 × 105/100  = 54862.5 → 54863
 *   mason 1.2 d × Rs 1,500 = 180000 · helper 1.2 d × Rs 1,000 = 120000 · scaffolding 1 × Rs 150 = 15000
 *   per sq.ft: material 132893/100 → 1329 · labour 3000 · other 150 → direct 4479
 *   overhead 10% → 448 → unit cost 4927 · profit 15% → 5666.05 → 5666 → up to Rs 1 → 5700 (Rs 57.00)
 */
const plasterRecipe = () => ({
  unit: 'sq.ft', rateMode: 'DERIVED', recipeQty: 100, overheadPct: 10, profitPct: 15, roundTo: 1,
  components: [
    { kind: 'MATERIAL', materialId: fixture.cement.id, qty: 0.9, wastagePct: 2 },
    { kind: 'MATERIAL', materialId: fixture.sand.id, qty: 5.5, wastagePct: 5 },
    { kind: 'LABOUR', tradeId: fixture.mason.id, qty: 1.2 },
    { kind: 'LABOUR', tradeId: fixture.helper.id, qty: 1.2 },
    { kind: 'OTHER', description: 'Scaffolding and curing water', qty: 1, cost: 150 },
  ],
});

const createPlaster = async () => expectStatus(await manager.post('/admin/rate-card').send({
  code: `PLASTER-${uid()}`, name: 'Internal plaster (L2 test)', ...plasterRecipe(),
}), 201).data;

beforeAll(async () => {
  [manager, sales, dispatcher] = await Promise.all([as('MANAGER'), as('SALES'), as('DISPATCHER')]);
  fixture.cement = await createMaterial('CEM', 'bag', 850);
  fixture.sand = await createMaterial('SAND', 'cu.ft', 95);
  fixture.mason = await createTrade('MASON', 1500);
  fixture.helper = await createTrade('HELPER', 1000);
});

describe('recipes', () => {
  it('the plaster recipe derives Rs 57.00 per sq.ft — the hand calculation, to the paisa', async () => {
    const item = await createPlaster();
    expect(item).toMatchObject({ rate: 5700, derivedRate: 5700, outOfDate: false, unitCost: 4927 });
    expect(item.costBreakdown).toEqual({
      material: 1329, labour: 3000, equipment: 0, other: 150, direct: 4479, overhead: 448, unitCost: 4927, complete: true,
    });
    expect(item.margin).toEqual({ amount: 773, pct: 13.56 });
    expect(item.components.map((c) => c.lineCost)).toEqual([78030, 54863, 180000, 120000, 15000]);
    expect(item.components.map((c) => c.unit)).toEqual(['bag', 'cu.ft', 'day', 'day', 'lump']);
  });

  it('POST /derive prices a recipe with the same arithmetic and saves nothing', async () => {
    const before = await prisma.rateCardItem.count();
    const { components, recipeQty, overheadPct, profitPct, roundTo } = plasterRecipe();
    const body = expectStatus(await manager.post('/admin/rate-card/derive').send({ components, recipeQty, overheadPct, profitPct, roundTo, rate: 60 }), 200).data;
    expect(body).toMatchObject({ derivedRate: 5700, costBreakdown: { unitCost: 4927, complete: true } });
    // The margins come from the server too: at the form's Rs 60 and at the derived Rs 57.
    expect(body.margin).toEqual({ amount: 1073, pct: 17.88 });
    expect(body.derivedMargin).toEqual({ amount: 773, pct: 13.56 });
    expect(await prisma.rateCardItem.count()).toBe(before);
  });

  it('a derived rate needs every price; a manual rate keeps what was typed and gains a margin', async () => {
    const unpriced = await createMaterial('UNPRICED', 'kg', 0);
    const refused = expectStatus(await manager.post('/admin/rate-card').send({
      code: `NOPRICE-${uid()}`, name: 'Unpriced recipe', unit: 'sq.ft', rateMode: 'DERIVED',
      components: [{ kind: 'MATERIAL', materialId: unpriced.id, qty: 1 }],
    }), 422);
    expect(refused.error.code).toBe('RECIPE_INCOMPLETE');

    const manual = expectStatus(await manager.post('/admin/rate-card').send({
      code: `MANUAL-${uid()}`, name: 'Manual plaster', ...plasterRecipe(), rateMode: 'MANUAL', rate: 60,
    }), 201).data;
    expect(manual).toMatchObject({ rate: 6000, rateMode: 'MANUAL', outOfDate: false, margin: { amount: 1073 } });
  });

  it('a DERIVED item needs its recipe', async () => {
    expectStatus(await manager.post('/admin/rate-card').send({ code: `EMPTY-${uid()}`, name: 'No recipe', unit: 'sq.ft', rateMode: 'DERIVED' }), 400);
  });
});

describe('a price change never moves a rate by itself', () => {
  let item;

  beforeAll(async () => {
    item = await createPlaster();
    // Cement goes up to Rs 950: 0.9 × 95000 × 1.02 = 87210 → material 1421 → direct 4571 → overhead 457
    // → 5028 → × 1.15 = 5782.2 → 5782 → Rs 58.00.
    expectStatus(await dispatcher.put(`/admin/materials/${fixture.cement.id}`).send({ purchaseRate: 950 }), 200);
  });

  it('the item reads out of date, and its rate is unchanged — even after an edit to its name', async () => {
    const got = expectStatus(await manager.get(`/admin/rate-card/${item.id}`), 200).data;
    expect(got).toMatchObject({ rate: 5700, derivedRate: 5800, outOfDate: true });
    const renamed = expectStatus(await manager.put(`/admin/rate-card/${item.id}`).send({ name: 'Internal plaster, renamed' }), 200).data;
    expect(renamed).toMatchObject({ rate: 5700, outOfDate: true });
    // The edit form sends everything on every save — the same recipe, the same pricing and the rate shown.
    const formSave = expectStatus(await manager.put(`/admin/rate-card/${item.id}`).send({
      ...plasterRecipe(), name: 'Internal plaster, saved from the form', rate: 57,
    }), 200).data;
    expect(formSave).toMatchObject({ rate: 5700, outOfDate: true });
  });

  it('reprice previews without writing, then applies and records rate_card.repriced', async () => {
    const preview = expectStatus(await manager.post('/admin/rate-card/reprice').send({ ids: [item.id], apply: false }), 200).data;
    expect(preview).toEqual({ items: [expect.objectContaining({ id: item.id, rate: 5700, derivedRate: 5800, delta: 100 })], applied: 0 });
    expect((await prisma.rateCardItem.findUnique({ where: { id: item.id } })).rate).toBe(5700);

    const applied = expectStatus(await manager.post('/admin/rate-card/reprice').send({ ids: [item.id], apply: true }), 200).data;
    expect(applied.applied).toBe(1);
    expect(await prisma.rateCardItem.findUnique({ where: { id: item.id } })).toMatchObject({ rate: 5800, unitCost: 5028 });
    const event = await prisma.auditLog.findFirst({ where: { event: 'rate_card.repriced', recordId: item.id } });
    expect(event).toMatchObject({ before: { rate: 5700 }, after: { rate: 5800 } });
    expect(expectStatus(await manager.get(`/admin/rate-card/${item.id}`), 200).data.outOfDate).toBe(false);
  });

  it('reprice is a rate-library write', async () => {
    expectStatus(await sales.post('/admin/rate-card/reprice').send({ ids: [item.id], apply: true }), 403);
  });
});

describe('the cost wall (L-D4)', () => {
  let item;
  beforeAll(async () => { item = await createPlaster(); });

  it('SALES reads the library — rates and quantities — and no cost anywhere: list, get, history, trades', async () => {
    const list = expectStatus(await sales.get('/admin/rate-card?limit=100'), 200).data;
    const one = expectStatus(await sales.get(`/admin/rate-card/${item.id}`), 200).data;
    const history = expectStatus(await sales.get(`/admin/rate-card/${item.id}/history`), 200).data;
    const tradeList = expectStatus(await sales.get('/admin/trades'), 200).data;
    expect(costKeys(list)).toEqual([]);
    expect(costKeys(one)).toEqual([]);
    expect(costKeys(history)).toEqual([]);
    expect(costKeys(tradeList)).toEqual([]);
    // Created after cement went up, so it is Rs 58 — the rate is shown, its cost is not.
    expect(one).toMatchObject({ rate: item.rate, derivedRate: item.rate, recipeQty: 100 });
    expect(one.components[0]).toMatchObject({ qty: 0.9, wastagePct: 2, material: { id: fixture.cement.id } });
    // The same history, read by a manager, does carry the cost.
    const managerHistory = expectStatus(await manager.get(`/admin/rate-card/${item.id}/history`), 200).data;
    expect(costKeys(managerHistory).length).toBeGreaterThan(0);
  });

  it('SALES cannot write the library or price a recipe', async () => {
    expectStatus(await sales.post('/admin/rate-card').send({ code: `S-${uid()}`, name: 'Sales item', unit: 'sq.ft', rate: 10 }), 403);
    expectStatus(await sales.post('/admin/rate-card/derive').send({ components: plasterRecipe().components }), 403);
    expectStatus(await sales.post('/admin/trades').send({ code: `T-${uid()}`, name: 'Sales trade', dayWage: 10 }), 403);
  });

  it('job costing and the job-margin report are for costs:read only', async () => {
    const { job } = await createCompletedJob({ withMaterial: true });
    for (const role of ['SALES', 'DISPATCHER', 'ACCOUNTANT']) {
      expectStatus(await (await as(role)).get(`/admin/jobs/${job.id}/costing`), 403);
      expectStatus(await (await as(role)).get('/admin/reports/job-margin'), 403);
    }
    expect(expectStatus(await manager.get(`/admin/jobs/${job.id}/costing`), 200).data.cost.total).toBeGreaterThan(0);
    expectStatus(await manager.get('/admin/reports/job-margin'), 200);
  });

  it('a manager picks recipe materials from the catalogue', async () => {
    expectStatus(await manager.get('/admin/materials?limit=5'), 200);
  });
});
