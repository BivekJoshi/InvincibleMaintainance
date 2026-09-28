import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';
import { approveInDialog, rupeesText } from './support/quotation.js';
import { SITE_PHOTO } from './support/survey.js';

/**
 * Phase L3's acceptance, end to end: SALES builds a bill of quantities in the builder — sections and rows by
 * keyboard, 15 rows pasted from Excel, a row from the rate library with `/`, a measured line and an optional
 * row — saves it, checks the server's totals are the ones the builder showed, and submits; a MANAGER sees the
 * margin, approves and sends. Phase L4: the pasted rows have no known cost, so the approval needs the low-margin
 * acknowledgement; the customer opens the link on a 360 px phone — the sections, the default 50 · 40 · 10 payment
 * schedule with the server's amounts, the total in words — SALES sees "Opened 1×", and the customer accepts.
 * Phase L5 adds the walk before a BOQ: SALES books the site visit with a caretaker, the customer confirms it in
 * Nepali on a phone, the surveyor fills the stepper at 360 px with no signal — checklist with a flagged reading and
 * its photos, the site pin, two rooms measured in feet-inches with a door deducted, a sketch — submits on the phone,
 * and the queue drains once the signal is back; the office builds the
 * quotation from the survey, whose BOQ row carries the same measurements and quantity. Phase L6 continues the first
 * test past the Accept: the customer is asked for the 50 % advance (amount, date, a pay button), the job carries the
 * BOQ as lines; the dispatcher sees "Awaiting advance" on the queue and the job, and scheduling is refused (the
 * button held, the API 422 ADVANCE_UNPAID); the accountant records the whole advance on its invoice through the
 * Record payment sheet; the dispatchers are told it is ready, and the dispatcher schedules it. Phase L7: Suresh, on the
 * job, files today's site diary on a 360 px phone — the weather, the crew, progress on a BOQ line in 5 % steps — and the
 * dispatcher finds that progress on the job's BOQ & progress tab (no earned value for dispatch) and the day in its Site
 * diary tab. L8 extends it.
 *
 * Set-up that is not under test runs over the API; everything is keyed to a unique name and phone.
 */

const tag = Date.now().toString(36);
const customerName = `E2E BOQ ${tag}`;
const phone = `98${String(Date.now() + 7).slice(-8)}`;
const PASTE = readFileSync(new URL('./fixtures/boq-paste.tsv', import.meta.url), 'utf8');
const COST_KEYS = new Set(['unitCost', 'costAmount', 'costTotal', 'costComplete', 'margin', 'cost', 'overheadPct', 'profitPct', 'purchaseRate', 'dayWage']);

/** Every key path in a value that names a cost — the money wall's check. */
function costKeys(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => costKeys(v, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(COST_KEYS.has(k) ? [`${path}.${k}`] : []), ...costKeys(v, `${path}.${k}`)]);
}

/** "Rs. 1,23,456.50" → 12345650 paisa. */
const paisaOf = (text) => Math.round(Number(String(text).replace(/^[^\d]*/, '').replace(/[^\d.]/g, '')) * 100);

test.describe.configure({ mode: 'serial' });

