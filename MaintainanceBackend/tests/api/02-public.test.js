import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, createCustomer, createCompletedJob, prisma, phone, dayMatching, uid,
} from './helpers.js';

const lead = (extra = {}) => ({
  name: 'Public Test Lead', phone: phone(), message: 'Damp on the wall', elapsedMs: 6000, website: '', ...extra,
});

describe('public content', () => {
  it('GET /public/bootstrap carries settings, nav and booking rules', async () => {
    const body = expectStatus(await anon().get('/public/bootstrap'), 200);
    expect(body.data.settings).toBeTypeOf('object');
    expect(Array.isArray(body.data.nav.categories)).toBe(true);
    expect(body.data.booking).toBeTypeOf('object');
  });

  it('GET /public/bootstrap?locale=ne works', async () => {
    expectStatus(await anon().get('/public/bootstrap?locale=ne'), 200);
  });

  it('GET /public/home returns ordered sections', async () => {
    const body = expectStatus(await anon().get('/public/home'), 200);
    expect(body.data.sections.length).toBeGreaterThan(5);
  });

  let serviceSlug;
  let pricedServiceId;
  it('GET /public/services lists the catalogue', async () => {
    const body = expectStatus(await anon().get('/public/services'), 200);
    expect(body.data.items.length).toBeGreaterThan(0);
    serviceSlug = body.data.items[0].slug;
    pricedServiceId = body.data.items.find((s) => s.priceFrom)?.id;
    expect(pricedServiceId).toBeTruthy();
  });

  it('GET /public/services?category= filters by category', async () => {
    const boot = expectStatus(await anon().get('/public/bootstrap'), 200);
    const category = boot.data.nav.categories[0];
    const body = expectStatus(await anon().get(`/public/services?category=${category.slug}`), 200);
    expect(body.data.items.every((s) => s.category?.slug === category.slug || s.categoryId === category.id)).toBe(true);
  });

  it('GET /public/services/:slug returns the service, faqs and related work', async () => {
    const body = expectStatus(await anon().get(`/public/services/${serviceSlug}`), 200);
    expect(body.data.service.slug).toBe(serviceSlug);
  });

  it('GET /public/services/:slug is 404 for an unknown slug', async () => {
    expectStatus(await anon().get('/public/services/no-such-service'), 404);
  });

  it('GET /public/projects and /public/projects/:slug', async () => {
    const list = expectStatus(await anon().get('/public/projects'), 200);
    expect(list.data.items.length).toBeGreaterThan(0);
    const slug = list.data.items[0].slug;
    const one = expectStatus(await anon().get(`/public/projects/${slug}`), 200);
    expect(one.data.project.slug).toBe(slug);
    expectStatus(await anon().get('/public/projects/no-such-project'), 404);
  });

  it('GET /public/projects?service= filters by service', async () => {
    const body = expectStatus(await anon().get('/public/projects?service=seepage-and-damp-treatment'), 200);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it.each([
    '/public/offers', '/public/pricing', '/public/gallery', '/public/testimonials',
    '/public/faqs', '/public/posts',
  ])('GET %s', async (path) => {
    expectStatus(await anon().get(path), 200);
  });

  it('GET /public/pricing carries plans, the rate card and services', async () => {
    const body = expectStatus(await anon().get('/public/pricing'), 200);
    expect(body.data.rateCard.length).toBeGreaterThan(0);
    expect(Array.isArray(body.data.plans)).toBe(true);
  });

  it('GET /public/pages/:slug and /public/posts/:slug are 404 when missing', async () => {
    expectStatus(await anon().get('/public/pages/no-such-page'), 404);
    expectStatus(await anon().get('/public/posts/no-such-post'), 404);
  });

  it('caches public reads', async () => {
    await anon().get('/public/faqs');
    const res = await anon().get('/public/faqs');
    expect(res.headers['x-cache']).toBe('HIT');
  });

  it('GET /public/availability returns days and slots', async () => {
    const body = expectStatus(await anon().get('/public/availability?days=7'), 200);
    expect(body.data).toBeTruthy();
  });

  it('POST /public/estimate prices a service', async () => {
    const body = expectStatus(await anon().post('/public/estimate').send({ serviceId: pricedServiceId, qty: 100 }), 200);
    expect(body.data.min).toBeGreaterThan(0);
    expect(body.data.max).toBeGreaterThanOrEqual(body.data.min);
  });

  it('POST /public/estimate needs a service or a plan', async () => {
    expectStatus(await anon().post('/public/estimate').send({ qty: 100 }), 400);
  });
});

describe('POST /public/leads', () => {
  it('creates a lead on a genuine submission', async () => {
    const body = expectStatus(await anon().post('/public/leads').send(lead()), 201);
    expect(body.data.id ?? body.data.lead?.id).toBeTruthy();
  });

  it('rejects a filled honeypot', async () => {
    expectStatus(await anon().post('/public/leads').send(lead({ website: 'spam' })), 400);
  });

  it('rejects a submission faster than a human', async () => {
    expectStatus(await anon().post('/public/leads').send(lead({ elapsedMs: 300 })), 400);
  });

  it('rejects a phone number that is not Nepali', async () => {
    expectStatus(await anon().post('/public/leads').send(lead({ phone: '12345' })), 400);
  });

  it('accepts +977 and spaces in the phone number', async () => {
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(lead({ phone: `+977 ${number.slice(0, 3)} ${number.slice(3)}` })), 201);
  });

  it('keeps Nepali text intact', async () => {
    const message = 'भुइँतलाको भित्तामा चिस्यान';
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(lead({ phone: number, message })), 201);
    const saved = await prisma.lead.findFirst({ where: { phone: number } });
    expect(saved.message).toBe(message);
  });

  it('books an open day as a booking lead', async () => {
    const date = dayMatching((d) => d !== 6);
    const number = phone();
    expectStatus(await anon().post('/public/leads').send(lead({
      phone: number, preferredAt: `${date}T06:00:00.000Z`, preferredSlot: 'morning',
    })), 201);
    const saved = await prisma.lead.findFirst({ where: { phone: number } });
    expect(saved.source).toBe('booking');
    expect(saved.preferredSlot).toBe('morning');
  });

  it('refuses a booking on a closed weekday', async () => {
    const date = dayMatching((d) => d === 6);
    expectStatus(await anon().post('/public/leads').send(lead({
      preferredAt: `${date}T06:00:00.000Z`, preferredSlot: 'morning',
    })), 400);
  });

  it('refuses a booking in the past', async () => {
    expectStatus(await anon().post('/public/leads').send(lead({
      preferredAt: '2020-01-01T06:00:00.000Z', preferredSlot: 'morning',
    })), 400);
  });

  it('rate-limits one address', async () => {
    const ip = '203.0.113.77';
    const statuses = [];
    for (let i = 0; i < 8; i += 1) {
      statuses.push((await anon(ip).post('/public/leads').send(lead())).status);
    }
    expect(statuses).toContain(429);
  });
});

