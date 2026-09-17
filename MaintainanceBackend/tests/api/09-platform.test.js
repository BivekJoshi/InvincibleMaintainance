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

  it('puts a job booked for today on the run sheet with who is going', async () => {
    const dispatcher = await as('DISPATCHER');
    const before = expectStatus(await dispatcher.get('/admin/dashboard'), 200).data;
    await createAssignedJob({ scheduledStart: new Date(Date.now() + 60_000).toISOString() });
    const after = expectStatus(await dispatcher.get('/admin/dashboard'), 200).data;
    expect(after.todaysJobs.total).toBe(before.todaysJobs.total + 1);
    expect(after.todaysJobs.items.length).toBe(Math.min(8, after.todaysJobs.total));
    expect(after.todaysJobs.items.every((j) => Array.isArray(j.technicians))).toBe(true);
    expect(after.todaysJobs.items.some((j) => j.technicians.length > 0)).toBe(true);
    expect(after.technicianLoad.reduce((n, t) => n + t.jobs, 0)).toBeGreaterThan(before.technicianLoad.reduce((n, t) => n + t.jobs, 0));
  });

  it('sends each role only its own charts, with every day filled in', async () => {
    const a = expectStatus(await admin.get('/admin/dashboard'), 200).data;
    expect(a.leadTrend).toHaveLength(14);
    expect(a.leadTrend[13]).toEqual({ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), leads: expect.any(Number), won: expect.any(Number) });
    expect(a.jobsWeek).toHaveLength(7);
    expect(a.leadTrend[13].day).toBe(a.jobsWeek[0].day);
    expect(Array.isArray(a.sources)).toBe(true);
    expect(a.jobStatus).not.toHaveProperty('COMPLETED');
    expect(a.revenue).toBeTruthy();
    expect(a.leadHeatmap.cells).toHaveLength(7);
    expect(a.leadHeatmap.cells.every((row) => row.length === a.leadHeatmap.bands.length)).toBe(true);
    expect(a.leadHeatmap.cells.flat().reduce((n, v) => n + v, 0)).toBe(a.leadHeatmap.total);
    expect(a.slaQueue.items.length).toBeLessThanOrEqual(6);
    const dues = a.slaQueue.items.map((l) => new Date(l.slaDueAt).getTime());
    expect(dues).toEqual([...dues].sort((x, y) => x - y));
    expect(a.quotationPipeline.stages.map((st) => st.status)).toEqual(['DRAFT', 'PENDING_APPROVAL', 'OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED']);
    expect(a.quotationPipeline.openValue).toBe(a.quotationPipeline.stages.reduce((n, st) => n + st.value, 0));
    expect(Number.isInteger(a.quotationPipeline.openValue)).toBe(true);
    expect(a.todaysJobs.items.length).toBeLessThanOrEqual(a.todaysJobs.total);
    expect(a.technicianLoad[0]).toEqual(expect.objectContaining({ name: expect.any(String), capacity: expect.any(Number), jobs: expect.any(Number) }));

    const s = expectStatus(await (await as('SALES')).get('/admin/dashboard'), 200).data;
    expect(s.leadTrend).toHaveLength(14);
    expect(s).not.toHaveProperty('jobsWeek');
    expect(s).not.toHaveProperty('revenue');
    expect(s).not.toHaveProperty('todaysJobs');
    expect(s.slaQueue).toBeTruthy();

    const d = expectStatus(await (await as('DISPATCHER')).get('/admin/dashboard'), 200).data;
    expect(d.jobsWeek).toHaveLength(7);
    expect(d).not.toHaveProperty('leadTrend');
    expect(d).not.toHaveProperty('slaQueue');
    expect(Array.isArray(d.technicianLoad)).toBe(true);

    const t = expectStatus(await (await as('TECHNICIAN')).get('/admin/dashboard'), 200).data;
    expect(Object.keys(t)).toEqual(['role', 'cards']);
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

  it('alt text can be changed but never emptied', async () => {
    const res = expectStatus(await admin.put(`/admin/media/${mediaId}`).send({ alt: '   ' }), 400);
    expect(res.error.details.map((d) => d.path)).toContain('alt');
    expect(expectStatus(await admin.get(`/admin/media/${mediaId}`), 200).data.alt).toBe('Test image');
    expectStatus(await admin.put(`/admin/media/${mediaId}`).send({ caption: 'A caption alone is fine' }), 200);
  });

  it('folders: a name is required, a parent must exist, and only an empty folder is deleted', async () => {
    expectStatus(await admin.post('/admin/media/folders').send({ name: '  ' }), 400);
    expectStatus(await admin.post('/admin/media/folders').send({ name: 'x'.repeat(81) }), 400);
    expectStatus(await admin.post('/admin/media/folders').send({ name: 'Orphan', parentId: 'no-such-folder' }), 400);

    const parent = expectStatus(await admin.post('/admin/media/folders').send({ name: `Parent ${uid()}` }), 201).data;
    const child = expectStatus(await admin.post('/admin/media/folders').send({ name: 'निर्माण साइट', parentId: parent.id }), 201).data;
    expect(child.name).toBe('निर्माण साइट');
    expect(child.parentId).toBe(parent.id);
    // A folder with a subfolder stays; so does one holding a file.
    expect(expectStatus(await admin.delete(`/admin/media/folders/${parent.id}`), 400).error.message).toMatch(/folder/);
    const file = await uploadImage(admin, '#557799');
    expectStatus(await admin.put(`/admin/media/${file.id}`).send({ folderId: child.id }), 200);
    expect(expectStatus(await admin.get(`/admin/media?folderId=${child.id}`), 200).data.map((m) => m.id)).toEqual([file.id]);
    expectStatus(await admin.delete(`/admin/media/folders/${child.id}`), 400);
    expectStatus(await admin.put(`/admin/media/${file.id}`).send({ folderId: null }), 200);
    expectStatus(await admin.delete(`/admin/media/folders/${child.id}`), 204);
    expectStatus(await admin.delete(`/admin/media/folders/${parent.id}`), 204);
    expectStatus(await admin.delete(`/admin/media/folders/${parent.id}`), 404);
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
