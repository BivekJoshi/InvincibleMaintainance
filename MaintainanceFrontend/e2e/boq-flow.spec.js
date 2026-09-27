import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';
import { approveInDialog, rupeesText } from './support/quotation.js';

/**
 * Phase L3's acceptance, end to end: SALES builds a bill of quantities in the builder — sections and rows by
 * keyboard, 15 rows pasted from Excel, a row from the rate library with `/`, a measured line and an optional
 * row — saves it, checks the server's totals are the ones the builder showed, and submits; a MANAGER sees the
 * margin, approves and sends. Phase L4: the pasted rows have no known cost, so the approval needs the low-margin
 * acknowledgement; the customer opens the link on a 360 px phone — the sections, the default 50 · 40 · 10 payment
 * schedule with the server's amounts, the total in words — SALES sees "Opened 1×", and the customer accepts.
 * Phases L5–L8 extend this walk.
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

  await customerCtx.close();
  await salesCtx.close();
  await Promise.all([admin, sales, manager].map((c) => c.dispose()));
});
