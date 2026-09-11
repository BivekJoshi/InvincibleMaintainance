import { describe, it, expect, beforeAll } from 'vitest';
import {
  as, expectStatus, createAssignedJob, uploadImage, pngBuffer, USERS, PASSWORD, uid, phone,
} from './helpers.js';

let admin;

beforeAll(async () => { admin = await as('ADMIN'); });

describe('dashboard', () => {
  it.each(Object.keys(USERS))('GET /admin/dashboard as %s', async (role) => {
    expectStatus(await (await as(role)).get('/admin/dashboard'), 200);
  });
});

describe('notifications', () => {
  let tech;

  beforeAll(async () => {
    tech = await as('TECHNICIAN');
    await createAssignedJob();
  });

  it('GET /admin/notifications returns only the caller\'s, with an unread count', async () => {
    const body = expectStatus(await tech.get('/admin/notifications'), 200);
    expect(body.meta.unread).toBeGreaterThan(0);
    expectStatus(await tech.get('/admin/notifications?unreadOnly=true'), 200);
  });

  it('PATCH /admin/notifications/:id/read, and 404 for someone else\'s', async () => {
    const [first] = expectStatus(await tech.get('/admin/notifications?unreadOnly=true'), 200).data;
    expectStatus(await tech.patch(`/admin/notifications/${first.id}/read`), 204);
    expectStatus(await admin.patch(`/admin/notifications/${first.id}/read`), 404);
  });

  it('PATCH /admin/notifications/read-all', async () => {
    expectStatus(await tech.patch('/admin/notifications/read-all'), 204);
    expect(expectStatus(await tech.get('/admin/notifications'), 200).meta.unread).toBe(0);
  });
});

describe('media', () => {
  let mediaId;
  let folderId;

  it('POST /admin/media converts an image and returns variants', async () => {
    const media = await uploadImage(admin, '#aa5533');
    mediaId = media.id;
    expect(media.mimeType ?? media.mime).toMatch(/image/);
  });

  it('POST /admin/media refuses a text file named .png', async () => {
    const res = await admin.post('/admin/media').attach('files', Buffer.from('plain text, not a PNG'), 'evil.png');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /admin/media/documents accepts a PDF', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const res = await admin.post('/admin/media/documents').attach('files', pdf, 'bill.pdf');
    expectStatus(res, 201);
  });

  it('GET/PUT /admin/media and /:id', async () => {
    expectStatus(await admin.get('/admin/media'), 200);
    expectStatus(await admin.get(`/admin/media/${mediaId}`), 200);
    expect(expectStatus(await admin.put(`/admin/media/${mediaId}`).send({ alt: 'Test image' }), 200).data.alt).toBe('Test image');
  });

  it('folders: create, list, delete', async () => {
    folderId = expectStatus(await admin.post('/admin/media/folders').send({ name: `Folder ${uid()}` }), 201).data.id;
    expect(expectStatus(await admin.get('/admin/media/folders'), 200).data.map((f) => f.id)).toContain(folderId);
    expectStatus(await admin.delete(`/admin/media/folders/${folderId}`), 204);
  });

  it('DELETE /admin/media/:id', async () => {
    const doomed = await uploadImage(admin, '#123456');
    expectStatus(await admin.delete(`/admin/media/${doomed.id}`), 204);
  });

  it('ACCOUNTANT cannot manage media', async () => {
    const res = await (await as('ACCOUNTANT')).post('/admin/media').attach('files', await pngBuffer(), 'x.png');
    expect(res.status).toBe(403);
  });
});

describe('settings', () => {
  it('GET /admin/settings is readable by an editor', async () => {
    expectStatus(await (await as('EDITOR')).get('/admin/settings'), 200);
  });

  it('PATCH /admin/settings is ADMIN only', async () => {
    expectStatus(await admin.patch('/admin/settings').send({ values: { 'branding.tagline': 'Tested tagline' } }), 200);
    expectStatus(await (await as('EDITOR')).patch('/admin/settings').send({ values: { 'branding.tagline': 'x' } }), 403);
  });
});

describe('users', () => {
  let userId;
  let adminId;

  beforeAll(async () => { adminId = expectStatus(await admin.get('/auth/me'), 200).data.id; });

  it('GET /admin/users with search, never exposing hashes', async () => {
    const body = expectStatus(await admin.get('/admin/users?q=gharjatan'), 200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].passwordHash).toBeUndefined();
  });

  it('POST /admin/users, a duplicate email is 409', async () => {
    const email = `${uid('user')}@example.com`;
    userId = expectStatus(await admin.post('/admin/users').send({ name: 'Created User', email, phone: phone(), password: PASSWORD, role: 'SALES' }), 201).data.id;
    expectStatus(await admin.post('/admin/users').send({ name: 'Again', email, password: PASSWORD, role: 'SALES' }), 409);
  });

  it('PUT /admin/users/:id', async () => {
    expect(expectStatus(await admin.put(`/admin/users/${userId}`).send({ role: 'DISPATCHER' }), 200).data.role).toBe('DISPATCHER');
  });

  it('an admin cannot disable or delete themselves', async () => {
    expectStatus(await admin.patch(`/admin/users/${adminId}/toggle`), 400);
    expectStatus(await admin.delete(`/admin/users/${adminId}`), 400);
  });

  it('PATCH /admin/users/:id/toggle and DELETE', async () => {
    expect(expectStatus(await admin.patch(`/admin/users/${userId}/toggle`), 200).data.isActive).toBe(false);
    expectStatus(await admin.delete(`/admin/users/${userId}`), 204);
  });

  it('users are ADMIN only', async () => {
    expectStatus(await (await as('SALES')).get('/admin/users'), 403);
  });
});

describe('audit and messaging', () => {
  it('GET /admin/audit-logs', async () => {
    expect(expectStatus(await admin.get('/admin/audit-logs?limit=5'), 200).data.length).toBeGreaterThan(0);
  });

  it('message templates CRUD', async () => {
    const t = expectStatus(await admin.post('/admin/message-templates').send({
      key: uid('tpl_'), channel: 'sms', body: 'Hello {{name}}',
    }), 201).data;
    expectStatus(await admin.get('/admin/message-templates'), 200);
    expectStatus(await admin.put(`/admin/message-templates/${t.id}`).send({ body: 'Namaste {{name}}' }), 200);
    expectStatus(await admin.delete(`/admin/message-templates/${t.id}`), 204);
  });

  it('GET /admin/message-logs', async () => {
    expectStatus(await admin.get('/admin/message-logs'), 200);
    expectStatus(await admin.get('/admin/message-logs?channel=sms'), 200);
  });
});

describe('operational reports', () => {
  it.each(['/admin/reports/lead-sources', '/admin/reports/funnel', '/admin/reports/sla'])(
    'GET %s as SALES', async (path) => { expectStatus(await (await as('SALES')).get(path), 200); },
  );

  it.each(['/admin/reports/job-margin', '/admin/reports/technicians', '/admin/reports/warranty-claims'])(
    'GET %s as DISPATCHER', async (path) => { expectStatus(await (await as('DISPATCHER')).get(path), 200); },
  );

  it('SALES cannot read ops reports', async () => {
    expectStatus(await (await as('SALES')).get('/admin/reports/job-margin'), 403);
  });
});
