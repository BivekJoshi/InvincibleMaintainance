import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import {
  anon, as, approveAndSend, createCustomer, expectStatus, findKeys, getApp, prisma, tokenFor, uid, USERS,
} from './helpers.js';
import { COST_KEYS } from '../../src/utils/moneyWall.js';

/** Phase L4: the contract around the BOQ, the margin gate, and the customer's document (page, words, Excel). */

let sales;
let manager;
let admin;
let customer;
let crystalline;
const setSettings = (values) => admin.patch('/admin/settings').send({ values });
const decide = (token, body) => anon().post(`/public/quotations/${token}/decide`)
  .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile').send(body);
/** Any key that names a cost, a margin, a recipe or someone's pay — never on the customer's side. */
const internal = (value) => findKeys(value, (k) => /cost|unitCost|costAmount|margin|recipe|purchaseRate|hourlyRate|dayWage/i.test(k));

/** A costed BOQ: WP-CRYST (purchase Rs 450) sold at `rate` — a 55% margin at Rs 1,000, a loss at Rs 400. */
const costedRows = (rate = 1000) => [
  { rowType: 'SECTION', description: 'Damp treatment' },
  { kind: 'MATERIAL', materialId: crystalline.id, description: 'Crystalline compound', unit: 'kg', qty: 12, rate },
  { rowType: 'NOTE', description: 'Walls to be dry before the treatment.' },
  {
    kind: 'MATERIAL', materialId: crystalline.id, description: 'Crystalline slurry, measured', unit: 'kg', rate,
    measurements: [{ area: 'Bedroom', description: 'North wall', l: 12, h: 3 }, { area: 'Bedroom', description: 'Window', l: 4, h: 1, deduct: true }],
  },
  { kind: 'MATERIAL', materialId: crystalline.id, description: 'Extra coat (optional)', unit: 'kg', qty: 5, rate, isOptional: true },
];

const create = async (extra = {}) => expectStatus(await sales.post('/admin/quotations').send({
  customerId: customer.id, items: costedRows(), ...extra,
}), 201).data;

beforeAll(async () => {
  [sales, manager, admin] = await Promise.all([as('SALES'), as('MANAGER'), as('ADMIN')]);
  customer = await createCustomer(sales);
  crystalline = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
});

afterAll(async () => { await setSettings({ 'quotation.autoApproveBelow': 0 }); });

