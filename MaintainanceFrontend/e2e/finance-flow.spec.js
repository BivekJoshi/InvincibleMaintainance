import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';

/**
 * Phase I's manual walk-through, as the accountant (accounts@gharjatan.com.np): a finished job no invoice has taken
 * is invoiced from the Invoices page (it bills what it used — 10 × Rs. 2,500 of material, 13 % VAT: Rs. 28,250.00),
 * sent, paid Rs. 10,000 by eSewa, that payment voided (struck through, the balance back up), then settled with two
 * payments — cash and a bank transfer — to PAID. Aging lists it while money is owed and drops it once paid;
 * collections show the two payments and not the voided one; the collections CSV carries its header and the bank
 * payment's row. Every figure checked on screen is the server's.
 *
 * Set-up that is not under test (a customer and a completed, unquoted job with billable material) runs over the API.
 */

const tag = Date.now().toString(36);
const customerName = `बिल E2E ${tag}`;
const phone = `98${String(Date.now()).slice(-8)}`;
/** Kathmandu's calendar day today. */
const ktmToday = () => new Date(Date.now() + 345 * 60_000).toISOString().slice(0, 10);

test.describe.configure({ mode: 'serial' });

test('accountant: invoice a job, send, pay part by eSewa, void it, settle in two payments; aging, collections and CSV follow', async ({ browser }) => {
  const [sales, dispatcher, accountant] = await Promise.all(['SALES', 'DISPATCHER', 'ACCOUNTANT'].map((r) => apiAs(r)));

  // ── set-up: a completed job that used 10 units of billable material at Rs. 2,500
  const customer = await sales.post('/admin/customers', { name: customerName, phone, preferredLocale: 'ne' });
  const job = await dispatcher.post('/admin/jobs', { customerId: customer.id, title: `Seepage repair ${tag}` });
  const hari = (await dispatcher.list('/admin/technicians?q=hari&limit=10')).data.find((t) => t.user.email === 'hari@gharjatan.com.np');
  await dispatcher.post(`/admin/jobs/${job.id}/assign`, { technicianIds: [hari.id] });
  await dispatcher.patch(`/admin/jobs/${job.id}/status`, { status: 'IN_PROGRESS' });
  const material = (await dispatcher.list('/admin/materials?q=WP-CRYST')).data[0];
  await dispatcher.post('/admin/stock/movements', { materialId: material.id, type: 'PURCHASE', qty: 10, reference: `E2E ${tag}` });
  await dispatcher.post(`/admin/jobs/${job.id}/materials`, { materialId: material.id, qty: 10, rate: 2500, isBillable: true });
  await dispatcher.post(`/admin/jobs/${job.id}/complete`, { note: 'Treated and replastered.', warrantyDays: 0 });
  expect((await dispatcher.get(`/admin/jobs/${job.id}`)).status).toBe('COMPLETED');

  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await signIn(page, 'ACCOUNTANT');
  const figures = page.getByTestId('invoice-figures');
  let invoiceId;
  let invoiceNumber;

  const recordPayment = async (amount, method, reference) => {
    await page.getByRole('button', { name: 'Record payment' }).first().click();
    const sheet = page.getByRole('dialog', { name: /Record a payment/ });
    await sheet.getByLabel(/Amount received/).fill(amount);
    if (method !== 'Cash') {
      await sheet.getByRole('combobox', { name: /Method/ }).click();
      await page.getByRole('option', { name: method }).click();
    }
    if (reference) await sheet.getByLabel(/Reference/).fill(reference);
    await sheet.getByRole('button', { name: 'Record payment' }).click();
    await expect(sheet).toBeHidden();
  };

  await test.step('create the invoice from the job — it bills what it used', async () => {
    await page.goto('/admin/invoices');
    await page.getByRole('button', { name: 'Create from job' }).click();
    const sheet = page.getByRole('dialog', { name: 'Create an invoice from a job' });
    await sheet.getByRole('textbox', { name: 'Search' }).fill(job.number);
    await sheet.getByRole('textbox', { name: 'Search' }).press('Enter');
    await sheet.getByText(`Seepage repair ${tag}`).click();
    // The sheet now names the job it is invoicing.
    const picked = page.getByRole('dialog', { name: `Invoice ${job.number}` });
    await expect(picked.getByTestId('billing-rule')).toContainText('Bills what it used');
    await expect(picked.getByRole('switch', { name: 'Bill the materials' })).toBeChecked();
    await picked.getByRole('button', { name: 'Create draft invoice' }).click();
    await page.waitForURL(/\/admin\/invoices\/[^/]+$/);
    invoiceId = page.url().split('/').pop();
    const draft = await accountant.get(`/admin/invoices/${invoiceId}`);
    invoiceNumber = draft.number;
    expect(draft).toMatchObject({ status: 'DRAFT', subtotal: 2_500_000, vatAmount: 325_000, total: 2_825_000 });
    await expect(figures).toContainText('Rs. 28,250.00');
    await expect(page.getByRole('grid', { name: 'Invoice lines' })).toBeVisible();
  });

  await test.step('send it — the customer link appears, and the draft is locked', async () => {
    await page.getByRole('button', { name: 'Send to customer' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send invoice' }).click();
    const sent = page.getByRole('dialog', { name: `${invoiceNumber} is with the customer` });
    await expect(sent.getByTestId('public-link')).toContainText('/invoice/');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('invoice-status')).toHaveText('Sent');
    await expect(page.getByRole('tab', { name: 'Edit' })).toHaveCount(0);
  });

  await test.step('a partial eSewa payment, then its void — struck through, the balance back up', async () => {
    await recordPayment('10,000', 'eSewa', `ESW-${tag}`);
    await expect(figures).toContainText('Rs. 18,250.00');
    await expect(page.getByTestId('invoice-status')).toHaveText('Part paid');

    await page.getByRole('tab', { name: 'Payments (1)' }).click();
    await page.getByRole('button', { name: /Actions for Rs\. 10,000\.00 by eSewa/ }).click();
    await page.getByRole('menuitem', { name: 'Void payment…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Void the Rs. 10,000.00 payment?' });
    await dialog.getByLabel(/Why is it void/).fill('Entered against the wrong invoice');
    await dialog.getByRole('button', { name: 'Void payment' }).click();
    await expect(page.getByTestId('invoice-status')).toHaveText('Sent');
    await expect(figures.getByText('Rs. 28,250.00')).toHaveCount(2);
    await expect(page.getByTestId('voided-amount')).toHaveText('Rs. 10,000.00');
    const after = await accountant.get(`/admin/invoices/${invoiceId}`);
    expect(after).toMatchObject({ status: 'SENT', paidAmount: 0, balance: 2_825_000 });
    expect(after.payments[0]).toMatchObject({ method: 'ESEWA', voidReason: 'Entered against the wrong invoice' });
  });

  await test.step('cash first — aging lists what is still owed', async () => {
    await recordPayment('10,000', 'Cash');
    await expect(figures).toContainText('Rs. 18,250.00');
    const aging = await accountant.get('/admin/reports/aging');
    expect(aging.invoices.find((i) => i.id === invoiceId)).toMatchObject({ outstanding: 1_825_000, bucket: 'current' });

    await page.goto('/admin/finance/reports?report=aging');
    const row = page.getByRole('row').filter({ hasText: invoiceNumber });
    await expect(row).toContainText('Rs. 18,250.00');
    await row.click();
    await page.waitForURL(new RegExp(`/admin/invoices/${invoiceId}$`));
  });

  await test.step('the bank transfer settles it — PAID, and gone from aging', async () => {
    await recordPayment('18,250', 'Bank transfer', `NIC-${tag}`);
    await expect(page.getByTestId('invoice-status')).toHaveText('Paid');
    await expect(figures).toContainText('Rs. 0.00');
    const paid = await accountant.get(`/admin/invoices/${invoiceId}`);
    expect(paid).toMatchObject({ status: 'PAID', paidAmount: 2_825_000, balance: 0 });
    const aging = await accountant.get('/admin/reports/aging');
    expect(aging.invoices.some((i) => i.id === invoiceId)).toBe(false);
  });

  await test.step('collections show the two payments, not the voided one; the CSV carries them', async () => {
    const today = ktmToday();
    const collections = await accountant.get(`/admin/reports/collections?from=${today}&to=${today}`);
    const ours = collections.payments.filter((p) => p.invoice.id === invoiceId);
    expect(ours.map((p) => p.method).sort()).toEqual(['BANK', 'CASH']);
    expect(collections.byMethod.BANK).toBeGreaterThanOrEqual(1_825_000);

    await page.goto(`/admin/finance/reports?report=collections&from=${today}&to=${today}`);
    await expect(page.getByRole('row').filter({ hasText: invoiceNumber })).toHaveCount(2);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download collections as CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^collections-.*\.csv$/);
    const text = (await readFile(await download.path(), 'utf8')).replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    expect(lines[0]).toBe('Received,Invoice,Customer,Method,Reference,Amount (Rs)');
    const bank = lines.find((l) => l.includes(invoiceNumber) && l.includes(',BANK,'));
    expect(bank).toContain(`NIC-${tag}`);
    expect(bank.endsWith(',18250.00')).toBe(true);
    expect(lines.some((l) => l.includes(`ESW-${tag}`))).toBe(false);
  });

  await ctx.close();
  await Promise.all([sales, dispatcher, accountant].map((a) => a.dispose()));
});
