import { describe, it, expect, beforeAll } from 'vitest';
import { as, anon, expectStatus, uploadImage, uid } from './helpers.js';

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
});

describe('resource specifics', () => {
  it('rejects boilerplate service copy', async () => {
    expectStatus(await editor.post('/admin/services').send({
      name: `Service ${uid()}`, excerpt: 'Professional plumbing with expert tools and results.',
    }), 400);
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
});

describe('translations', () => {
  it('PUT and GET /admin/translations keep Devanagari intact', async () => {
    const faq = expectStatus(await editor.post('/admin/faqs').send(RESOURCES.faqs()), 201).data;
    const values = { question: { ne: 'के यो परीक्षण हो?' } };
    expectStatus(await editor.put('/admin/translations').send({ model: 'Faq', recordId: faq.id, values }), 200);
    const body = expectStatus(await editor.get(`/admin/translations?model=Faq&recordId=${faq.id}`), 200);
    expect(JSON.stringify(body.data)).toContain('के यो परीक्षण हो?');
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
