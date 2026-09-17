import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';

/**
 * Phase F's acceptance, end to end: the customer books, the surveyor reports, the office
 * prices and approves, the customer asks for changes in Nepali, the office revises and
 * approves again, the customer accepts — and the CRM, the dispatch queue and the
 * notifications show exactly what was decided.
 *
 * A person's steps run in the browser; set-up steps that are not under test run over the
 * API. Everything is keyed to a unique name and phone, so leftovers from other runs never
 * matter.
 */

const tag = Date.now().toString(36);
const customerName = `E2E Customer ${tag}`;
const phone = `98${String(Date.now()).slice(-8)}`;
const nepaliRequest = 'कृपया बार्दलीको भित्ता पनि थप्नुहोस् र मूल्य घटाउनुहोस्।';

test.describe.configure({ mode: 'serial' });

test('booking → survey → approval → change request → revision → acceptance → job', async ({ browser }) => {
  const [admin, sales, manager, surveyor, dispatcher] = await Promise.all(
    ['ADMIN', 'SALES', 'MANAGER', 'SURVEYOR', 'DISPATCHER'].map((r) => apiAs(r)),
  );
  // The decisions this run relies on: maker-checker on, no auto-approval.
  await admin.patch('/admin/settings', { values: { 'quotation.makerChecker': true, 'quotation.autoApproveBelow': 0 } });

  const customer = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const salesCtx = await browser.newContext();
  const managerCtx = await browser.newContext();
  const started = new Date();

  // ── 1 · the customer books a visit at /book (browser, phone width)
  await test.step('customer books at /book', async () => {
    const page = await customer.newPage();
    await page.goto('/book');
    await page.getByRole('button', { name: /^Seepage & Damp Treatment/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('spinbutton', { name: 'Approximate sq.ft' }).fill('240');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d/ }).first().click();
    await page.getByRole('button', { name: /^Afternoon/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: 'Your name' }).fill(customerName);
    await page.getByRole('textbox', { name: 'Phone number' }).fill(phone);
    await page.getByRole('textbox', { name: 'Address' }).fill('Baneshwor, Kathmandu');
    await page.getByRole('textbox', { name: 'Anything we should know?' }).fill('भुइँतलाको भित्तामा चिस्यान।');
    // The anti-spam check wants a human's pace.
    await page.waitForTimeout(2500);
    const booked = page.waitForResponse((r) => r.url().includes('/api/v1/public/leads') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    expect((await booked).status()).toBe(201);
    await page.close();
  });

  // ── 2 · sales converts it with an inspection visit (API)
  const lead = (await sales.list(`/admin/leads?q=${encodeURIComponent(customerName)}&limit=5`)).data[0];
  expect(lead, 'the booking created a lead').toBeTruthy();
  expect(lead.source).toBe('booking');
  const technicians = (await sales.list('/admin/technicians?limit=100')).data;
  const surveyorProfile = technicians.find((t) => t.user?.email === 'survey@gharjatan.com.np');
  const converted = await sales.post(`/admin/leads/${lead.id}/convert`, {
    createNewCustomer: true,
    site: { label: 'Home', address: 'Baneshwor, Kathmandu' },
    createInspectionJob: true,
    scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
    surveyorId: surveyorProfile.id,
  });
  expect(converted.survey?.id, 'convert with a surveyor creates the survey').toBeTruthy();

  // ── 3 · the surveyor reports quantities and submits (API)
  const rateCard = await surveyor.get('/tech/rate-card');
  const seepChem = rateCard.find((r) => r.code === 'SEEP-CHEM');
  await surveyor.post(`/tech/surveys/${converted.survey.id}/submit`, {
    diagnosis: 'Rising damp on the north wall.',
    readings: [{ label: 'North wall, 300mm', metric: 'moisture', value: 21.5, unit: '%' }],
    items: [{ kind: 'SERVICE', rateCardItemId: seepChem.id, description: 'Crystalline seepage treatment', unit: 'sq.ft', qty: 240 }],
  });

  // ── 4 · sales builds the quotation from the survey and submits it (browser)
  const salesPage = await salesCtx.newPage();
  let quotationId;
  await test.step('sales prices the survey and submits the quotation', async () => {
    await signIn(salesPage, 'SALES');
    await salesPage.goto(`/admin/surveys/${converted.survey.id}`);
    await salesPage.getByRole('button', { name: 'Build quotation' }).click();
    await salesPage.waitForURL(/\/admin\/quotations\/[^/]+$/);
    quotationId = salesPage.url().split('/').pop();
    await expect(salesPage.getByTestId('waiting-for')).toContainText('Draft');
    // Sales cannot approve their own work: there is no Approve button for them at all.
    await expect(salesPage.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await salesPage.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(salesPage.getByTestId('waiting-for')).toContainText('Waiting for a manager');
    // Not sendable before approval.
    await expect(salesPage.getByRole('button', { name: 'Send to customer' })).toHaveCount(0);
  });

  // ── 5 · the manager approves (browser)
  await test.step('manager approves', async () => {
    const page = await managerCtx.newPage();
    await signIn(page, 'MANAGER');
    await page.goto('/admin/quotations?stage=approval');
    await page.getByRole('row', { name: new RegExp(customerName) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/quotations/${quotationId}$`));
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve this quotation' });
    await dialog.getByRole('textbox').fill('Rates match the rate card.');
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByTestId('waiting-for')).toContainText('ready to send');
  });

  // ── 6 · sales sends it (browser)
  let firstLink;
  await test.step('sales sends it', async () => {
    await salesPage.reload();
    await salesPage.getByRole('button', { name: 'Send to customer' }).click();
    await salesPage.getByRole('alertdialog').getByRole('button', { name: 'Send' }).click();
    await expect(salesPage.getByTestId('public-link')).toBeVisible();
    firstLink = new URL(await salesPage.getByTestId('public-link').innerText()).pathname;
    await expect(salesPage.getByTestId('waiting-for')).toContainText('With the customer');
  });

  // ── 7 · the customer asks for changes, in Nepali (browser, phone)
  await test.step('customer asks for changes in Nepali', async () => {
    const page = await customer.newPage();
    await page.goto(firstLink);
    await expect(page.getByRole('heading', { name: 'Is this quotation right for you?' })).toBeVisible();
    await page.getByRole('button', { name: 'Ask for changes' }).click();
    const dialog = page.getByRole('dialog', { name: 'What would you like changed?' });
    await dialog.getByRole('textbox').fill(nepaliRequest);
    await dialog.getByRole('button', { name: 'Send my request' }).click();
    await expect(page.getByText('Thank you — we have your request')).toBeVisible();
    await expect(page.getByText(nepaliRequest)).toBeVisible();
    await page.close();
  });

  // ── 8 · sales revises and submits, the manager approves, sales sends (API)
  const v1 = await sales.get(`/admin/quotations/${quotationId}`);
  expect(v1).toMatchObject({ status: 'CHANGES_REQUESTED', decisionNote: nepaliRequest });
  const v2 = await sales.post(`/admin/quotations/${quotationId}/revise`);
  expect(v2).toMatchObject({ version: 2, status: 'DRAFT', requestedChanges: nepaliRequest });
  expect((await sales.post(`/admin/quotations/${v2.id}/submit`)).status).toBe('PENDING_APPROVAL');
  expect((await manager.post(`/admin/quotations/${v2.id}/approve`, {})).status).toBe('OFFICE_APPROVED');
  const sentV2 = await sales.post(`/admin/quotations/${v2.id}/send`);
  const secondLink = `/quotation/${sentV2.publicToken}`;

  // ── 9 · the old link says replaced; the customer accepts the new one (browser, phone)
  await test.step('customer accepts the new version', async () => {
    const page = await customer.newPage();
    await page.goto(firstLink);
    await expect(page.getByText('There is a newer version of this quotation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Open the latest version' }).click();
    await expect(page).toHaveURL(new RegExp(`${secondLink}$`));
    await expect(page.getByText(nepaliRequest)).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();
    const dialog = page.getByRole('dialog', { name: 'Accept this quotation?' });
    await expect(dialog.getByTestId('accept-total')).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes, accept' }).click();
    await expect(page.getByText('Thank you — quotation accepted')).toBeVisible();
    await expect(page.getByText(/call you to schedule the work/)).toBeVisible();
    // Nothing on a phone overflows sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  // ── 10 · what the business sees (API)
  const accepted = await sales.get(`/admin/quotations/${v2.id}`);
  expect(accepted.status).toBe('CONVERTED');
  expect((await sales.get(`/admin/leads/${lead.id}`)).status).toBe('WON');

  const unassigned = (await dispatcher.list(`/admin/jobs?customerId=${converted.customer.id}&unassigned=true&limit=20`)).data;
  expect(unassigned, 'exactly one job waits in the unassigned queue').toHaveLength(1);
  expect(unassigned[0]).toMatchObject({ status: 'DRAFT', type: 'REPAIR', scheduledStart: null, quotationId: v2.id });
  expect(unassigned[0].tasks.length).toBeGreaterThan(0);

  const acceptedNotes = async (client) => (await client.list('/admin/notifications?limit=100')).data
    .filter((n) => n.type === 'quotation_accepted' && new Date(n.createdAt) >= started)
    .filter((n) => n.link === `/admin/quotations/${v2.id}` || n.link === `/admin/jobs/${unassigned[0].id}`);
  expect(await acceptedNotes(sales), 'salesperson and creator: one notification').toHaveLength(1);
  expect(await acceptedNotes(manager), 'the approving manager').toHaveLength(1);
  const forDispatcher = await acceptedNotes(dispatcher);
  expect(forDispatcher, 'every dispatcher').toHaveLength(1);
  expect(forDispatcher[0].link).toBe(`/admin/jobs/${unassigned[0].id}`);
  expect(await acceptedNotes(admin), 'nobody else').toHaveLength(0);

  // The trail is in the audit log.
  const trail = (await admin.list(`/admin/audit-logs?recordId=${v2.id}&limit=100`)).data.map((r) => r.event).filter(Boolean);
  expect(trail).toEqual(expect.arrayContaining([
    'quotation.revised', 'quotation.submitted', 'quotation.office_approved', 'quotation.sent', 'quotation.customer_approved',
  ]));

  await Promise.all([customer.close(), salesCtx.close(), managerCtx.close()]);
  await Promise.all([admin, sales, manager, surveyor, dispatcher].map((c) => c.dispose()));
});
