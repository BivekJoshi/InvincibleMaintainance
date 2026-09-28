import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';

/**
 * Phase I's aftercare walk-through: a customer raises a warranty claim from the certificate link (no account); the
 * dispatcher accepts it in the claims queue and the free WARRANTY job appears — unassigned, in the dispatch
 * queue; then the dispatcher creates an AMC contract, and the visit schedule the sheet previewed is exactly the one
 * saved.
 *
 * Set-up that is not under test — a completed job with its warranty — runs over the API, as the other specs do.
 */

const tag = Date.now().toString(36);
const customerName = `ग्राहक Aftercare ${tag}`;
const phone = `98${String(Date.now() + 7).slice(-8)}`;

/** The 1st of the month `monthsAhead` from this Kathmandu month, `YYYY-MM-DD` — a calendar cell's `data-day`. */
function firstOfMonth(monthsAhead) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + monthsAhead, 1)).toISOString().slice(0, 10);
}

/** Every visit's due date in a schedule, as the API sends it. */
const dueDates = (visits) => visits.map((v) => new Date(v.dueDate).toISOString());

test.describe.configure({ mode: 'serial' });

test('aftercare: a claim from the certificate becomes a free job; an AMC contract lays down the previewed visits', async ({ browser }) => {
  const [sales, dispatcher] = await Promise.all(['SALES', 'DISPATCHER'].map((r) => apiAs(r)));

  // ── set-up: a Nepali-speaking customer's job, completed with a 30-day warranty
  const customer = await sales.post('/admin/customers', { name: customerName, phone, preferredLocale: 'ne' });
  const start = new Date(Date.now() - 2 * 86_400_000);
  const original = await dispatcher.post('/admin/jobs', {
    customerId: customer.id, type: 'REPAIR', title: `Terrace waterproofing ${tag}`,
    scheduledStart: start.toISOString(), scheduledEnd: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
  });
  await dispatcher.patch(`/admin/jobs/${original.id}/status`, { status: 'EN_ROUTE' });
  await dispatcher.patch(`/admin/jobs/${original.id}/status`, { status: 'IN_PROGRESS' });
  await dispatcher.post(`/admin/jobs/${original.id}/complete`, { note: 'Membrane laid.', warrantyDays: 30, warrantyScope: 'छत वाटरप्रुफिङ' });
  const { warranty } = await dispatcher.get(`/admin/jobs/${original.id}`);
  expect(warranty?.publicToken, 'completion issued the warranty').toBeTruthy();

  const description = `पानी फेरि चुहियो — the terrace leaks again (${tag}).`;

  await test.step('the customer raises a claim from the certificate link, on a phone, with no account', async () => {
    const customerCtx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await customerCtx.newPage();
    await page.goto(`/warranty/${warranty.publicToken}`);
    await page.locator('#claim').fill(description);
    await page.getByRole('button', { name: 'Raise a warranty claim' }).click();
    await expect(page.getByText('Your claim is with our team')).toBeVisible();
    await customerCtx.close();
    const claimed = await dispatcher.get(`/admin/warranties/${warranty.id}`);
    expect(claimed.status).toBe('CLAIMED');
    expect(claimed.claims.map((c) => [c.status, c.description])).toEqual([['open', description]]);
  });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, 'DISPATCHER');
  let freeJob;

  await test.step('dispatch accepts it in the queue → the free WARRANTY job, unassigned, in the dispatch queue', async () => {
    await page.goto('/admin/warranty-claims');
    await page.getByPlaceholder('Search customer, phone or job number…').fill(original.number);
    await page.getByText(description).click();
    const sheet = page.getByRole('dialog', { name: `Claim on ${original.number}` });
    await expect(sheet.getByText(description)).toBeVisible();
    // Dispatch holds reports:ops: the claim rate for this kind of work.
    await expect(sheet.getByRole('region', { name: 'Claim rate' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Accept — create the free job' }).click();

    const open = sheet.getByRole('link', { name: /^Open JOB-/ });
    await expect(open).toBeVisible();
    await expect(sheet.getByText(/it waits in the dispatch queue/)).toBeVisible();
    const number = (await open.textContent()).replace('Open', '').trim();

    const [queued] = (await dispatcher.list(`/admin/dispatch/unassigned?q=${encodeURIComponent(number)}`)).data;
    expect(queued, 'the free job is in the unassigned queue').toBeTruthy();
    freeJob = await dispatcher.get(`/admin/jobs/${queued.id}`);
    expect(freeJob).toMatchObject({ type: 'WARRANTY', isBillable: false, parentJobId: original.id, status: 'DRAFT' });
    expect(freeJob.assignments).toEqual([]);

    await open.click();
    await page.waitForURL(`**/admin/jobs/${freeJob.id}`);
    await expect(page.getByText('Nobody is on this job yet.')).toBeVisible();
    await expect(page.getByText(`Rework of ${original.number}`)).toBeVisible();
    const claim = (await dispatcher.get(`/admin/warranties/${warranty.id}`)).claims[0];
    expect(claim).toMatchObject({ status: 'accepted', resolvedJob: { id: freeJob.id, number } });
  });

  await test.step('an AMC contract: the schedule previewed before saving is the one saved', async () => {
    const previews = [];
    page.on('response', async (res) => {
      if (res.url().endsWith('/admin/amc-contracts/preview') && res.ok()) previews.push((await res.json()).data);
    });
    await page.goto('/admin/amc-contracts');
    await page.getByRole('button', { name: 'New contract' }).click();
    const sheet = page.getByRole('dialog', { name: 'New AMC contract' });

    await sheet.getByRole('combobox', { name: /Customer/ }).click();
    await page.keyboard.type(phone);
    await page.getByRole('option', { name: new RegExp(phone) }).click();
    await sheet.getByLabel(/^Plan/).fill(`Annual Home Care ${tag}`);

    // From the 1st of next month to the 1st a year after — the calendar, as a person picks it (it opens on this month).
    const pickFirst = async (label, monthsAhead) => {
      await sheet.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      for (let i = 0; i < monthsAhead; i += 1) await page.getByRole('button', { name: 'Go to the Next Month' }).click();
      await page.locator(`td[data-day="${firstOfMonth(monthsAhead)}"]:not([data-outside]) button`).click();
      await expect(page.getByRole('button', { name: 'Go to the Next Month' })).toBeHidden();
    };
    await pickFirst('Starts', 1);
    await pickFirst('Ends', 13);
    await sheet.getByLabel(/Visits a year/).fill('4');
    await sheet.getByLabel(/^Amount/).fill('24,000.50');

    const summary = sheet.getByTestId('schedule-summary');
    await expect(summary).toContainText('4 visits');
    const shown = await sheet.getByRole('list', { name: 'Visits' }).getByRole('listitem').allTextContents();
    const previewed = previews.at(-1);
    expect(shown).toHaveLength(previewed.totalVisits);

    await sheet.getByRole('button', { name: 'Create contract' }).click();
    await page.waitForURL(/\/admin\/amc-contracts\/[^/]+$/);
    const id = page.url().split('/').pop();
    const saved = await dispatcher.get(`/admin/amc-contracts/${id}`);
    expect(saved.amount).toBe(2_400_050);
    expect(saved.customer.id).toBe(customer.id);
    expect(dueDates(saved.visits)).toEqual(dueDates(previewed.visits));
    expect(saved.visits.every((v) => v.status === 'pending' && !v.job)).toBe(true);
    await expect(page.getByTestId('amc-amount')).toHaveText('Rs. 24,000.50');
    await expect(page.getByRole('region', { name: 'Visits' }).getByText('Not booked yet')).toHaveCount(saved.visits.length);
  });

  await ctx.close();
  await Promise.all([sales, dispatcher].map((c) => c.dispose()));
});
