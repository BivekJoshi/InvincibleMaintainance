import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStore, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { loadFieldQueue, syncFieldQueue } from '@/hooks/useOfflineQueue';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { enqueue, pending } from '@/helpers/offlineQueue';
import { addUpload, pendingUploads } from '@/helpers/uploadQueue';
import { resetSentPhotosForTests, thumbFor } from '@/helpers/sentPhotos';

beforeEach(() => {
  resetFieldDbForTests();
  resetSentPhotosForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** `/tech/sync` answering every mutation `applied`, unless `answers[kind]` says otherwise. */
const syncAnswer = (body, answers = {}) => json({
  data: { results: body.mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied', ...(answers[m.kind] ?? {}) })) },
});
const photoAnswer = (id) => json({ data: { photos: [{ id: `p-${id}`, mediaId: id }], media: [{ id, thumb: `/uploads/${id}-400.webp` }] } }, 201);
const picture = (name) => new File([new Uint8Array(32)], name, { type: 'image/png' });

describe('the sync engine', () => {
  it('sends the queued changes, then the signature, then the `complete` that needed its media id', async () => {
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't3', payload: { isDone: true } });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'DURING', caption: 'Membrane', file: picture('during.jpg') });
    await addUpload({
      target: 'job', targetId: 'j1', kind: 'SIGNATURE', file: picture('signature.png'), name: 'signature.png',
      then: { kind: 'complete', jobId: 'j1', payload: { note: 'Flood test dry', customerRating: 5 } },
    });
    let photo = 0;
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return syncAnswer(body);
      if (path === '/tech/jobs/j1/photos') return photoAnswer(photo++ === 0 ? 'm-during' : 'm-sig');
      return undefined;
    });
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.path)).toEqual(['/tech/sync', '/tech/jobs/j1/photos', '/tech/jobs/j1/photos', '/tech/sync']);
    expect(posts[0].body.mutations.map((m) => m.kind)).toEqual(['task']);
    expect(posts[1].body.get('kind')).toBe('DURING');
    expect(posts[1].body.get('caption')).toBe('Membrane');
    expect(posts[2].body.get('kind')).toBe('SIGNATURE');
    expect(posts[2].body.get('files').name).toBe('signature.png');
    expect(posts[3].body.mutations).toEqual([expect.objectContaining({
      kind: 'complete', jobId: 'j1', payload: { note: 'Flood test dry', customerRating: 5, signatureMediaId: 'm-sig' },
    })]);

    expect(await pending()).toEqual([]);
    expect(await pendingUploads()).toEqual([]);
    expect(store.getState().fieldSync).toMatchObject({ loaded: true, mutations: [], uploads: [], syncing: false, notes: [] });
    // The phone remembers the thumbnail of what it sent — the field API lists photos by id only.
    expect(thumbFor('m-during')).toBe('/uploads/m-during-400.webp');
  });

  it('sends a survey photo to the survey (the API files it as ISSUE), with no kind of its own', async () => {
    await addUpload({ target: 'survey', targetId: 's1', caption: 'North wall, 300 mm up', file: picture('damp.jpg') });
    const calls = mockApi(({ path }) => (path === '/tech/surveys/s1/photos' ? photoAnswer('m-damp') : undefined));
    const store = makeStore(signedInAs('SURVEYOR'));

    await syncFieldQueue(store.dispatch);

    const [upload] = calls.filter((c) => c.method === 'POST');
    expect(upload.path).toBe('/tech/surveys/s1/photos');
    expect(upload.body.get('kind')).toBeNull();
    expect(upload.body.get('caption')).toBe('North wall, 300 mm up');
    expect(await pendingUploads()).toEqual([]);
  });

  it('sends nothing while offline, and the header still counts what waits', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('a.jpg') });
    const calls = mockApi(() => undefined);
    const store = makeStore(signedInAs('TECHNICIAN'));

    await loadFieldQueue(store.dispatch);
    await syncFieldQueue(store.dispatch);

    expect(calls).toEqual([]);
    const { mutations, uploads } = store.getState().fieldSync;
    expect(mutations).toHaveLength(1);
    expect(uploads).toEqual([expect.objectContaining({ kind: 'BEFORE', name: 'a.jpg' })]);
    expect(uploads[0]).not.toHaveProperty('file');
  });

  it('keeps everything when the signal drops mid-sync, and retries a network error next time', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('a.jpg') });
    mockApi(() => { throw new TypeError('Failed to fetch'); });
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    expect(await pending()).toHaveLength(1);
    expect(await pendingUploads()).toHaveLength(1);
    expect(store.getState().fieldSync.notes).toEqual([]);
  });

  it('drops a replay the server refuses for good and says so, while the rest goes through', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    mockApi(({ path, body }) => (path === '/tech/sync'
      ? syncAnswer(body, { status: { status: 'failed', code: 'INVALID_TRANSITION', error: 'Cannot move a job from CANCELLED to IN_PROGRESS' } })
      : undefined));
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    expect(await pending()).toEqual([]);
    expect(store.getState().fieldSync.notes).toEqual([expect.objectContaining({
      source: 'mutation', kind: 'status', status: 'IN_PROGRESS', jobId: 'j1', code: 'INVALID_TRANSITION',
      message: 'Cannot move a job from CANCELLED to IN_PROGRESS',
    })]);
  });

  it('runs one sync at a time — a change queued mid-sync goes on a second round, not in parallel', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    const store = makeStore(signedInAs('TECHNICIAN'));
    let inside = 0;
    let overlap = false;
    const calls = mockApi(async ({ path, body }) => {
      if (path !== '/tech/sync') return undefined;
      inside += 1;
      if (inside > 1) overlap = true;
      await new Promise((r) => setTimeout(r, 5));
      inside -= 1;
      return syncAnswer(body);
    });

    const first = syncFieldQueue(store.dispatch);
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    const second = syncFieldQueue(store.dispatch);
    expect(second).toBe(first);
    await first;

    expect(overlap).toBe(false);
    const sent = calls.filter((c) => c.path === '/tech/sync').flatMap((c) => c.body.mutations.map((m) => m.payload.status));
    expect(sent).toEqual(['EN_ROUTE', 'IN_PROGRESS']);
    expect(await pending()).toEqual([]);
  });
});

