import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { apiAs, signIn } from './support/api.js';

/**
 * Phase H2's walk-through, as Hari on a 360 px phone: today → on my way → start → tick the first item and
 * start the timer → **no signal** → a photo, a material and another tick, all kept on the phone → signal
 * again → the queue drains by itself → the last tick, the customer signs, complete. Then the dispatcher
 * finds everything on the job: the photos (the signature among them), the material, the time, the checklist
 * and the warranty that completion creates.
 *
 * The job itself is set up over the API (the dispatch side is Phase H1's spec).
 */

const tag = Date.now().toString(36);
const photo = fileURLToPath(new URL('./fixtures/site-photo.jpg', import.meta.url));
const TASKS = ['Photograph the leak', 'Replace the waste pipe', 'Run the water for ten minutes'];

/** Polls the API until `check(job)` holds — the phone syncs in the background. */
async function eventually(dispatcher, jobId, check) {
  await expect.poll(async () => check(await dispatcher.get(`/admin/jobs/${jobId}`)), { timeout: 20_000 }).toBe(true);
}

test('field: a job finished on a phone, partly offline — everything reaches the office', async ({ browser }) => {
  const [sales, dispatcher] = await Promise.all([apiAs('SALES'), apiAs('DISPATCHER')]);

  // ── set-up: a job on Hari's today, with a three-item checklist
  const customer = await sales.post('/admin/customers', {
    name: `ग्राहक Field ${tag}`, phone: `97${String(Date.now()).slice(-8)}`, preferredLocale: 'ne',
  });
  const hari = (await dispatcher.list('/admin/technicians?q=hari&limit=10')).data.find((t) => t.user.email === 'hari@gharjatan.com.np');
  // A minute ago: whatever the hour, it is on Hari's Kathmandu today.
  const start = new Date(Date.now() - 60_000);
  const job = await dispatcher.post('/admin/jobs', {
    customerId: customer.id,
    title: `Bathroom leak ${tag}`,
    scheduledStart: start.toISOString(),
    scheduledEnd: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    technicianIds: [hari.id],
  });
  for (const [i, title] of TASKS.entries()) await dispatcher.post(`/admin/jobs/${job.id}/tasks`, { title, sortOrder: i });
  const material = (await dispatcher.list('/admin/materials?q=WP-CRYST')).data[0];

  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  await signIn(page, 'TECHNICIAN');
  const header = page.locator('header');
  const allSent = header.getByRole('button', { name: 'All sent' });

  await test.step('today → on my way → open → start work', async () => {
    await page.goto('/tech');
    const card = page.getByRole('article', { name: new RegExp(job.number) });
    await card.getByRole('button', { name: 'On my way' }).click();
    await expect(card.getByText('On the way')).toBeVisible();
    await eventually(dispatcher, job.id, (j) => j.status === 'EN_ROUTE');

    await card.getByRole('link', { name: 'Open job' }).click();
    await expect(page.getByRole('heading', { name: job.title })).toBeVisible();
    await page.getByRole('button', { name: 'Start work' }).click();
    await expect(page.getByText('In progress').first()).toBeVisible();
    await eventually(dispatcher, job.id, (j) => j.status === 'IN_PROGRESS');
  });

  await test.step('tick the first item and start the timer, with signal', async () => {
    const first = page.getByRole('checkbox', { name: `Done: ${TASKS[0]}` });
    await first.click();
    await expect(first).toBeChecked();
    await page.getByRole('button', { name: 'Start timer' }).click();
    await expect(page.getByRole('button', { name: 'Stop timer' })).toBeVisible();
    await expect(allSent).toBeVisible();
    await eventually(dispatcher, job.id, (j) => j.tasks.find((t) => t.title === TASKS[0]).isDone && j.timeLogs.length === 1);
  });

  await test.step('no signal: a photo, a material and a tick wait on the phone', async () => {
    await ctx.setOffline(true);
    await expect(header.getByRole('button', { name: 'Offline' })).toBeVisible();

    await page.getByRole('radio', { name: 'During' }).click();
    await page.getByLabel('Caption (optional)').fill('Leak under the basin');
    await page.getByLabel('Take a photo').setInputFiles(photo);
    const photos = page.getByRole('list', { name: 'Photos' });
    await expect(photos.getByText('Waiting to upload')).toBeVisible();
    await expect(photos.getByText('Leak under the basin')).toBeVisible();

    await page.getByRole('button', { name: 'Log material' }).click();
    const sheet = page.getByRole('dialog', { name: 'Log a material' });
    await sheet.getByRole('searchbox', { name: 'Search by name or code' }).fill(material.code);
    await sheet.getByRole('button', { name: new RegExp(`${material.code} · `) }).click();
    await sheet.getByRole('button', { name: 'More' }).click();
    await sheet.getByRole('button', { name: 'More' }).click();
    await sheet.getByRole('button', { name: `Log 3 ${material.unit}` }).click();
    await expect(sheet).toBeHidden();
    const lines = page.getByRole('list', { name: 'Materials used' });
    await expect(lines.getByText(`3 ${material.unit}`)).toBeVisible();
    await expect(lines.getByLabel('waiting to send')).toBeVisible();

    const second = page.getByRole('checkbox', { name: `Done: ${TASKS[1]}` });
    await second.click();
    await expect(second).toBeChecked();

    // Two changes and one photo, counted in the header and said under it.
    await expect(header.getByRole('button', { name: 'Offline — 3 waiting' })).toBeVisible();
    await expect(page.getByText('No signal. 2 changes and 1 photo saved on this phone')).toBeVisible();
    // Nothing reached the office.
    const meanwhile = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(meanwhile.photos).toHaveLength(0);
    expect(meanwhile.materials).toHaveLength(0);
    expect(meanwhile.tasks.find((t) => t.title === TASKS[1]).isDone).toBe(false);
  });

  await test.step('signal again: the queue drains by itself', async () => {
    await ctx.setOffline(false);
    await expect(allSent).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('list', { name: 'Photos' }).getByText('Waiting to upload')).toHaveCount(0);
    await eventually(dispatcher, job.id, (j) => j.photos.some((p) => p.kind === 'DURING' && p.caption === 'Leak under the basin')
      && j.materials.some((m) => m.material.id === material.id && Number(m.qty) === 3)
      && j.tasks.find((t) => t.title === TASKS[1]).isDone);
  });

  await test.step('the last tick, the customer signs, complete', async () => {
    const complete = page.getByRole('button', { name: 'Complete job' });
    await expect(complete).toBeDisabled();
    await expect(page.getByText('1 checklist item is still open — tick it before completing.')).toBeVisible();
    await page.getByRole('checkbox', { name: `Done: ${TASKS[2]}` }).click();
    await expect(page.getByText('Ask the customer to sign in the box.')).toBeVisible();

    await page.getByLabel('What you did').fill('Waste pipe replaced; no leak after ten minutes.');
    await page.getByRole('button', { name: '5 of 5' }).click();

    const pad = page.getByRole('img', { name: 'Sign here with a finger' });
    // Centred, so the fixed tab bar is not over the box.
    await pad.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await pad.boundingBox();
    const y0 = box.y + box.height * 0.6;
    await page.mouse.move(box.x + 30, y0);
    await page.mouse.down();
    for (const [dx, dy] of [[40, -40], [80, 10], [120, -50], [160, 0], [200, -30]]) {
      await page.mouse.move(box.x + 30 + dx, y0 + dy, { steps: 6 });
    }
    await page.mouse.up();

    await expect(complete).toBeEnabled();
    await complete.click();
    await expect(page.getByText('This job is closed. You can look, not change.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
    await expect(allSent).toBeVisible();
  });

  await test.step('the dispatcher finds the photos, the material, the time and the signature', async () => {
    const done = await dispatcher.get(`/admin/jobs/${job.id}`);
    expect(done.status).toBe('COMPLETED');
    expect(done.signatureId).toEqual(expect.any(String));
    expect(done.photos.map((p) => p.kind).sort()).toEqual(['DURING', 'SIGNATURE']);
    expect(done.photos.find((p) => p.kind === 'SIGNATURE').mediaId).toBe(done.signatureId);
    expect(done.materials).toEqual([expect.objectContaining({ qty: 3, material: expect.objectContaining({ code: material.code }) })]);
    expect(done.timeLogs).toHaveLength(1);
    expect(done.timeLogs[0].endedAt).toEqual(expect.any(String)); // completion closed the running timer
    expect(done.timeLogs[0].minutes).toBeGreaterThanOrEqual(1);
    expect(done.tasks.every((t) => t.isDone)).toBe(true);
    expect(done.completionNote).toBe('Waste pipe replaced; no leak after ten minutes.');
    expect(done.customerRating).toBe(5);
    expect(done.warranty).toEqual(expect.objectContaining({ jobId: job.id }));

    const office = await browser.newContext();
    const desk = await office.newPage();
    await signIn(desk, 'DISPATCHER');
    await desk.goto(`/admin/jobs/${job.id}?tab=photos`);
    await expect(desk.getByRole('heading', { name: 'During (1)' })).toBeVisible();
    await expect(desk.getByRole('heading', { name: 'Signature (1)' })).toBeVisible();
    await desk.getByRole('tab', { name: /Materials/ }).click();
    await expect(desk.getByText(`3 ${material.unit}`).first()).toBeVisible();
    await desk.getByRole('tab', { name: /Time/ }).click();
    await expect(desk.getByText('Total recorded:')).toBeVisible();
    await office.close();
  });

  await ctx.close();
});
