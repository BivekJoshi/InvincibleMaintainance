import { test, expect, request } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';
import { E2E } from './support/e2eEnv.js';

/**
 * Phase H1's manual walk-through, as the dispatcher: the job an accepted quotation made is
 * scheduled on Hari's slot tomorrow by dragging, then moved with the Schedule dialog; a second job
 * dropped on the same slot is warned about and not saved; 22 kg of material is issued (stock falls by 22), time is
 * recorded, costing shows labour + materials to the paisa, completion is blocked while the
 * checklist is open, the job is completed and verified, and an admin publishes the case study.
 *
 * Set-up that is not under test (the quotation loop — Phase F's own spec) runs over the API.
 */

const tag = Date.now().toString(36);
const customerName = `ग्राहक E2E ${tag}`;
const phone = `98${String(Date.now()).slice(-8)}`;

/** Kathmandu's calendar day `n` days from now. */
const ktmDay = (n) => new Date(Date.now() + n * 86_400_000 + 345 * 60_000).toISOString().slice(0, 10);
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:45`).toISOString();
const tomorrow = ktmDay(1);

/**
 * Drags with real pointer moves — dnd-kit starts a drag only after the pointer has moved. The
 * target is measured again once the drag has started and just before the drop, and the pointer
 * settles there, so a layout that moved on the way does not send the job to the wrong cell.
 */
async function drag(page, handle, target) {
  await target.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 4 });
  let to = await target.boundingBox();
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(24, to.height / 2), { steps: 4 });
  to = await target.boundingBox();
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(24, to.height / 2), { steps: 2 });
  await page.mouse.up();
}

test.describe.configure({ mode: 'serial' });

test('dispatch: schedule, double-book warning, materials, time, costing, complete, verify, case study', async ({ browser }) => {
  const [admin, sales, manager, dispatcher] = await Promise.all(['ADMIN', 'SALES', 'MANAGER', 'DISPATCHER'].map((r) => apiAs(r)));
  await admin.patch('/admin/settings', { values: { 'quotation.makerChecker': true, 'quotation.autoApproveBelow': 0 } });

  // ── set-up: a Nepali-speaking customer accepts a quotation → one unscheduled job
  const customer = await sales.post('/admin/customers', { name: customerName, phone, preferredLocale: 'ne' });
  const quotation = await sales.post('/admin/quotations', {
    customerId: customer.id,
    validUntil: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    items: [{ description: 'Terrace waterproofing', unit: 'sq.ft', qty: 200, rate: 275 }],
  });
  await sales.post(`/admin/quotations/${quotation.id}/submit`);
  await manager.post(`/admin/quotations/${quotation.id}/approve`, {});
  const sent = await sales.post(`/admin/quotations/${quotation.id}/send`);
  const publicApi = await request.newContext({ baseURL: `${E2E.apiBase}/` });
  const decided = await publicApi.post(`public/quotations/${sent.publicToken}/decide`, { data: { decision: 'approve' } });
  expect(decided.status()).toBe(200);
  const [job] = (await dispatcher.list(`/admin/jobs?customerId=${customer.id}&limit=5`)).data;
  expect(job.status).toBe('DRAFT');
  const second = await dispatcher.post('/admin/jobs', { customerId: customer.id, title: `Gutter repair ${tag}` });

  const technicians = (await dispatcher.list('/admin/technicians?q=hari&limit=10')).data;
  const hari = technicians.find((t) => t.user.email === 'hari@gharjatan.com.np');
  // Hari's tomorrow must be free at 10:00 for this run: move away anything a previous run left there.
  const board = await dispatcher.get(`/admin/dispatch/board?date=${tomorrow}`);
  for (const old of board.lanes.find((l) => l.technician.id === hari.id).jobs) {
    await dispatcher.patch(`/admin/jobs/${old.id}/status`, { status: 'CANCELLED', note: 'Cleared by the e2e run' }).catch(() => {});
  }
  const material = (await dispatcher.list('/admin/materials?q=WP-CRYST')).data[0];
  await dispatcher.post('/admin/stock/movements', { materialId: material.id, type: 'PURCHASE', qty: 50, reference: `E2E ${tag}` });
  const balance = async () => (await dispatcher.list(`/admin/stock?q=WP-CRYST`)).data.find((r) => r.id === material.id).balance;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, 'DISPATCHER');

  const hariCell = (hhmm) => page.getByRole('gridcell', { name: new RegExp(`^${hari.user.name}, .*, ${hhmm}$`) });

  await test.step('drag the accepted job onto Hari at 10:00 tomorrow', async () => {
    await page.goto(`/admin/dispatch?date=${tomorrow}`);
    await page.getByRole('textbox', { name: 'Search unassigned jobs' }).fill(job.number);
    const handle = page.getByRole('button', { name: `Drag ${job.number}` });
    await expect(handle).toBeVisible();
    await drag(page, handle, hariCell('10:00'));
    // Jobs an earlier run finished on Hari's day cannot be moved; accept a warning about them.
    const earlier = page.getByRole('alertdialog', { name: `Schedule ${job.number} anyway?` });
    if (await earlier.isVisible({ timeout: 1500 }).catch(() => false)) await earlier.getByRole('button', { name: 'Schedule anyway' }).click();
    await expect(hariCell('10:00')).toContainText(job.number);
    const moved = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(moved.status).toBe('ASSIGNED');
    expect(moved.scheduledStart).toBe(at(tomorrow, '10:00'));
    expect(moved.assignments.map((a) => a.technicianId)).toEqual([hari.id]);
    // The customer was told in Nepali.
    const logs = (await admin.list(`/admin/message-logs?relatedId=${job.id}&templateKey=job_scheduled`)).data;
    expect(logs[0].body).toContain('समय मिलाइएको');
  });

  await test.step('move it with the Schedule dialog — the path without dragging', async () => {
    await hariCell('10:00').getByRole('button', { name: `Schedule ${job.number}` }).click();
    const dialog = page.getByRole('dialog', { name: `Schedule ${job.number}` });
    await expect(dialog.getByRole('checkbox', { name: new RegExp(hari.user.name) })).toBeChecked();
    await dialog.getByRole('textbox', { name: 'Starts — time' }).fill('11:00');
    await dialog.getByRole('textbox', { name: 'Ends — time' }).fill('13:00');
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    const earlier = page.getByRole('alertdialog', { name: `Schedule ${job.number} anyway?` });
    if (await earlier.isVisible({ timeout: 1500 }).catch(() => false)) await earlier.getByRole('button', { name: 'Schedule anyway' }).click();
    await expect(dialog).toBeHidden();
    await expect(hariCell('11:00')).toContainText(job.number);
    const moved = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(moved.scheduledStart).toBe(at(tomorrow, '11:00'));
    expect(moved.scheduledEnd).toBe(at(tomorrow, '13:00'));
  });

  await test.step('a double booking is warned about and not saved', async () => {
    await page.getByRole('textbox', { name: 'Search unassigned jobs' }).fill(second.number);
    await drag(page, page.getByRole('button', { name: `Drag ${second.number}` }), hariCell('11:00'));
    const warning = page.getByRole('alertdialog', { name: `Schedule ${second.number} anyway?` });
    await expect(warning).toContainText(`already has ${job.number} 11:00–13:00`);
    await warning.getByRole('button', { name: 'Go back' }).click();
    await expect(warning).toBeHidden();
    const untouched = await dispatcher.get(`/admin/jobs/${second.id}`);
    expect(untouched.scheduledStart).toBeNull();
    expect(untouched.assignments).toEqual([]);
  });

  await test.step('issue 22 kg — stock falls by 22', async () => {
    const before = await balance();
    await page.goto(`/admin/jobs/${job.id}?tab=materials`);
    await page.getByRole('button', { name: /Issue from stock/ }).click();
    const dialog = page.getByRole('dialog', { name: `Issue material to ${job.number}` });
    await dialog.getByRole('combobox', { name: /Material/ }).click();
    await page.getByRole('option', { name: /WP-CRYST/ }).click();
    await dialog.getByLabel(/Quantity/).fill('22');
    await dialog.getByRole('button', { name: 'Issue' }).click();
    await expect(page.getByText('22 kg').first()).toBeVisible();
    expect(await balance()).toBe(before - 22);
  });

  await test.step('record time by hand', async () => {
    await page.getByRole('tab', { name: /Time/ }).click();
    await page.getByRole('button', { name: /Add time/ }).click();
    const dialog = page.getByRole('dialog', { name: `Record time on ${job.number}` });
    await dialog.getByLabel(/Minutes worked/).fill('90');
    await dialog.getByRole('button', { name: 'Record time' }).click();
    await expect(page.getByText('Total recorded: 1 h 30 min')).toBeVisible();
  });

  await test.step('costing shows labour and materials, reconciled to the paisa', async () => {
    const costing = await dispatcher.get(`/admin/jobs/${job.id}/costing`);
    expect(costing.cost.materials).toBe(costing.breakdown.materials.reduce((s, m) => s + m.cost, 0));
    expect(costing.cost.labour).toBe(costing.breakdown.labour.reduce((s, l) => s + l.cost, 0));
    expect(costing.cost.total).toBe(costing.cost.materials + costing.cost.labour + costing.cost.expenses);
    expect(costing.cost.materials).toBe(22 * material.purchaseRate);
    await page.getByRole('tab', { name: 'Costing' }).click();
    const rupees = (paisa) => `Rs. ${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    await expect(page.getByText(rupees(costing.cost.total)).first()).toBeVisible();
    await expect(page.getByText(rupees(costing.cost.materials)).first()).toBeVisible();
    await expect(page.getByText('1 h 30 min').first()).toBeVisible();
  });

  await test.step('completion waits for the checklist, then complete and verify', async () => {
    await page.getByRole('button', { name: 'Mark on the way' }).click();
    await page.getByRole('button', { name: 'Start work' }).click();
    await expect(page.getByText('In progress').first()).toBeVisible();
    // The quotation had no service, so the job has no checklist yet: add an item the office expects.
    await page.getByRole('tab', { name: /Checklist/ }).click();
    await page.getByRole('button', { name: /Add item/ }).click();
    const add = page.getByRole('dialog', { name: 'Add a checklist item' });
    await add.getByLabel(/^Item/).fill('Flood test for 24 hours');
    await add.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('button', { name: 'Complete…' })).toBeDisabled();
    await expect(page.getByText('Complete: 1 checklist item is still open.')).toBeVisible();

    const tick = page.getByRole('checkbox', { name: 'Done: Flood test for 24 hours' });
    await expect(page.getByText('1 of 1 still open', { exact: false })).toBeVisible();
    await tick.click();
    await expect(tick).toBeChecked();
    await expect(page.getByRole('button', { name: 'Complete…' })).toBeEnabled();
    await page.getByRole('button', { name: 'Complete…' }).click();
    const done = page.getByRole('dialog', { name: `Complete ${job.number}` });
    await done.getByLabel(/What was done/).fill('Membrane laid; flood test dry.');
    await done.getByRole('button', { name: 'Complete job' }).click();
    await expect(page.getByText(/Completed — waiting for verification/)).toBeVisible();

    await page.getByRole('button', { name: 'Verify' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText(/^Verified/).first()).toBeVisible();
    expect((await dispatcher.get(`/admin/jobs/${job.id}`)).status).toBe('VERIFIED');
  });

  await test.step('an admin publishes the case study and lands in the project editor', async () => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await signIn(adminPage, 'ADMIN');
    await adminPage.goto(`/admin/jobs/${job.id}`);
    await adminPage.getByRole('button', { name: 'Publish case study…' }).click();
    const dialog = adminPage.getByRole('dialog', { name: `Publish ${job.number} as a case study` });
    await dialog.getByLabel(/Title/).fill(`Terrace waterproofing — ${tag}`);
    await dialog.getByRole('button', { name: 'Create the draft' }).click();
    await adminPage.waitForURL(/\/admin\/content\/projects\/[^/]+$/);
    await expect(adminPage.getByRole('heading', { name: `Terrace waterproofing — ${tag}` })).toBeVisible();
    const published = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(published.project?.isActive).toBe(false);
    await adminCtx.close();
  });

  await ctx.close();
  await publicApi.dispose();
});