describe('the sync engine — the survey stepper (Phase L5)', () => {
  it('sends a survey sketch with its kind and room', async () => {
    await addUpload({ target: 'survey', targetId: 's1', kind: 'SKETCH', area: 'बैठक कोठा', caption: 'Plan', file: picture('sketch.jpg') });
    const calls = mockApi(({ path }) => (path === '/tech/surveys/s1/photos' ? photoAnswer('m-sketch') : undefined));
    const store = makeStore(signedInAs('SURVEYOR'));

    await syncFieldQueue(store.dispatch);

    const [upload] = calls.filter((c) => c.method === 'POST');
    expect(upload.body.get('kind')).toBe('SKETCH');
    expect(upload.body.get('area')).toBe('बैठक कोठा');
    expect(upload.body.get('caption')).toBe('Plan');
  });

  it('holds a survey save and its submit until the checklist photo is up, then sends the reading with its media id', async () => {
    const photo = await addUpload({ target: 'survey', targetId: 's1', kind: 'ISSUE', caption: 'Moisture at 300 mm', file: picture('meter.jpg') });
    await enqueue({
      kind: 'survey_draft', surveyId: 's1',
      payload: { readings: [{ questionKey: 'moisture_low', label: 'Moisture at 300 mm', value: 24, unit: '%', photoUploadId: photo.id, sortOrder: 0 }] },
    });
    await enqueue({ kind: 'survey_submit', surveyId: 's1', payload: {} });
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return syncAnswer(body);
      if (path === '/tech/surveys/s1/photos') return photoAnswer('m-meter');
      return undefined;
    });
    const store = makeStore(signedInAs('SURVEYOR'));

    await syncFieldQueue(store.dispatch);

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.path)).toEqual(['/tech/sync', '/tech/surveys/s1/photos', '/tech/sync']);
    expect(posts[0].body.mutations.map((m) => m.kind)).toEqual(['status']);
    expect(posts[2].body.mutations.map((m) => m.kind)).toEqual(['survey_draft', 'survey_submit']);
    expect(posts[2].body.mutations[0].payload.readings).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', value: 24, unit: '%', mediaId: 'm-meter', sortOrder: 0 },
    ]);
    expect(await pending()).toEqual([]);
  });

  it('sends the reading without the photo when the picture was refused, so the office says what is missing', async () => {
    const photo = await addUpload({ target: 'survey', targetId: 's1', file: picture('not-a-photo.jpg') });
    await enqueue({
      kind: 'survey_draft', surveyId: 's1',
      payload: { readings: [{ questionKey: 'moisture_low', label: 'Moisture at 300 mm', value: 24, photoUploadId: photo.id, sortOrder: 0 }] },
    });
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return syncAnswer(body);
      if (path === '/tech/surveys/s1/photos') return json({ error: { code: 'BAD_REQUEST', message: 'Not an image' } }, 400);
      return undefined;
    });
    const store = makeStore(signedInAs('SURVEYOR'));

    await syncFieldQueue(store.dispatch);

    const syncs = calls.filter((c) => c.path === '/tech/sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].body.mutations[0].payload.readings).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', value: 24, sortOrder: 0 },
    ]);
    expect(store.getState().fieldSync.notes).toEqual([expect.objectContaining({ source: 'upload', surveyId: 's1', code: 'BAD_REQUEST' })]);
  });
});

