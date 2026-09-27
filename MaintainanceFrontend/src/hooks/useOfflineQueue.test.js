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