describe('the contract around the BOQ', () => {
  it('a new quotation starts with the default contract type, the 50/40/10 schedule and the library\'s default terms', async () => {
    const terms = expectStatus(await manager.post('/admin/quotation-terms').send({
      title: `Standard ${uid()}`, body: '1. 50% advance before work starts.', bodyNe: '१. काम सुरु हुनुअघि ५०% अग्रिम।', isDefault: true,
    }), 201).data;
    const q = await create();
    expect(q.contractType).toBe('LUMP_SUM');
    expect(q.terms).toBe(terms.body);
    expect(q.paymentStages.map((st) => [st.label, st.basisPoints, st.trigger])).toEqual([
      ['Advance', 5000, 'ON_ACCEPT'], ['Running bill', 4000, 'MILESTONE'], ['On completion', 1000, 'ON_COMPLETION'],
    ]);
    // The stage amounts are the server's split: they add up to the total to the paisa.
    expect(q.paymentStages.reduce((a, st) => a + st.total, 0)).toBe(q.total);
    expect(q.totalInWords.en).toMatch(/^Rupees .* Only$/);
    expect(q.totalInWords.ne).toMatch(/^रुपैयाँ .* मात्र$/);
    expect(q.dates.createdAtBs).toMatch(/^20\d\d-\d\d-\d\d$/);
    expect(q.letterhead).toMatchObject({ companyName: expect.any(String) });
  });

  it('only one default in the terms library; SALES reads it and cannot write it', async () => {
    await manager.post('/admin/quotation-terms').send({ title: `Another ${uid()}`, body: 'Other terms.', isDefault: true });
    expect(await prisma.quotationTerms.count({ where: { isDefault: true, deletedAt: null } })).toBe(1);
    expectStatus(await sales.get('/admin/quotation-terms'), 200);
    expectStatus(await sales.post('/admin/quotation-terms').send({ title: 'Mine', body: 'Nope' }), 403);
  });

  it('the stages must total 100 % with at most one advance; they are replaced on PUT and carried by a revision', async () => {
    const bad = [
      [{ label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT' }, { label: 'End', basisPoints: 4000, trigger: 'ON_COMPLETION' }],
      [{ label: 'A', basisPoints: 5000, trigger: 'ON_ACCEPT' }, { label: 'B', basisPoints: 5000, trigger: 'ON_ACCEPT' }],
    ];
    for (const paymentStages of bad) {
      expectStatus(await sales.post('/admin/quotations').send({ customerId: customer.id, items: costedRows(), paymentStages }), 400);
    }
    const q = await create({ contractType: 'ITEM_RATE', estimatedDays: 6, exclusions: 'Water and electricity by the owner.' });
    const stages = [
      { label: 'Advance', basisPoints: 4000, trigger: 'ON_ACCEPT' }, { label: 'Walls done', basisPoints: 3333, trigger: 'MILESTONE' },
      { label: 'Plaster done', basisPoints: 1667, trigger: 'MILESTONE' }, { label: 'Handover', basisPoints: 1000, trigger: 'ON_COMPLETION' },
    ];
    const updated = expectStatus(await sales.put(`/admin/quotations/${q.id}`).send({ paymentStages: stages }), 200).data;
    expect(updated.paymentStages.map((st) => st.basisPoints)).toEqual([4000, 3333, 1667, 1000]);
    expect(updated.paymentStages.reduce((a, st) => a + st.total, 0)).toBe(updated.total);
    await approveAndSend(q.id);
    const v2 = expectStatus(await sales.post(`/admin/quotations/${q.id}/revise`), 201).data;
    expect(v2).toMatchObject({ contractType: 'ITEM_RATE', estimatedDays: 6, exclusions: 'Water and electricity by the owner.' });
    expect(v2.paymentStages.map((st) => st.label)).toEqual(['Advance', 'Walls done', 'Plaster done', 'Handover']);
  });
});

describe('the margin gate (L-D4)', () => {
  it('a healthy, fully costed quotation is approved as before', async () => {
    const q = await create();
    expectStatus(await sales.post(`/admin/quotations/${q.id}/submit`), 200);
    expect(expectStatus(await manager.post(`/admin/quotations/${q.id}/approve`).send({}), 200).data.status).toBe('OFFICE_APPROVED');
  });

  it('below the minimum margin: 422 LOW_MARGIN, then approved with the acknowledgement — recorded', async () => {
    const q = await create({ items: costedRows(400) });
    expectStatus(await sales.post(`/admin/quotations/${q.id}/submit`), 200);
    const refused = expectStatus(await manager.post(`/admin/quotations/${q.id}/approve`).send({}), 422);
    expect(refused.error).toMatchObject({ code: 'LOW_MARGIN', details: { costComplete: true, minMarginPct: 15 } });
    expect(refused.error.details.marginPct).toBeLessThan(0);
    expectStatus(await manager.post(`/admin/quotations/${q.id}/approve`).send({ acknowledgeLowMargin: true }), 200);
    const event = await prisma.auditLog.findFirst({ where: { event: 'quotation.office_approved', recordId: q.id } });
    // An event's meta is stored in the audit row's `changes`.
    expect(event.changes.lowMargin).toMatchObject({ acknowledged: true, minMarginPct: 15, costComplete: true });
  });

  it('an unknown cost is treated the same way', async () => {
    const q = await create({ items: [{ description: 'Hand-priced work', unit: 'lump', qty: 1, rate: 5000 }] });
    expectStatus(await sales.post(`/admin/quotations/${q.id}/submit`), 200);
    const refused = expectStatus(await manager.post(`/admin/quotations/${q.id}/approve`).send({}), 422);
    expect(refused.error).toMatchObject({ code: 'LOW_MARGIN', details: { costComplete: false, marginPct: null } });
  });

  it('auto-approval never fires on a low or unknown margin', async () => {
    const low = await create({ items: costedRows(400) });
    const healthy = await create();
    expectStatus(await setSettings({ 'quotation.autoApproveBelow': Math.max(low.total, healthy.total) + 1 }), 200);
    expect(expectStatus(await sales.post(`/admin/quotations/${low.id}/submit`), 200).data.status).toBe('PENDING_APPROVAL');
    expect(expectStatus(await sales.post(`/admin/quotations/${healthy.id}/submit`), 200).data.status).toBe('OFFICE_APPROVED');
    await setSettings({ 'quotation.autoApproveBelow': 0 });
  });

  it('the list shows the margin to a manager and not to sales', async () => {
    const q = await create();
    const managerRow = expectStatus(await manager.get('/admin/quotations?limit=100&sort=-createdAt'), 200).data.find((r) => r.id === q.id);
    expect(managerRow.margin).toMatchObject({ amount: expect.any(Number), pct: 55 });
    const salesRow = expectStatus(await sales.get('/admin/quotations?limit=100&sort=-createdAt'), 200).data.find((r) => r.id === q.id);
    // Sales sees a row's recipe quantities (L3), never a cost or the margin.
    expect(findKeys(salesRow, (k) => COST_KEYS.includes(k))).toEqual([]);
  });
});

describe('the customer\'s page', () => {
  let q;
  let token;
  beforeAll(async () => {
    q = await create({ estimatedDays: 5, exclusions: 'Furniture moving by the owner.' });
    ({ publicToken: token } = await approveAndSend(q.id));
  });

  it('reads like a quotation — sections, measurements, schedule, words, dates, letterhead — and carries nothing internal', async () => {
    const pub = expectStatus(await anon().get(`/public/quotations/${token}`), 200).data;
    expect(internal(pub)).toEqual([]);
    expect(pub).toMatchObject({ contractType: 'LUMP_SUM', estimatedDays: 5, exclusions: 'Furniture moving by the owner.', summaryOnly: false });
    expect(pub.items.find((r) => r.description === 'Crystalline slurry, measured').measurements).toHaveLength(2);
    expect(pub.paymentStages.reduce((a, st) => a + st.total, 0)).toBe(pub.total);
    expect(pub.totalInWords.ne).toMatch(/मात्र$/);
    expect(pub.dates.validUntilBs).toMatch(/^20\d\d-/);
    expect(pub.letterhead.companyName).toBeTruthy();
  });

  it('each open is counted, for the send panel\'s "Opened 2×"', async () => {
    const before = await prisma.quotation.findUnique({ where: { id: q.id } });
    await anon().get(`/public/quotations/${token}`);
    await anon().get(`/public/quotations/${token}`);
    const after = expectStatus(await sales.get(`/admin/quotations/${q.id}`), 200).data;
    expect(after.viewCount).toBe(before.viewCount + 2);
    expect(after.firstViewedAt).toBeTruthy();
    // Page views are not audited changes.
    expect(await prisma.auditLog.count({ where: { recordId: q.id, model: 'Quotation', action: 'update', changes: { path: ['viewCount'], not: null } } })).toBe(0);
  });

  it('a section summary sends the sections only; measurements can be hidden', async () => {
    const summary = await create({ summaryOnly: true, showMeasurements: false });
    const { publicToken } = await approveAndSend(summary.id);
    const pub = expectStatus(await anon().get(`/public/quotations/${publicToken}`), 200).data;
    expect(pub.items.map((r) => r.rowType)).toEqual(['SECTION']);
    expect(pub.boq.sections[0].subtotal).toBeGreaterThan(0);
  });

  it('a decline records its reason, and the "mark lost?" link carries it', async () => {
    const lead = expectStatus(await sales.post('/admin/leads').send({ name: 'Decline Reason', phone: `98${String(Date.now()).slice(-8)}` }), 201).data;
    const declined = await create({ leadId: lead.id });
    const { publicToken } = await approveAndSend(declined.id);
    expectStatus(await decide(publicToken, { decision: 'reject', category: 'PRICE', note: 'Too expensive' }), 200);
    expect((await prisma.quotation.findUnique({ where: { id: declined.id } })).declineCategory).toBe('PRICE');
    const prompt = await prisma.notification.findFirst({ where: { type: 'lead_mark_lost', link: { startsWith: `/admin/leads/${lead.id}` } } });
    expect(prompt.link).toBe(`/admin/leads/${lead.id}?markLost=1&category=PRICE`);
    expectStatus(await decide(publicToken, { decision: 'reject', category: 'NOT_A_CATEGORY' }), 400);
  });
});

describe('the Excel workbook', () => {
  const download = async (role, id) => {
    const res = await request(getApp()).get(`/api/v1/admin/quotations/${id}/export.xlsx`)
      .set('Authorization', `Bearer ${await tokenFor(role)}`).buffer(true)
      .parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    return { wb, buffer: res.body };
  };
  /** The figure on the BOQ sheet's row labelled `label` (column F). */
  const figure = (ws, label) => {
    let found;
    ws.eachRow((row) => { if (row.getCell(2).value === label) found = row.getCell(6).value; });
    return typeof found === 'object' ? found.result : found;
  };

  let q;
  beforeAll(async () => { q = await create(); });

  it('SALES gets no cost sheet; a manager does; the export is audited', async () => {
    const forSales = await download('SALES', q.id);
    const forManager = await download('MANAGER', q.id);
    expect(forSales.wb.worksheets.map((ws) => ws.name)).toEqual(['BOQ', 'Measurements', 'Payment schedule']);
    expect(forManager.wb.worksheets.map((ws) => ws.name)).toEqual(['BOQ', 'Measurements', 'Payment schedule', 'Cost']);
    const salesId = (await prisma.user.findUnique({ where: { email: USERS.SALES } })).id;
    const event = await prisma.auditLog.findFirst({ where: { event: 'export.xlsx', recordId: q.id, actorId: salesId } });
    expect(event.changes).toMatchObject({ costSheet: false });
  });

  it('every stored formula result is the server\'s figure', async () => {
    const { wb } = await download('SALES', q.id);
    const boq = wb.getWorksheet('BOQ');
    expect(figure(boq, 'Subtotal')).toBe(q.subtotal / 100);
    expect(figure(boq, `VAT ${q.vatRate}%`)).toBe(q.vatAmount / 100);
    expect(figure(boq, 'Total')).toBe(q.total / 100);
  });

  // LibreOffice recalculates a formula that has no cached result, so the results are stripped and the sheet
  // converted: the recomputed totals must be the server's. Skipped where LibreOffice is not installed.
  const soffice = ['/usr/bin/soffice', '/usr/local/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].find(existsSync);
  it.skipIf(!soffice)('recalculated from its formulas, the BOQ gives the same totals', async () => {
    const { wb } = await download('SALES', q.id);
    wb.worksheets.forEach((ws) => ws.eachRow((row) => row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) cell.value = { formula: cell.value.formula };
    })));
    const dir = mkdtempSync(join(tmpdir(), 'boq-'));
    try {
      writeFileSync(join(dir, 'boq.xlsx'), Buffer.from(await wb.xlsx.writeBuffer()));
      execFileSync(soffice, ['--headless', `-env:UserInstallation=file://${dir}/profile`, '--convert-to', 'csv', '--outdir', dir, join(dir, 'boq.xlsx')], { timeout: 120_000 });
      const rows = readFileSync(join(dir, 'boq.csv'), 'utf8').split('\n').map((line) => line.split(','));
      const value = (label) => Number(rows.find((r) => r[1] === label)?.[5]);
      expect(value('Subtotal')).toBe(q.subtotal / 100);
      expect(value('Total')).toBe(q.total / 100);
      expect(value('Subtotal A')).toBe(q.boq.sections[0].subtotal / 100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 150_000);
});