describe('the site diary and the materials plan (Phase L7)', () => {
  it('holds a diary day until its photo is up — without holding the job’s other changes — then sends the media id', async () => {
    const photo = await addUpload({ target: 'job', targetId: 'j1', kind: 'DURING', caption: 'Site diary 2026-09-28', file: picture('day.jpg') });
    await enqueue({
      kind: 'diary_save', jobId: 'j1',
      payload: { day: '2026-09-28', headcount: [{ tradeId: 'tr1', count: 3 }], progress: [], received: [], lostHours: 0, photoMediaIds: ['m-old'] },
      meta: { form: {}, photoUploadIds: [photo.id] },
    });
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return syncAnswer(body);
      if (path === '/tech/jobs/j1/photos') return photoAnswer('m-day');
      return undefined;
    });
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.path)).toEqual(['/tech/sync', '/tech/jobs/j1/photos', '/tech/sync']);
    // The day waits for its picture; the job's status change made after it does not.
    expect(posts[0].body.mutations.map((m) => m.kind)).toEqual(['status']);
    expect(posts[2].body.mutations).toEqual([expect.objectContaining({
      kind: 'diary_save', jobId: 'j1', payload: expect.objectContaining({ day: '2026-09-28', photoMediaIds: ['m-old', 'm-day'] }),
    })]);
    expect(JSON.stringify(posts[2].body)).not.toMatch(/photoUploadIds|meta/);
    expect(await pending()).toEqual([]);
  });

  it('sends a diary day without a photo the office refused', async () => {
    const photo = await addUpload({ target: 'job', targetId: 'j1', kind: 'DURING', file: picture('not-a-photo.jpg') });
    await enqueue({
      kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28', photoMediaIds: [] }, meta: { photoUploadIds: [photo.id] },
    });
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return syncAnswer(body);
      if (path === '/tech/jobs/j1/photos') return json({ error: { code: 'BAD_REQUEST', message: 'Not an image' } }, 400);
      return undefined;
    });
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    const syncs = calls.filter((c) => c.path === '/tech/sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].body.mutations[0].payload.photoMediaIds).toEqual([]);
  });

  it('drops a diary day the office will never take (the job is not on site) and says so', async () => {
    await enqueue({ kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28' } });
    mockApi(({ path, body }) => (path === '/tech/sync'
      ? syncAnswer(body, { diary_save: { status: 'failed', code: 'JOB_NOT_ON_SITE', error: 'Job JOB-1 is verified: its diary is closed.' } })
      : undefined));
    const store = makeStore(signedInAs('TECHNICIAN'));

    await syncFieldQueue(store.dispatch);

    expect(await pending()).toEqual([]);
    expect(store.getState().fieldSync.notes).toEqual([expect.objectContaining({ kind: 'diary_save', jobId: 'j1', code: 'JOB_NOT_ON_SITE' })]);
  });

  it('says a material over the job’s plan as a warning, in the technician’s language — the material stays logged', async () => {
    await enqueue({ kind: 'material', jobId: 'j1', payload: { materialId: 'm1', qty: 30 }, meta: { material: { id: 'm1', name: 'Crystalline slurry', unit: 'kg' } } });
    mockApi(({ path, body }) => (path === '/tech/sync'
      ? syncAnswer(body, { material: { warnings: [{ code: 'OVER_PLAN', materialId: 'm1', name: 'Crystalline slurry', unit: 'kg', planned: 120, issued: 130.5 }] } })
      : undefined));
    const store = makeStore({ ...signedInAs('TECHNICIAN'), ui: { ...makeStore().getState().ui, locale: 'ne' } });

    await syncFieldQueue(store.dispatch);

    expect(await pending()).toEqual([]);
    const [toast] = store.getState().ui.toasts;
    expect(toast).toMatchObject({ variant: 'warning', title: 'योजनाभन्दा बढी' });
    expect(toast.description).toContain('130.5 kg');
    expect(toast.description).toContain('120 kg');
  });
});