describe('customer documents by token', () => {
  let quotationToken;

  beforeAll(async () => {
    const sales = await as('SALES');
    const customer = await createCustomer(sales);
    const q = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id,
      items: [{ description: 'Waterproofing', unit: 'sq.ft', qty: 100, rate: 150 }],
    }), 201).data;
    const sent = expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200).data;
    quotationToken = sent.publicToken ?? (await prisma.quotation.findUnique({ where: { id: q.id } })).publicToken;
  });

  it('GET /public/quotations/:token shows the quotation', async () => {
    const body = expectStatus(await anon().get(`/public/quotations/${quotationToken}`), 200);
    expect(body.data.items.length).toBe(1);
    expect(body.data.status).toBe('SENT');
  });

  it('POST /public/quotations/:token/decide approves once, then refuses a second decision', async () => {
    expectStatus(await anon().post(`/public/quotations/${quotationToken}/decide`).send({ decision: 'approve', note: 'Go ahead' }), 200);
    const again = await anon().post(`/public/quotations/${quotationToken}/decide`).send({ decision: 'reject' });
    expect(again.status).toBe(422);
  });

  it('POST /public/quotations/:token/decide refuses an expired quotation nobody has opened', async () => {
    // Expiry used to be applied only by a GET, so a customer who tapped "approve"
    // straight from an old SMS approved a price that had lapsed.
    const sales = await as('SALES');
    const customer = await createCustomer(sales);
    const q = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id,
      validUntil: new Date(Date.now() - 86_400_000).toISOString(),
      items: [{ description: 'Stale offer', qty: 1, rate: 500 }],
    }), 201).data;
    expectStatus(await sales.post(`/admin/quotations/${q.id}/send`), 200);
    const { publicToken } = await prisma.quotation.findUnique({ where: { id: q.id } });

    const res = expectStatus(await anon().post(`/public/quotations/${publicToken}/decide`).send({ decision: 'approve' }), 422);
    expect(res.error.message).toMatch(/expired/i);
    const after = await prisma.quotation.findUnique({ where: { id: q.id } });
    expect(after.status).toBe('EXPIRED');
    expect(after.decidedAt).toBeNull();
  });

  it('a short token is a validation error, an unknown one is 404', async () => {
    expectStatus(await anon().get('/public/quotations/short'), 400);
    expectStatus(await anon().get(`/public/quotations/${'z'.repeat(43)}`), 404);
  });

  it('GET /public/invoices/:token shows what is owed', async () => {
    const invoice = await prisma.invoice.findFirst({ where: { number: { startsWith: 'INV-' }, publicToken: { not: null } } });
    const body = expectStatus(await anon().get(`/public/invoices/${invoice.publicToken}`), 200);
    expect(body.data.total).toBeGreaterThan(0);
    expectStatus(await anon().get(`/public/invoices/${'z'.repeat(43)}`), 404);
  });

  it('GET /public/warranties/:token and a claim', async () => {
    // A warranty of its own: a claim is one-at-a-time, so reusing the seeded one
    // would make a second run of the suite answer 422 where this expects 201.
    const { job } = await createCompletedJob();
    const warranty = await prisma.warranty.findFirst({ where: { jobId: job.id } });
    const body = expectStatus(await anon().get(`/public/warranties/${warranty.publicToken}`), 200);
    expect(body.data.isValid).toBe(true);
    expectStatus(await anon().post(`/public/warranties/${warranty.publicToken}/claim`).send({ description: 'short' }), 400);
    expectStatus(await anon().post(`/public/warranties/${warranty.publicToken}/claim`).send({
      description: 'The wall is damp again near the skirting.',
    }), 201);
    const dup = await anon().post(`/public/warranties/${warranty.publicToken}/claim`).send({
      description: 'Still damp, filing a second claim.',
    });
    expect(dup.status).toBe(422);
  });
});

describe('SEO artefacts', () => {
  it('GET /sitemap.xml', async () => {
    const res = await anon().get('/sitemap.xml?origin=https://gharjatan.com.np');
    expectStatus(res, 200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('https://gharjatan.com.np/services/');
  });

  it('GET /robots.txt', async () => {
    const res = await anon().get('/robots.txt?origin=https://gharjatan.com.np');
    expectStatus(res, 200);
    expect(res.text).toContain('Sitemap: https://gharjatan.com.np/sitemap.xml');
  });

  it('GET /json-ld', async () => {
    const body = expectStatus(await anon().get(`/json-ld?origin=https://gharjatan.com.np&x=${uid()}`), 200);
    expect(body).toBeTypeOf('object');
  });
});