test('SALES builds a 3-section BOQ by keyboard, paste, library and a measured line; MANAGER approves and sends; the customer opens it on a phone and accepts', async ({ browser }) => {
  const [admin, sales, manager] = await Promise.all(['ADMIN', 'SALES', 'MANAGER'].map((r) => apiAs(r)));
  await admin.patch('/admin/settings', { values: { 'quotation.makerChecker': true, 'quotation.autoApproveBelow': 0 } });
  const customer = await sales.post('/admin/customers', { name: customerName, phone });
  await sales.post(`/admin/customers/${customer.id}/sites`, { label: 'Home', address: 'Jhamsikhel, Lalitpur', isPrimary: true });

  const salesCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await salesCtx.newPage();
  const grid = page.getByRole('grid', { name: 'Bill of quantities' });
  const cell = (row, key) => grid.locator(`[data-cell="${row}:${key}"]`);
  const number = (row) => grid.locator(`[data-row="${row}"] [role="rowheader"]`);
  const keys = async (...presses) => { for (const k of presses) await page.keyboard.press(k); };
  let quotationId;
  let link;

  await test.step('SALES starts a blank quotation from the New quotation sheet', async () => {
    await signIn(page, 'SALES');
    await page.goto('/admin/quotations');
    await page.getByRole('button', { name: 'New quotation' }).click();
    const sheet = page.getByRole('dialog', { name: 'New quotation' });
    await sheet.getByRole('combobox', { name: /Customer/ }).click();
    await page.getByPlaceholder('Search…').fill(customerName);
    await page.getByRole('option', { name: new RegExp(customerName) }).click();
    await sheet.getByRole('combobox', { name: /Site/ }).click();
    await page.getByRole('option', { name: /Jhamsikhel/ }).click();
    await sheet.getByRole('button', { name: 'Create draft quotation' }).click();
    await page.waitForURL(/\/admin\/quotations\/[^/]+$/);
    quotationId = page.url().split('/').pop();
    await expect(grid).toBeVisible();
    await expect(page.getByTestId('waiting-for')).toContainText('Draft');
  });

  await test.step('a section and its rows, by keyboard', async () => {
    await grid.focus();
    await keys('Control+Shift+Enter');
    await page.keyboard.type('SUBSTRUCTURE');
    await keys('Enter', 'Control+Enter');
    await page.keyboard.type('Excavation in ordinary soil');
    await keys('Tab');
    await page.keyboard.type('cu.m');
    await keys('Tab');
    await page.keyboard.type('45');
    await keys('Tab', 'Tab');
    await page.keyboard.type('650');
    // Past the last cell, Tab adds the next row.
    await keys('Tab', 'Tab');
    await page.keyboard.type('PCC 1:3:6 in foundation');
    await keys('Tab');
    await page.keyboard.type('cu.m');
    await keys('Tab');
    await page.keyboard.type('6.5');
    await keys('Tab');
    await page.keyboard.type('5');
    await keys('Tab');
    await page.keyboard.type('13,500');
    await keys('Enter');
    await expect(number(0)).toHaveText('A');
    await expect(number(2)).toHaveText('A.2');
    await expect(cell(2, 'rate')).toHaveText('13,500.00');
  });

  await test.step('15 rows pasted from Excel: text rows become sections B and C', async () => {
    await cell(2, 'rate').click();
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, PASTE);
    await expect(grid.locator('[data-row]')).toHaveCount(18);
    await expect(number(3)).toHaveText('B');
    await expect(cell(3, 'description')).toHaveText('MASONRY');
    await expect(number(11)).toHaveText('C');
    await expect(cell(9, 'rate')).toHaveText('1,25,000.00');
    await expect(number(17)).toHaveText('C.6');
  });

  await test.step('a row from the rate library with /', async () => {
    await cell(17, 'description').click();
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'Search the rate library' });
    await dialog.getByRole('combobox').fill('Internal plaster repair');
    await expect(dialog.getByRole('option', { name: /Internal plaster repair/ })).toBeVisible();
    await dialog.getByRole('combobox').press('Enter');
    await expect(dialog).toBeHidden();
    await expect(cell(18, 'description')).toContainText('Internal plaster repair');
    await expect(cell(18, 'qty')).toBeFocused();
    await page.keyboard.type('120');
    await keys('Enter');
  });

  await test.step('a measured line: feet-inches in the measurement sheet', async () => {
    await cell(12, 'qty').click(); // C.1 Wall putty
    await keys('Control+m');
    const sheet = page.getByRole('dialog', { name: /Measurement sheet — C.1/ });
    await sheet.getByRole('button', { name: 'Add measurement' }).click();
    await page.keyboard.type('Living room');
    await keys('Tab');
    await page.keyboard.type('Four walls');
    await keys('Tab');
    await page.keyboard.type('4');
    await keys('Tab');
    await page.keyboard.type('14\'6"');
    await keys('Tab', 'Tab');
    await page.keyboard.type('10\'');
    await keys('Enter');
    await sheet.getByRole('button', { name: 'Add measurement' }).click();
    await page.keyboard.type('Living room');
    await keys('Tab');
    await page.keyboard.type('Door');
    await keys('Tab');
    await page.keyboard.type('1');
    await keys('Tab');
    await page.keyboard.type('3\'6"');
    await keys('Tab', 'Tab');
    await page.keyboard.type('7\'');
    await keys('Tab', 'Space');
    await expect(sheet.getByTestId('measurement-total')).toHaveText('555.5');
    await sheet.getByRole('button', { name: 'Use these measurements' }).click();
    await expect(sheet).toBeHidden();
    await expect(cell(12, 'qty')).toContainText('555.5');
  });

  await test.step('an optional row', async () => {
    await cell(14, 'isOptional').click(); // C.3 Exterior weather coat
    await expect(cell(14, 'description')).toContainText('Optional');
  });

  let shown;
  await test.step('save: the server’s totals are the ones the builder showed', async () => {
    const totals = page.getByTestId('totals');
    await expect(totals).toHaveAttribute('data-source', 'preview');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
    shown = {
      subtotal: paisaOf(await page.getByTestId('quotation-subtotal').innerText()),
      total: paisaOf(await page.getByTestId('quotation-total').innerText()),
      optional: paisaOf(await page.getByTestId('quotation-optional').innerText()),
    };
    expect(shown.total).toBeGreaterThan(0);

    const saved = page.waitForResponse((r) => r.url().endsWith(`/api/v1/admin/quotations/${quotationId}`) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    const { data } = await response.json();
    expect({ subtotal: data.subtotal, total: data.total, optional: data.boq.optionalTotal }).toEqual(shown);
    await expect(page.getByTestId('totals')).toHaveAttribute('data-source', 'saved');
    expect(paisaOf(await page.getByTestId('quotation-total').innerText())).toBe(data.total);

    // The rows as the server kept them: three sections, the library row's recipe frozen, the sheet, the optional row.
    expect(data.items.filter((r) => r.rowType === 'SECTION').map((r) => r.number)).toEqual(['A', 'B', 'C']);
    expect(data.items).toHaveLength(19);
    const putty = data.items.find((r) => r.description === 'Wall putty two coats');
    expect(putty.measurements).toHaveLength(2);
    expect(putty.netQty).toBe(555.5);
    expect(data.items.find((r) => r.description === 'Exterior weather coat').isOptional).toBe(true);
    expect(data.items.find((r) => r.description === 'Internal plaster repair').rateCardItemId).toBeTruthy();
    // SALES never gets a cost (L-D4).
    expect(costKeys(data)).toEqual([]);
    expect(costKeys(await sales.get(`/admin/quotations/${quotationId}`))).toEqual([]);
  });

  await test.step('SALES submits it', async () => {
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByTestId('waiting-for')).toContainText('Waiting for a manager');
  });

  await test.step('MANAGER sees the margin, approves and sends', async () => {
    const managerCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const mpage = await managerCtx.newPage();
    await signIn(mpage, 'MANAGER');
    await mpage.goto(`/admin/quotations/${quotationId}`);
    const margin = mpage.getByTestId('margin-card');
    await expect(margin).toBeVisible();
    await expect(margin.getByTestId('cost-total')).toContainText('Rs.');
    const record = await manager.get(`/admin/quotations/${quotationId}`);
    expect(record.boq.cost).toBeTruthy();
    expect(paisaOf(await mpage.getByTestId('quotation-total').innerText())).toBe(shown.total);

    // Phase L4's margin gate: the pasted rows carry no cost, so the margin is unknown and the manager says so.
    expect(record.costComplete).toBe(false);
    await mpage.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = mpage.getByRole('dialog', { name: 'Approve this quotation' });
    await expect(dialog.getByTestId('approve-margin')).toContainText('Unknown');
    await expect(dialog.getByRole('checkbox', { name: /margin is unknown/ })).toBeVisible();
    expect(await approveInDialog(mpage, 'BOQ checked.')).toBe('acknowledged');
    await expect(mpage.getByTestId('waiting-for')).toContainText('ready to send');
    // The acknowledgement is recorded with the approval (an event's meta is the audit row's `changes`).
    const trail = (await admin.list(`/admin/audit-logs?recordId=${quotationId}&limit=50`)).data;
    expect(trail.find((r) => r.event === 'quotation.office_approved')?.changes).toMatchObject({
      note: 'BOQ checked.', lowMargin: { acknowledged: true, costComplete: false },
    });

    await mpage.getByRole('button', { name: 'Send to customer' }).click();
    await mpage.getByRole('alertdialog').getByRole('button', { name: 'Send' }).click();
    await expect(mpage.getByTestId('public-link')).toBeVisible();
    link = new URL(await mpage.getByTestId('public-link').innerText()).pathname;
    await managerCtx.close();
  });

  const customerCtx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const customerPage = await customerCtx.newPage();

  await test.step('the customer opens the link on a phone: the sections, the payment schedule, the words', async () => {
    const record = await sales.get(`/admin/quotations/${quotationId}`);
    // A new quotation starts on the default schedule, and its stages add up to the total to the paisa.
    expect(record.paymentStages.map((st) => [st.basisPoints, st.trigger])).toEqual([
      [5000, 'ON_ACCEPT'], [4000, 'MILESTONE'], [1000, 'ON_COMPLETION'],
    ]);
    expect(record.paymentStages.reduce((sum, st) => sum + st.total, 0)).toBe(record.total);

    await customerPage.goto(link);
    await expect(customerPage.getByRole('heading', { name: 'SUBSTRUCTURE' })).toBeVisible();
    await expect(customerPage.getByRole('heading', { name: 'MASONRY' })).toBeVisible();
    await expect(customerPage.getByText('Optional — not included in the total')).toBeVisible();
    await expect(customerPage.getByTestId('letterhead')).toBeVisible();
    await expect(customerPage.getByTestId('total-in-words')).toContainText(record.totalInWords.en);

    const schedule = customerPage.getByTestId('payment-schedule');
    await schedule.scrollIntoViewIfNeeded();
    await expect(schedule.getByRole('heading', { name: 'Payment schedule' })).toBeVisible();
    const stageRows = schedule.locator('tbody tr');
    await expect(stageRows).toHaveCount(3);
    for (const [i, st] of record.paymentStages.entries()) {
      await expect(stageRows.nth(i)).toContainText(st.label);
      await expect(stageRows.nth(i)).toContainText(rupeesText(st.total));
    }
    await expect(stageRows.nth(0)).toContainText('On acceptance (advance)');
    await expect(stageRows.nth(0)).toContainText('50%');

    // The measurements annex opens on request, and the page never scrolls sideways at 360 px.
    await customerPage.getByRole('button', { name: /Show the measurements/ }).click();
    await expect(customerPage.getByTestId('measurements-annex')).toContainText('Living room — Four walls');
    const overflow = await customerPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  await test.step('SALES sees the customer opened it', async () => {
    await page.reload();
    const views = page.getByTestId('link-views');
    await expect(views).toContainText('Opened 1×');
    await expect(views).toContainText('First opened');
    const record = await sales.get(`/admin/quotations/${quotationId}`);
    expect(record.viewCount).toBe(1);
    expect(record.firstViewedAt).toBeTruthy();
    await expect(page.getByTestId('share-whatsapp')).toHaveAttribute('href', new RegExp(`^https://wa\\.me/977${phone}\\?text=`));
  });

  await test.step('the customer accepts', async () => {
    await customerPage.getByRole('button', { name: 'Accept' }).click();
    const dialog = customerPage.getByRole('dialog', { name: 'Accept this quotation?' });
    await expect(dialog.getByTestId('accept-total')).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes, accept' }).click();
    await expect(customerPage.getByText('Thank you — quotation accepted')).toBeVisible();
    expect((await sales.get(`/admin/quotations/${quotationId}`)).status).toBe('CONVERTED');
    // The public view is an allowlist: no cost key, although every row was priced and one carries a recipe.
    expect(costKeys(await sales.get(`/public/quotations/${link.split('/').pop()}`))).toEqual([]);
  });

  // ── Phase L6: won → hand-off. The Accept raised the advance; the job waits for it.
  const [dispatcher, accountant] = await Promise.all(['DISPATCHER', 'ACCOUNTANT'].map((r) => apiAs(r)));
  let job;
  let advance;

  await test.step('L6: the customer is asked for the 50% advance; the job carries the BOQ and waits for it', async () => {
    const record = await sales.get(`/admin/quotations/${quotationId}`);
    const [stage1] = record.paymentStages;
    const block = customerPage.getByTestId('advance-due');
    await expect(block).toBeVisible();
    await expect(block.getByRole('heading')).toContainText(`Pay the advance of ${rupeesText(stage1.total)} by `);
    await expect(block.getByRole('link', { name: 'Pay the advance' })).toHaveAttribute('href', /\/invoice\/[^/]+$/);
    // A reload shows it again — the page reads it from the API, not from the tap.
    await customerPage.reload();
    await expect(customerPage.getByTestId('advance-due')).toContainText(rupeesText(stage1.total));

    [job] = (await dispatcher.list(`/admin/jobs?customerId=${customer.id}&limit=5`)).data;
    expect(job).toMatchObject({ status: 'DRAFT', awaitingAdvance: true });
    const detail = await dispatcher.get(`/admin/jobs/${job.id}`);
    advance = detail.advance.invoice;
    expect(advance.total).toBe(stage1.total);
    expect(detail.advance).toMatchObject({ required: true, awaitingAdvance: true, paid: false });
    // The BOQ's priced, non-optional rows became the job's lines; the optional one did not.
    const priced = record.items.filter((r) => r.rowType === 'ITEM' && !r.isOptional);
    expect(detail.lines).toHaveLength(priced.length);
    expect(detail.lines.some((l) => l.description === 'Exterior weather coat')).toBe(false);
  });

  const dispatchCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dpage = await dispatchCtx.newPage();

  await test.step('L6: as the dispatcher, "Awaiting advance" on the queue and the job — scheduling is refused', async () => {
    await signIn(dpage, 'DISPATCHER');
    await dpage.goto('/admin/dispatch');
    await dpage.getByRole('textbox', { name: 'Search unassigned jobs' }).fill(job.number);
    const card = dpage.locator('article').filter({ hasText: job.number });
    await expect(card.getByTestId('awaiting-advance')).toBeVisible();
    // Held: it cannot be dragged; its Schedule… opens the dialog, which says why.
    await expect(dpage.getByRole('button', { name: `Drag ${job.number}` })).toHaveCount(0);

    await dpage.goto(`/admin/jobs/${job.id}`);
    await expect(dpage.getByTestId('awaiting-advance')).toBeVisible();
    await expect(dpage.getByTestId('advance-title')).toHaveText('Waiting for the advance — scheduling is locked');
    await expect(dpage.getByTestId('advance-card')).toContainText(advance.number);
    await expect(dpage.getByRole('button', { name: 'Schedule…' })).toBeDisabled();
    await expect(dpage.getByText(/the advance is not paid yet\./)).toBeVisible();

    // The Plan tab: the BOQ is in; the advance is what it waits for.
    await dpage.getByRole('tab', { name: /Plan/ }).click();
    await expect(dpage.getByTestId('ready-boq')).toHaveAttribute('data-done', 'true');
    await expect(dpage.getByTestId('ready-advance')).toHaveAttribute('data-done', 'false');

    // And the API refuses it outright.
    const suresh = (await dispatcher.list('/admin/technicians?q=suresh&limit=10')).data[0];
    await expect(dispatcher.post(`/admin/jobs/${job.id}/schedule`, {
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), technicianIds: [suresh.id],
    })).rejects.toThrow(/→ 422 .*ADVANCE_UNPAID/);
  });

  await test.step('L6: as the accountant, record the whole advance on its invoice', async () => {
    const accountsCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const apage = await accountsCtx.newPage();
    await signIn(apage, 'ACCOUNTANT');
    await apage.goto(`/admin/invoices/${advance.id}`);
    await expect(apage.getByTestId('invoice-kind')).toHaveText('Advance');
    await expect(apage.getByTestId('invoice-stage')).toContainText('Advance');
    await expect(apage.getByRole('link', { name: job.number })).toHaveAttribute('href', `/admin/jobs/${job.id}`);
    await apage.getByRole('button', { name: 'Record payment' }).first().click();
    const sheet = apage.getByRole('dialog', { name: /Record a payment/ });
    await sheet.getByLabel(/Amount received/).fill((advance.balance / 100).toFixed(2));
    await sheet.getByRole('combobox', { name: /Method/ }).click();
    await apage.getByRole('option', { name: 'Bank transfer' }).click();
    await sheet.getByLabel(/Reference/).fill(`ADV-${tag}`);
    await sheet.getByRole('button', { name: 'Record payment' }).click();
    await expect(apage.getByTestId('invoice-status')).toHaveText('Paid');
    expect(await accountant.get(`/admin/invoices/${advance.id}`)).toMatchObject({ status: 'PAID', balance: 0 });
    await accountsCtx.close();
  });

  await test.step('L6: the dispatchers are told; as the dispatcher, scheduling now works', async () => {
    const notes = (await dispatcher.list('/admin/notifications?limit=50')).data;
    expect(notes.some((n) => n.title === `Advance paid — ${job.number} is ready to schedule`)).toBe(true);

    await dpage.goto(`/admin/jobs/${job.id}`);
    await expect(dpage.getByTestId('advance-card')).toHaveAttribute('data-state', 'paid');
    await expect(dpage.getByTestId('awaiting-advance')).toHaveCount(0);
    await dpage.getByRole('button', { name: 'Schedule…' }).click();
    const dialog = dpage.getByRole('dialog', { name: `Schedule ${job.number}` });
    await expect(dialog.getByTestId('advance-notice')).toHaveCount(0);
    // Suresh, not Hari: the other specs plan Hari's days.
    await dialog.getByRole('checkbox', { name: /Suresh Technician/ }).check();
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(dialog).toBeHidden();
    const scheduled = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(scheduled.status).toBe('ASSIGNED');
    expect(scheduled.scheduledStart).toBeTruthy();
    expect(scheduled.assignments.map((a) => a.technician?.user?.name)).toEqual(['Suresh Technician']);
    if (scheduled.plannedDays) {
      expect(new Date(scheduled.scheduledEnd) - new Date(scheduled.scheduledStart)).toBe(Math.round(scheduled.plannedDays * 86_400_000));
    }
  });

  // ── Phase L7: on site. Suresh (on the job) files today's diary from his phone; the office sees the progress.
  let line;
  await test.step('L7: the technician files a diary day at 360 px with progress on a line — no money on the phone', async () => {
    [line] = (await dispatcher.get(`/admin/jobs/${job.id}`)).lines;
    const lineName = `${line.number} ${line.description}`;
    const techCtx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true });
    const tpage = await techCtx.newPage();
    await signIn(tpage, 'SURESH');
    await tpage.goto(`/tech/jobs/${job.id}`);
    await tpage.getByRole('link', { name: /Site diary/ }).click();
    await tpage.waitForURL(`**/tech/jobs/${job.id}/diary`);
    const sideways = () => tpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await expect(tpage.getByTestId('diary-today')).toBeVisible();
    expect(await sideways()).toBeLessThanOrEqual(0);
    await tpage.getByRole('link', { name: /Fill in today/ }).click();
    await expect(tpage.getByRole('heading', { name: /Site diary/ })).toBeVisible();

    await tpage.getByRole('radio', { name: /Sunny/ }).click();
    await tpage.getByRole('button', { name: /^One more:/ }).first().click();
    await tpage.getByRole('button', { name: /^One more:/ }).first().click();
    for (let i = 0; i < 3; i += 1) await tpage.getByRole('button', { name: `5% more: ${lineName}` }).click();
    await expect(tpage.getByTestId(`progress-pct-${line.id}`)).toHaveText('15%');
    await tpage.getByLabel('Problems on site').fill('छानामा पानी जमेको छ');
    await tpage.getByRole('button', { name: /Save the day/ }).click();

    // Queued and sent at once while there is signal; the line's progress is the diary's.
    await expect.poll(async () => (await dispatcher.get(`/admin/jobs/${job.id}`)).lines.find((l) => l.id === line.id).progressPct, { timeout: 20_000 })
      .toBe(15);
    await expect(tpage.locator('header').getByRole('button', { name: 'All sent' })).toBeVisible();
    expect(await tpage.locator('main').innerText()).not.toMatch(/Rs\.|रु\./);
    expect(await sideways()).toBeLessThanOrEqual(0);
    await techCtx.close();
  });

  await test.step('L7: the dispatcher sees the progress on BOQ & progress (no earned value) and the day in the site diary', async () => {
    await dpage.goto(`/admin/jobs/${job.id}?tab=progress`);
    await expect(dpage.getByTestId(`line-progress-${line.id}`)).toHaveText('15%');
    await expect(dpage.getByTestId('earned-pct')).toBeVisible();
    await expect(dpage.getByTestId('earned-value')).toHaveCount(0);
    await dpage.getByRole('tab', { name: 'Site diary' }).click();
    await expect(dpage.getByText('Sunny')).toBeVisible();
    await expect(dpage.getByText(`${line.number} 15%`)).toBeVisible();
  });

  await dispatchCtx.close();
  await customerCtx.close();
  await salesCtx.close();
  await Promise.all([admin, sales, manager, dispatcher, accountant].map((c) => c.dispose()));
});

