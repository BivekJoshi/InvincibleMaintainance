import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, withToken, expectStatus, prisma, USERS, PASSWORD, uid,
} from './helpers.js';

/**
 * The admin shell's own shortcuts and notes. Each test file run gets two fresh
 * users, so counts and ordering never depend on earlier runs or on the seed.
 */
let me;
let other;

async function freshUser(role) {
  const admin = await as('ADMIN');
  const email = `${uid('me')}@example.com`;
  expectStatus(await admin.post('/admin/users').send({ name: 'Shell User', email, password: PASSWORD, role }), 201);
  const login = expectStatus(await anon().post('/auth/login').send({ email, password: PASSWORD }), 200);
  return withToken(login.data.accessToken);
}

beforeAll(async () => {
  [me, other] = await Promise.all([freshUser('SALES'), freshUser('TECHNICIAN')]);
});

describe('shortcuts', () => {
  let leads;
  let quotes;
  let dispatch;

  it('requires a token', async () => {
    expectStatus(await anon().get('/admin/me/shortcuts'), 401);
  });

  it('works for every seeded role', async () => {
    for (const role of Object.keys(USERS)) {
      const body = expectStatus(await (await as(role)).get('/admin/me/shortcuts'), 200);
      expect(body.meta.max).toBe(12);
    }
  });

  it('POST appends shortcuts and GET lists them in order', async () => {
    const empty = expectStatus(await me.get('/admin/me/shortcuts'), 200);
    expect(empty).toEqual({ data: [], meta: { total: 0, max: 12 } });

    leads = expectStatus(await me.post('/admin/me/shortcuts').send({ label: '  Leads ', to: '/admin/leads', icon: 'Users' }), 201).data;
    quotes = expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'Pending quotes', to: '/admin/quotations?status=PENDING_APPROVAL' }), 201).data;
    dispatch = expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'Board', to: '/admin/dispatch' }), 201).data;

    expect(leads).toMatchObject({ label: 'Leads', to: '/admin/leads', icon: 'Users', sortOrder: 0 });
    expect(Object.keys(leads).sort()).toEqual(['createdAt', 'icon', 'id', 'label', 'sortOrder', 'to', 'updatedAt']);
    expect(quotes).toMatchObject({ icon: null, sortOrder: 1 });
    expect(dispatch.sortOrder).toBe(2);

    const list = expectStatus(await me.get('/admin/me/shortcuts'), 200);
    expect(list.data.map((s) => s.id)).toEqual([leads.id, quotes.id, dispatch.id]);
    expect(list.meta).toEqual({ total: 3, max: 12 });
  });

  it('409 DUPLICATE for the same path twice', async () => {
    const res = expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'Again', to: '/admin/leads' }), 409);
    expect(res.error.code).toBe('DUPLICATE');
  });

  it.each([
    'https://evil.com', '//evil', '//evil.com/admin', '/admin//evil.com', 'javascript:alert(1)',
    '/administrator', '/tech/jobs', '/admin/leads x', '/admin\\evil', 'admin/leads', '',
    `/admin/${'a'.repeat(300)}`,
  ])('400 for to=%j', async (to) => {
    expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'Bad', to }), 400);
  });

  it('400 for a bad label or icon', async () => {
    expectStatus(await me.post('/admin/me/shortcuts').send({ label: '   ', to: '/admin/jobs' }), 400);
    expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'x'.repeat(41), to: '/admin/jobs' }), 400);
    expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'Jobs', to: '/admin/jobs', icon: 'bad-icon' }), 400);
  });

  it('PATCH updates the label and icon; an empty body is 400', async () => {
    const res = expectStatus(await me.patch(`/admin/me/shortcuts/${quotes.id}`).send({ label: 'To approve', icon: 'FileText' }), 200);
    expect(res.data).toMatchObject({ id: quotes.id, label: 'To approve', icon: 'FileText', to: quotes.to });
    expectStatus(await me.patch(`/admin/me/shortcuts/${quotes.id}`).send({}), 400);
  });

  it('PUT /order sets sortOrder from the position', async () => {
    const ids = [dispatch.id, leads.id, quotes.id];
    expectStatus(await me.put('/admin/me/shortcuts/order').send({ ids }), 204);
    const list = expectStatus(await me.get('/admin/me/shortcuts'), 200).data;
    expect(list.map((s) => s.id)).toEqual(ids);
    expect(list.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it('PUT /order is 400 unless ids are exactly the caller\'s shortcuts', async () => {
    const bad = [
      [dispatch.id, leads.id],
      [dispatch.id, leads.id, quotes.id, 'nope'],
      [dispatch.id, dispatch.id, leads.id],
      [],
    ];
    for (const ids of bad) {
      const body = expectStatus(await me.put('/admin/me/shortcuts/order').send({ ids }), 400);
      expect(body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('another user cannot see, change, reorder or delete them', async () => {
    expect(expectStatus(await other.get('/admin/me/shortcuts'), 200).data).toEqual([]);
    expectStatus(await other.patch(`/admin/me/shortcuts/${leads.id}`).send({ label: 'Mine now' }), 404);
    expectStatus(await other.delete(`/admin/me/shortcuts/${leads.id}`), 404);
    expectStatus(await other.put('/admin/me/shortcuts/order').send({ ids: [leads.id] }), 400);
    // Someone else holding the same path is fine.
    expectStatus(await other.post('/admin/me/shortcuts').send({ label: 'Leads', to: '/admin/leads' }), 201);
    expect(expectStatus(await me.get(`/admin/me/shortcuts`), 200).data.find((s) => s.id === leads.id).label).toBe('Leads');
  });

  it('DELETE removes one; a second DELETE is 404', async () => {
    expectStatus(await me.delete(`/admin/me/shortcuts/${dispatch.id}`), 204);
    expectStatus(await me.delete(`/admin/me/shortcuts/${dispatch.id}`), 404);
    expect(await prisma.userShortcut.findUnique({ where: { id: dispatch.id } })).toBeNull();
    const list = expectStatus(await me.get('/admin/me/shortcuts'), 200);
    expect(list.meta.total).toBe(2);
  });

  it('409 LIMIT_REACHED at 12, and a new one appends after the last', async () => {
    const before = expectStatus(await me.get('/admin/me/shortcuts'), 200).data;
    const last = before.at(-1).sortOrder;
    for (let i = before.length; i < 12; i += 1) {
      const s = expectStatus(await me.post('/admin/me/shortcuts').send({ label: `Page ${i}`, to: `/admin/page-${i}` }), 201).data;
      expect(s.sortOrder).toBe(last + 1 + i - before.length);
    }
    const res = expectStatus(await me.post('/admin/me/shortcuts').send({ label: 'One too many', to: '/admin/extra' }), 409);
    expect(res.error.code).toBe('LIMIT_REACHED');
    expect(expectStatus(await me.get('/admin/me/shortcuts'), 200).meta.total).toBe(12);
  });
});

describe('notes', () => {
  const NEPALI = 'शुक्रबार साँझ ५ बजे बैठक — रु. १,५००';
  let a;
  let b;
  let c;

  it('POST creates notes with defaults, and Nepali text round-trips', async () => {
    a = expectStatus(await me.post('/admin/me/notes').send({ body: '  First note  ' }), 201).data;
    expect(a).toMatchObject({ body: 'First note', color: 'yellow', isPinned: false });
    expect(Object.keys(a).sort()).toEqual(['body', 'color', 'createdAt', 'id', 'isPinned', 'updatedAt']);

    b = expectStatus(await me.post('/admin/me/notes').send({ body: NEPALI, color: 'green' }), 201).data;
    expect(b.body).toBe(NEPALI);

    c = expectStatus(await me.post('/admin/me/notes').send({ body: 'Pinned one', color: 'pink', isPinned: true }), 201).data;
    expect(c.isPinned).toBe(true);

    const list = expectStatus(await me.get('/admin/me/notes'), 200);
    expect(list.data.find((n) => n.id === b.id).body).toBe(NEPALI);
    expect(list.meta).toEqual({ total: 3, max: 100 });
  });

  it('400 for an empty or oversized body, a bad color or a non-boolean isPinned', async () => {
    expectStatus(await me.post('/admin/me/notes').send({ body: '   ' }), 400);
    expectStatus(await me.post('/admin/me/notes').send({ body: 'x'.repeat(2001) }), 400);
    expectStatus(await me.post('/admin/me/notes').send({ body: 'ok', color: 'red' }), 400);
    expectStatus(await me.post('/admin/me/notes').send({ body: 'ok', isPinned: 'yes' }), 400);
    expectStatus(await me.patch(`/admin/me/notes/${a.id}`).send({}), 400);
  });

  it('lists pinned first, then the most recently updated', async () => {
    // Edit the oldest so it becomes the most recent unpinned note.
    const edited = expectStatus(await me.patch(`/admin/me/notes/${a.id}`).send({ body: 'First note, edited', color: 'blue' }), 200).data;
    expect(edited).toMatchObject({ id: a.id, body: 'First note, edited', color: 'blue', isPinned: false });
    let ids = expectStatus(await me.get('/admin/me/notes'), 200).data.map((n) => n.id);
    expect(ids).toEqual([c.id, a.id, b.id]);

    expectStatus(await me.patch(`/admin/me/notes/${b.id}`).send({ isPinned: true }), 200);
    ids = expectStatus(await me.get('/admin/me/notes'), 200).data.map((n) => n.id);
    expect(ids).toEqual([b.id, c.id, a.id]);
  });

  it('another user cannot see, change or delete them', async () => {
    expect(expectStatus(await other.get('/admin/me/notes'), 200).data).toEqual([]);
    expectStatus(await other.patch(`/admin/me/notes/${a.id}`).send({ body: 'hijacked' }), 404);
    expectStatus(await other.delete(`/admin/me/notes/${a.id}`), 404);
    const mine = expectStatus(await me.get('/admin/me/notes'), 200).data.find((n) => n.id === a.id);
    expect(mine.body).toBe('First note, edited');
  });

  it('DELETE soft-deletes: the note leaves the list and cannot be edited', async () => {
    expectStatus(await me.delete(`/admin/me/notes/${c.id}`), 204);
    const list = expectStatus(await me.get('/admin/me/notes'), 200);
    expect(list.data.map((n) => n.id)).not.toContain(c.id);
    expect(list.meta.total).toBe(2);
    const row = await prisma.userNote.findUnique({ where: { id: c.id } });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expectStatus(await me.patch(`/admin/me/notes/${c.id}`).send({ body: 'back' }), 404);
    expectStatus(await me.delete(`/admin/me/notes/${c.id}`), 404);
  });

  it('409 LIMIT_REACHED at 100 live notes; deleted ones do not count', async () => {
    const user = await prisma.user.findFirst({ where: { notes: { some: { id: a.id } } } });
    const live = await prisma.userNote.count({ where: { userId: user.id, deletedAt: null } });
    await prisma.userNote.createMany({
      data: Array.from({ length: 100 - live }, (_, i) => ({ userId: user.id, body: `Filler ${i}` })),
    });
    const res = expectStatus(await me.post('/admin/me/notes').send({ body: 'One too many' }), 409);
    expect(res.error.code).toBe('LIMIT_REACHED');

    expectStatus(await me.delete(`/admin/me/notes/${a.id}`), 204);
    expectStatus(await me.post('/admin/me/notes').send({ body: 'Fits again' }), 201);
    expect(expectStatus(await me.get('/admin/me/notes'), 200).meta).toEqual({ total: 100, max: 100 });
  });
});
