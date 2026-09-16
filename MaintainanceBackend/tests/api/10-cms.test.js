import { describe, it, expect, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { as, anon, expectStatus, uploadImage, uid, prisma } from './helpers.js';

let editor;
let mediaId;

beforeAll(async () => {
  editor = await as('EDITOR');
  mediaId = (await uploadImage(editor, '#335577')).id;
});

/** Minimal valid body per CMS resource. Functions so each call gets fresh unique values. */
const RESOURCES = {
  'hero-slides': () => ({ title: `Slide ${uid()}` }),
  'service-categories': () => ({ name: `Category ${uid()}` }),
  services: () => ({ name: `Service ${uid()}`, excerpt: 'A proper description of what this test service actually does.' }),
  offers: () => ({ title: `Offer ${uid()}` }),
  'pricing-plans': () => ({ title: `Plan ${uid()}` }),
  features: () => ({ group: 'why_choose', title: `Feature ${uid()}` }),
  'list-items': () => ({ group: 'renovation_reasons', position: 1, text: `List item ${uid()}` }),
  'content-blocks': () => ({ key: uid('block_'), heading: 'Test block' }),
  'process-steps': () => ({ stepNo: 1, title: `Step ${uid()}` }),
  gallery: () => ({ mediaId, caption: 'Test gallery image' }),
  faqs: () => ({ question: `Is this test ${uid()} real?`, answer: 'Yes, it is a real test.' }),
  pages: () => ({ title: `Page ${uid()}` }),
  'post-categories': () => ({ name: `Posts ${uid()}` }),
  posts: () => ({ title: `Post ${uid()}`, body: 'Twenty or more characters of post body.' }),
  testimonials: () => ({ quote: 'Great work, would hire them again.', author: 'Test Author' }),
  projects: () => ({ title: `Project ${uid()}` }),
};

describe.each(Object.entries(RESOURCES))('/admin/%s', (path, body) => {
  let id;

  it('POST creates', async () => {
    id = expectStatus(await editor.post(`/admin/${path}`).send(body()), 201).data.id;
    expect(id).toBeTruthy();
  });

  it('GET lists and GET /:id reads', async () => {
    const list = expectStatus(await editor.get(`/admin/${path}?limit=100&sort=-createdAt`), 200);
    expect(list.data.map((r) => r.id)).toContain(id);
    expect(expectStatus(await editor.get(`/admin/${path}/${id}`), 200).data.id).toBe(id);
  });

  it('PUT updates a subset of fields', async () => {
    expectStatus(await editor.put(`/admin/${path}/${id}`).send({ sortOrder: 7 }), 200);
  });

  it('PATCH /:id/toggle flips isActive', async () => {
    const before = expectStatus(await editor.get(`/admin/${path}/${id}`), 200).data.isActive;
    const after = expectStatus(await editor.patch(`/admin/${path}/${id}/toggle`), 200).data.isActive;
    expect(after).toBe(!before);
  });

  it('PATCH /reorder', async () => {
    expectStatus(await editor.patch(`/admin/${path}/reorder`).send({ items: [{ id, sortOrder: 2 }] }), 204);
  });

  it('DELETE soft-deletes, PATCH /:id/restore brings it back, ?hard=true is ADMIN only (cms:purge)', async () => {
    const ids = async (query) => expectStatus(await editor.get(`/admin/${path}?limit=100&sort=-createdAt${query}`), 200)
      .data.map((r) => r.id);
    expectStatus(await editor.delete(`/admin/${path}/${id}`), 204);
    expectStatus(await editor.get(`/admin/${path}/${id}`), 404);
    // ?deleted=true is the trash view: only soft-deleted rows, and the row leaves the normal list.
    expect(await ids('&deleted=true')).toContain(id);
    expect(await ids('')).not.toContain(id);
    expectStatus(await editor.patch(`/admin/${path}/${id}/restore`), 200);
    expectStatus(await editor.get(`/admin/${path}/${id}`), 200);
    expect(await ids('&deleted=true')).not.toContain(id);
    expect(await ids('&deleted=false')).toContain(id);
    expectStatus(await editor.delete(`/admin/${path}/${id}?hard=true`), 403);
    expectStatus(await editor.get(`/admin/${path}/${id}`), 200);
    expectStatus(await (await as('ADMIN')).delete(`/admin/${path}/${id}?hard=true`), 204);
    expectStatus(await editor.patch(`/admin/${path}/${id}/restore`), 404);
  });

  it('DELETE ?hard=true purges a row that is already in Trash (the Trash view’s "Delete forever")', async () => {
    const trashedId = expectStatus(await editor.post(`/admin/${path}`).send(body()), 201).data.id;
    expectStatus(await editor.delete(`/admin/${path}/${trashedId}`), 204);
    expectStatus(await editor.delete(`/admin/${path}/${trashedId}?hard=true`), 403);
    expectStatus(await (await as('ADMIN')).delete(`/admin/${path}/${trashedId}?hard=true`), 204);
    expectStatus(await editor.patch(`/admin/${path}/${trashedId}/restore`), 404);
    const trash = expectStatus(await editor.get(`/admin/${path}?deleted=true&limit=100&sort=-createdAt`), 200).data;
    expect(trash.map((r) => r.id)).not.toContain(trashedId);
    // A soft delete still needs a live row.
    expectStatus(await editor.delete(`/admin/${path}/${trashedId}`), 404);
  });
});

describe('resource specifics', () => {
  it('rejects boilerplate service copy', async () => {
    expectStatus(await editor.post('/admin/services').send({
      name: `Service ${uid()}`, excerpt: 'Professional plumbing with expert tools and results.',
    }), 400);
  });

  it('service card copy must be 40 to 200 characters', async () => {
    const short = expectStatus(await editor.post('/admin/services').send({
      name: `Service ${uid()}`, excerpt: 'Waterproofing for roofs, done well.',
    }), 400);
    expect(short.error.details.map((d) => d.path)).toContain('excerpt');
    expectStatus(await editor.post('/admin/services').send({ name: `Service ${uid()}`, excerpt: 'x'.repeat(201) }), 400);
    expectStatus(await editor.post('/admin/services').send({ name: `Service ${uid()}`, excerpt: 'x'.repeat(200) }), 201);
  });

  it('rejects a maximum price below the minimum, on create and on a partial update', async () => {
    const excerpt = 'Damp walls traced to their source with a moisture meter, then sealed from the side it enters.';
    const bad = expectStatus(await editor.post('/admin/services').send({
      name: `Service ${uid()}`, excerpt, priceFrom: 500, priceTo: 100,
    }), 400);
    expect(bad.error.details.map((d) => d.path)).toContain('priceTo');

    const svc = expectStatus(await editor.post('/admin/services').send({
      name: `Service ${uid()}`, excerpt, priceFrom: 100, priceTo: 500,
    }), 201).data;
    // Only one side sent: checked against the stored other side.
    const partial = expectStatus(await editor.put(`/admin/services/${svc.id}`).send({ priceTo: 50 }), 400);
    expect(partial.error.details.map((d) => d.path)).toContain('priceTo');
    expectStatus(await editor.put(`/admin/services/${svc.id}`).send({ priceFrom: 600 }), 400);
    // Both sides sent together are checked too, although PUT's schema is partial.
    expectStatus(await editor.put(`/admin/services/${svc.id}`).send({ priceFrom: 300, priceTo: 200 }), 400);
    const ok = expectStatus(await editor.put(`/admin/services/${svc.id}`).send({ priceFrom: 200, priceTo: 200 }), 200).data;
    expect([ok.priceFrom, ok.priceTo]).toEqual([20000, 20000]);
  });

  it('a slug is generated and kept unique', async () => {
    const name = `Same Name ${uid()}`;
    const a = expectStatus(await editor.post('/admin/service-categories').send({ name }), 201).data;
    const b = expectStatus(await editor.post('/admin/service-categories').send({ name }), 201).data;
    expect(a.slug).toBeTruthy();
    expect(a.slug).not.toBe(b.slug);
  });

  it('PATCH /admin/testimonials/:id/approve', async () => {
    const t = expectStatus(await editor.post('/admin/testimonials').send(RESOURCES.testimonials()), 201).data;
    expect(t.isApproved).toBe(false);
    expect(expectStatus(await editor.patch(`/admin/testimonials/${t.id}/approve`), 200).data.isApproved).toBe(true);
  });

  it('project images: add, reorder, remove', async () => {
    const p = expectStatus(await editor.post('/admin/projects').send(RESOURCES.projects()), 201).data;
    const img = expectStatus(await editor.post(`/admin/projects/${p.id}/images`).send({ mediaId, caption: 'Before' }), 201).data;
    expectStatus(await editor.patch(`/admin/projects/${p.id}/images/reorder`).send({ items: [{ id: img.id, sortOrder: 1 }] }), 204);
    expectStatus(await editor.delete(`/admin/projects/${p.id}/images/${img.id}`), 204);
  });

  it('media: EDITOR soft-deletes, only ADMIN (cms:purge) removes the file for good', async () => {
    const doomed = await uploadImage(editor, '#aa3355');
    expectStatus(await editor.delete(`/admin/media/${doomed.id}?hard=true`), 403);
    expectStatus(await editor.delete(`/admin/media/${doomed.id}`), 204);
    expectStatus(await (await as('ADMIN')).delete(`/admin/media/${doomed.id}?hard=true`), 204);
  });

  it('?deleted must be true or false — anything else is a 400, not a silent full list', async () => {
    const res = expectStatus(await editor.get('/admin/faqs?deleted=yes'), 400);
    expect(res.error.code).toBe('BAD_REQUEST');
  });

  it('a Devanagari title keeps its vowel signs in the slug', async () => {
    const row = expectStatus(await editor.post('/admin/service-categories').send({ name: `नेपाली सेवा ${uid()}` }), 201).data;
    expect(row.slug.startsWith('नेपाली-सेवा-')).toBe(true);
  });

  it('SALES cannot write CMS content', async () => {
    expectStatus(await (await as('SALES')).post('/admin/faqs').send(RESOURCES.faqs()), 403);
  });
});

describe('home page composer', () => {
  it('GET /admin/home-sections lists every section', async () => {
    expect(expectStatus(await editor.get('/admin/home-sections'), 200).data.length).toBe(19);
  });

  it('PUT /admin/home-sections hides a section from the public payload', async () => {
    const sections = expectStatus(await editor.get('/admin/home-sections'), 200).data;
    const offers = sections.find((s) => s.key === 'offers');
    await anon().get('/public/home');

    expectStatus(await editor.put('/admin/home-sections').send({
      items: [{ key: 'offers', sortOrder: offers.sortOrder, isVisible: false }],
    }), 200);
    const hidden = expectStatus(await anon().get('/public/home'), 200);
    expect(hidden.data.sections.map((s) => s.key)).not.toContain('offers');

    expectStatus(await editor.put('/admin/home-sections').send({
      items: [{ key: 'offers', sortOrder: offers.sortOrder, isVisible: true }],
    }), 200);
  });

  it('PUT /admin/home-sections reorders the public page and keeps a section limit', async () => {
    const before = expectStatus(await editor.get('/admin/home-sections'), 200).data;
    const restore = before.map(({ key, sortOrder, isVisible, settings }) => ({ key, sortOrder, isVisible, ...(settings ? { settings } : {}) }));
    // Process first, then everything else in its old order.
    const moved = [...before].sort((a, b) => (a.key === 'process' ? -1 : b.key === 'process' ? 1 : a.sortOrder - b.sortOrder));
    const items = moved.map((sec, i) => ({
      key: sec.key, sortOrder: i, isVisible: sec.isVisible, ...(sec.key === 'services' ? { settings: { limit: 3 } } : {}),
    }));
    try {
      const saved = expectStatus(await editor.put('/admin/home-sections').send({ items }), 200).data;
      expect(saved[0].key).toBe('process');
      expect(saved.find((x) => x.key === 'services').settings).toEqual({ limit: 3 });
      const home = expectStatus(await anon().get('/public/home'), 200).data;
      expect(home.sections[0].key).toBe('process');
      const services = home.sections.find((x) => x.key === 'services');
      if (services) expect(services.data.length).toBeLessThanOrEqual(3);
    } finally {
      expectStatus(await editor.put('/admin/home-sections').send({ items: restore }), 200);
    }
  });

  it('PUT /admin/home-sections refuses an unknown section or a limit outside 1–50', async () => {
    const services = await prisma.homeSection.findUnique({ where: { key: 'services' } });
    try {
      expectStatus(await editor.put('/admin/home-sections').send({ items: [{ key: 'nope', sortOrder: 0, isVisible: true }] }), 400);
      for (const limit of [0, 51, 2.5]) {
        expectStatus(await editor.put('/admin/home-sections').send({
          items: [{ key: 'services', sortOrder: services.sortOrder, isVisible: services.isVisible, settings: { limit } }],
        }), 400);
      }
    } finally {
      // Code that wrongly accepts a limit must not leave it behind for the next run.
      await prisma.homeSection.update({ where: { key: 'services' }, data: { settings: services.settings ?? Prisma.DbNull } });
    }
  });

  it('a hero slide in Nepali reaches the Nepali home page', async () => {
    const sections = expectStatus(await editor.get('/admin/home-sections'), 200).data;
    const hero = sections.find((x) => x.key === 'hero');
    const slides = expectStatus(await editor.get('/admin/hero-slides?limit=100'), 200).data;
    const slide = expectStatus(await editor.post('/admin/hero-slides').send({
      title: `Slide ${uid()}`, subtitle: 'English subtitle', ctaLabel: 'Book', ctaUrl: '/book', sortOrder: 0,
    }), 201).data;
    try {
      // First in order, so the storefront shows it.
      expectStatus(await editor.patch('/admin/hero-slides/reorder').send({
        items: [{ id: slide.id, sortOrder: 0 }, ...slides.map((x, i) => ({ id: x.id, sortOrder: i + 1 }))],
      }), 204);
      expectStatus(await editor.put('/admin/translations').send({
        model: 'heroSlide', recordId: slide.id, values: { title: { ne: 'घरको मर्मत, सजिलै' }, ctaLabel: { ne: 'बुक गर्नुहोस्' } },
      }), 200);
      if (hero?.isVisible) {
        const ne = expectStatus(await anon().get('/public/home?locale=ne'), 200).data.sections.find((x) => x.key === 'hero');
        expect(ne.data[0]).toMatchObject({ id: slide.id, title: 'घरको मर्मत, सजिलै', ctaLabel: 'बुक गर्नुहोस्', subtitle: 'English subtitle' });
      }
    } finally {
      expectStatus(await (await as('ADMIN')).delete(`/admin/hero-slides/${slide.id}?hard=true`), 204);
      expectStatus(await editor.patch('/admin/hero-slides/reorder').send({
        items: slides.map((x) => ({ id: x.id, sortOrder: x.sortOrder })),
      }), 204);
    }
  });
});

describe('translations', () => {
  it('PUT and GET /admin/translations keep Devanagari intact', async () => {
    const faq = expectStatus(await editor.post('/admin/faqs').send(RESOURCES.faqs()), 201).data;
    const values = { question: { ne: 'के यो परीक्षण हो?' } };
    expectStatus(await editor.put('/admin/translations').send({ model: 'Faq', recordId: faq.id, values }), 200);
    const body = expectStatus(await editor.get(`/admin/translations?model=Faq&recordId=${faq.id}`), 200);
    expect(JSON.stringify(body.data)).toContain('के यो परीक्षण हो?');
  });

  it('a Nepali FAQ shows on the public service page and /public/faqs with ?locale=ne', async () => {
    const faq = expectStatus(await editor.post('/admin/faqs').send({ ...RESOURCES.faqs(), group: 'general' }), 201).data;
    const question = `नेपाली प्रश्न ${uid()}?`;
    expectStatus(await editor.put('/admin/translations').send({ model: 'faq', recordId: faq.id, values: { question: { ne: question } } }), 200);
    const slug = expectStatus(await anon().get('/public/services'), 200).data.items[0].slug;
    const find = (items) => items.find((f) => f.id === faq.id);

    const en = find(expectStatus(await anon().get(`/public/services/${slug}`), 200).data.faqs);
    expect(en.question).toBe(faq.question);

    const ne = find(expectStatus(await anon().get(`/public/services/${slug}?locale=ne`), 200).data.faqs);
    expect(ne.question).toBe(question);
    expect(ne.answer).toBe(faq.answer); // an untranslated field falls back to English

    const listed = find(expectStatus(await anon().get('/public/faqs?group=general&locale=ne'), 200).data.items);
    expect(listed.question).toBe(question);
  });
});

describe('public cache invalidation', () => {
  it('a CMS write is visible on the public site immediately, not after the TTL', async () => {
    await anon().get('/public/faqs');
    const warm = await anon().get('/public/faqs');
    expect(warm.headers['x-cache']).toBe('HIT');

    const question = `Fresh question ${uid()}?`;
    expectStatus(await editor.post('/admin/faqs').send({ question, answer: 'A fresh answer.' }), 201);
    const after = expectStatus(await anon().get('/public/faqs'), 200);
    expect(JSON.stringify(after.data)).toContain(question);
  });
});