/** A Kathmandu calendar day, `days` from today, as a date input takes it. */
const ktmDay = (days) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date(Date.now() + days * 86_400_000));
const rowOf = (m) => ({
  area: m.area ?? null, description: m.description ?? null, nos: m.nos ?? null, l: m.l ?? null, b: m.b ?? null, h: m.h ?? null, deduct: Boolean(m.deduct),
});

test('L5: book the visit with a caretaker; the customer confirms in Nepali; the surveyor measures offline at 360 px and syncs; the quotation carries the measurements', async ({ browser }) => {
  const [admin, sales] = await Promise.all(['ADMIN', 'SALES'].map((r) => apiAs(r)));
  const visitTag = `${tag}v`;
  const visitName = `E2E Visit ${visitTag}`;
  const visitPhone = `98${String(Date.now() + 11).slice(-8)}`;
  // By its slug: the shared test database collects the API suite's services, so the seeded one may not be on page 1.
  const services = (await admin.list('/admin/services?q=seepage-and-damp-treatment&limit=100')).data;
  const seepage = services.find((sv) => sv.slug === 'seepage-and-damp-treatment');
  expect(seepage, 'the seeded seepage service').toBeTruthy();
  const lead = await sales.post('/admin/leads', {
    name: visitName, phone: visitPhone, address: 'Jhamsikhel, Lalitpur', serviceId: seepage.id, source: 'call',
    preferredLocale: 'ne', message: 'भुइँतलाको भित्तामा चिस्यान, पानी परेपछि बढ्छ।',
  });
  const technicians = (await sales.list('/admin/technicians?limit=100')).data;
  const surveyor = technicians.find((t) => t.user?.email === 'survey@gharjatan.com.np');

  const salesCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await salesCtx.newPage();
  let booked;

  await test.step('SALES books the visit: a window, the caretaker and a landmark, with the SMS in Nepali', async () => {
    await signIn(page, 'SALES');
    await page.goto(`/admin/leads/${lead.id}`);
    await page.getByRole('button', { name: /^Convert/ }).click();
    await page.getByRole('menuitem', { name: /Book the inspection visit/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Book the site visit' });
    await dialog.getByLabel('Date').fill(ktmDay(2));
    await dialog.getByLabel('From').fill('10:00');
    await dialog.getByLabel('Until').fill('12:00');
    await dialog.getByRole('combobox', { name: 'Surveyor' }).click();
    await page.getByRole('option', { name: new RegExp(surveyor.user.name) }).click();
    await dialog.getByLabel(/^Site contact/).first().fill('हरि थापा (caretaker)');
    await dialog.getByLabel('Site contact phone').fill('+977 9851012345');
    await dialog.getByLabel(/^Landmark/).fill('Opposite the Bhatbhateni, blue gate');
    await expect(dialog.getByTestId('visit-sms')).toContainText('नमस्ते');
    await expect(dialog.getByTestId('visit-sms')).toContainText('10:00–12:00');
    await expect(dialog.getByText(/Also sent to हरि थापा \(caretaker\)/)).toBeVisible();
    const converted = page.waitForResponse((r) => r.url().endsWith(`/api/v1/admin/leads/${lead.id}/convert`) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Book visit' }).click();
    const response = await converted;
    expect(response.status(), await response.text()).toBeLessThan(300);
    booked = (await response.json()).data;
    expect(booked.job?.id && booked.survey?.id, 'the booking made the inspection job and its survey').toBeTruthy();
  });

  const job = await admin.get(`/admin/jobs/${booked.job.id}`);
  expect(job.visitToken).toBeTruthy();
  expect(job.site).toMatchObject({ contactName: 'हरि थापा (caretaker)', contactPhone: '9851012345', landmark: 'Opposite the Bhatbhateni, blue gate' });

  await test.step('the customer opens the SMS link on a phone and confirms, in Nepali', async () => {
    const customerCtx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    const phonePage = await customerCtx.newPage();
    await phonePage.goto(`/visit/${job.visitToken}`);
    await phonePage.getByRole('button', { name: 'नेपालीमा पढ्नुहोस्' }).click();
    await expect(phonePage.getByText('Opposite the Bhatbhateni, blue gate')).toBeVisible();
    await expect(phonePage.getByRole('link', { name: new RegExp(surveyor.user.name) })).toBeVisible();
    await phonePage.getByRole('button', { name: 'पक्का गर्नुहोस्' }).click();
    await expect(phonePage.getByText('धन्यवाद — तपाईंको भ्रमण पक्का भयो')).toBeVisible();
    const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await customerCtx.close();
    const answered = await admin.get(`/admin/jobs/${booked.job.id}`);
    expect(answered.visitAnswer).toBe('CONFIRMED');
    expect(answered.customerConfirmedAt).toBeTruthy();
  });

  await test.step('the surveyor fills the stepper at 360 px with no signal — checklist, pin, two rooms in feet-inches, a sketch, the line — and it syncs', async () => {
    const fieldCtx = await browser.newContext({
      viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true,
      permissions: ['geolocation'], geolocation: { latitude: 27.6712345, longitude: 85.3134567, accuracy: 15 },
    });
    const field = await fieldCtx.newPage();
    await signIn(field, 'SURVEYOR');
    await field.goto('/tech/surveys');
    await field.getByRole('link', { name: new RegExp(visitName) }).click();
    const next = () => field.getByRole('button', { name: 'Next' }).click();

    // Before you go: what the customer sent, and who to meet.
    await expect(field.getByRole('heading', { name: 'Before you go' })).toBeVisible();
    await expect(field.getByText('भुइँतलाको भित्तामा चिस्यान, पानी परेपछि बढ्छ।')).toBeVisible();
    await expect(field.getByRole('link', { name: /Call हरि थापा/ })).toHaveAttribute('href', 'tel:9851012345');

    // In the basement: no signal from here until the survey is submitted.
    await fieldCtx.setOffline(true);
    await expect(field.getByRole('button', { name: /^Offline/ })).toBeVisible();
    await next();

    // Arrived: the GPS becomes the site's pin.
    await field.getByRole('button', { name: 'Pin the site here' }).click();
    await expect(field.getByText('Pinned — it goes to the office with the survey.')).toBeVisible();
    await next();

    // The seepage checklist: a flagged reading, and a photo on each question that needs one.
    await expect(field.getByRole('heading', { name: 'Checklist' })).toBeVisible();
    await field.getByRole('textbox', { name: 'Moisture 300 mm above the floor' }).fill('24');
    await expect(field.getByTestId('flag-moisture_low')).toBeVisible();
    await field.getByLabel('Take the photo: Moisture 300 mm above the floor').setInputFiles({ name: 'meter.jpg', mimeType: 'image/jpeg', buffer: SITE_PHOTO });
    await field.getByRole('textbox', { name: 'Moisture 1 m above the floor' }).fill('12');
    await field.locator('#question-salt').getByRole('radio', { name: 'Light' }).click();
    await field.getByLabel('Take the photo: Salt deposits (white bloom)').setInputFiles({ name: 'salt.jpg', mimeType: 'image/jpeg', buffer: SITE_PHOTO });
    await field.locator('#question-dpc_visible').getByRole('radio', { name: 'Yes' }).click();
    await field.locator('#question-water_source').getByRole('radio', { name: 'Rising damp' }).click();
    await next();

    // Two rooms, feet-inches, a door deducted — one card per row.
    await field.getByRole('button', { name: /New measured line/ }).click();
    await field.getByLabel('What are you measuring?').fill('Chemical damp treatment');
    await field.getByRole('button', { name: 'Start measuring' }).click();
    const addRoom = async (name) => {
      await field.locator('#new-room').fill(name);
      await field.getByRole('button', { name: /Add a room/ }).click();
    };
    const fillRow = async (name, what, nos, l, h) => {
      const row = field.getByRole('group', { name });
      await row.getByLabel('What').fill(what);
      await row.getByLabel('Nos').fill(nos);
      await row.getByLabel('Length').fill(l);
      await row.getByLabel('Height').fill(h);
      return row;
    };
    await addRoom('Living room');
    await fillRow('Row 1 — Living room', 'North wall', '1', '12\'6"', '10\'');
    await field.getByRole('button', { name: 'Add a row in Living room' }).click();
    const door = await fillRow('Row 2 — Living room', 'Door', '1', '3\'6"', '7\'');
    await door.getByRole('switch', { name: /Deduct/ }).click();
    await addRoom('Bedroom');
    await fillRow('Row 3 — Bedroom', 'East wall', '1', '11\'', '10\'');
    await expect(field.getByTestId('measurement-card')).toHaveCount(3);
    await expect(field.getByTestId('line-total')).toHaveText('This line: 210.5 sq.ft');
    await next();

    // A photo of the paper sketch, filed under its room.
    await field.getByRole('radio', { name: 'Paper sketch' }).click();
    await field.getByLabel('Room or area (optional)').fill('Living room');
    await field.getByLabel('Take a photo').setInputFiles({ name: 'sketch.jpg', mimeType: 'image/jpeg', buffer: SITE_PHOTO });
    await next();

    await field.getByLabel('Diagnosis — the cause, not the symptom').fill('Rising damp — no DPC at the plinth.');
    await next();

    // The measured line takes its work item from the rate card (a code and a name — never a rate).
    const line = field.getByRole('group', { name: 'Line 1' });
    await expect(line.getByText('Measured: 210.5 sq.ft')).toBeVisible();
    await line.getByRole('combobox', { name: 'Line 1: Work item' }).click();
    await field.getByRole('option', { name: /SEEP-CHEM/ }).click();
    expect(await field.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await field.getByRole('button', { name: 'Submit survey' }).click();
    await field.waitForURL(/\/tech\/surveys$/, { timeout: 30_000 });

    // Everything waited on the phone: the office has only the empty draft.
    await expect(field.getByRole('button', { name: /^Offline — \d+ waiting/ })).toBeVisible();
    expect((await sales.get(`/admin/surveys/${booked.survey.id}`)).status).toBe('DRAFT');

    // Signal again: the queue drains by itself — the photos, then the save that needed their ids, then the submit.
    await fieldCtx.setOffline(false);
    await expect.poll(async () => (await sales.get(`/admin/surveys/${booked.survey.id}`)).status, { timeout: 60_000 }).toBe('SUBMITTED');
    await fieldCtx.close();
  });

  let surveyItem;
  await test.step('the office has the survey: the flagged reading with its photo, the rows, the pin, the sketch by room', async () => {
    const survey = await sales.get(`/admin/surveys/${booked.survey.id}`);
    expect(survey.status).toBe('SUBMITTED');
    const moisture = survey.readings.find((r) => r.questionKey === 'moisture_low');
    expect(moisture).toMatchObject({ value: 24, flagged: true });
    expect(moisture.mediaId).toBeTruthy();
    expect(survey.readings.find((r) => r.questionKey === 'salt').mediaId).toBeTruthy();
    [surveyItem] = survey.items;
    expect(surveyItem.measurements.map(rowOf)).toEqual([
      { area: 'Living room', description: 'North wall', nos: 1, l: 12.5, b: null, h: 10, deduct: false },
      { area: 'Living room', description: 'Door', nos: 1, l: 3.5, b: null, h: 7, deduct: true },
      { area: 'Bedroom', description: 'East wall', nos: 1, l: 11, b: null, h: 10, deduct: false },
    ]);
    expect(Number(surveyItem.qty)).toBe(210.5);
    expect(survey.site.lat).toBeCloseTo(27.6712, 3);
    expect(survey.job.photos).toContainEqual(expect.objectContaining({ kind: 'SKETCH', area: 'Living room' }));
  });

  await test.step('SALES builds the quotation from the survey: the BOQ row carries the same measurements and quantity', async () => {
    await page.goto(`/admin/surveys/${booked.survey.id}`);
    await expect(page.getByText('Flagged', { exact: false }).first()).toBeVisible();
    const build = page.getByRole('button', { name: 'Build quotation' });
    await expect(build).toBeEnabled();
    await build.click();
    await page.waitForURL(/\/admin\/quotations\/[^/]+$/);
    const quotation = await sales.get(`/admin/quotations/${page.url().split('/').pop()}`);
    const row = quotation.items.find((r) => r.rowType === 'ITEM' && r.measurements?.length);
    expect(row, 'a measured BOQ row').toBeTruthy();
    expect(row.measurements.map(rowOf)).toEqual(surveyItem.measurements.map(rowOf));
    expect(Number(row.netQty ?? row.qty)).toBe(Number(surveyItem.qty));
  });

  await salesCtx.close();
  await Promise.all([admin, sales].map((c) => c.dispose()));
});
