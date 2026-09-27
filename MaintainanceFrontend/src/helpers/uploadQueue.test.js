import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { MAX_ATTEMPTS, enqueue, pending } from '@/helpers/offlineQueue';
import { addUpload, describeUpload, drainUploads, pendingUploads } from '@/helpers/uploadQueue';

beforeEach(() => resetFieldDbForTests());

const picture = (name) => new File([new Uint8Array(64)], name, { type: 'image/jpeg' });
const offline = { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' };
const uploaded = (id) => ({ photos: [{ id: `p-${id}`, mediaId: id }], media: [{ id, thumb: `/uploads/${id}-400.webp` }] });

describe('upload queue — retry, in order', () => {
  it('waits while offline and sends everything, oldest first, when the signal is back', async () => {
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('a.jpg') });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'DURING', caption: 'Crack', file: picture('b.jpg') });
    await addUpload({ target: 'survey', targetId: 's1', file: picture('c.jpg') });

    const dead = vi.fn(async () => { throw offline; });
    const first = await drainUploads(dead);
    expect(first).toMatchObject({ stopped: true, sent: [], refused: [] });
    // It stopped at the first one — no later photo was tried ahead of it.
    expect(dead).toHaveBeenCalledTimes(1);
    expect((await pendingUploads()).map((u) => u.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect((await pendingUploads())[0].attempts).toBe(0);

    const sent = [];
    const live = vi.fn(async (entry) => { sent.push(entry.name); return uploaded(`m-${entry.name}`); });
    const second = await drainUploads(live);
    expect(sent).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(second.stopped).toBe(false);
    expect(second.sent[1].entry).toMatchObject({ kind: 'DURING', caption: 'Crack' });
    expect(second.sent[1].entry).not.toHaveProperty('file');
    expect(await pendingUploads()).toEqual([]);
  });

  it('keeps the order when the connection drops half-way', async () => {
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('a.jpg') });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'AFTER', file: picture('b.jpg') });
    let calls = 0;
    const result = await drainUploads(async () => {
      calls += 1;
      if (calls === 2) throw offline;
      return uploaded('m-a');
    });
    expect(result.sent.map((s) => s.entry.name)).toEqual(['a.jpg']);
    expect((await pendingUploads()).map((u) => u.name)).toEqual(['b.jpg']);
  });

  it('drops a picture the server refuses (4xx) with its reason and goes on to the next', async () => {
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('bad.gif') });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'AFTER', file: picture('good.jpg') });
    const result = await drainUploads(async (entry) => {
      if (entry.name === 'bad.gif') throw { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'Unsupported image type' } } };
      return uploaded('m-good');
    });
    expect(result.refused).toEqual([{ entry: expect.objectContaining({ name: 'bad.gif' }), code: 'BAD_REQUEST', message: 'Unsupported image type' }]);
    expect(result.sent.map((s) => s.entry.name)).toEqual(['good.jpg']);
    expect(await pendingUploads()).toEqual([]);
  });

  it(`retries a 5xx, stopping there each time, and gives up after ${MAX_ATTEMPTS} attempts`, async () => {
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: picture('a.jpg') });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'AFTER', file: picture('b.jpg') });
    const broken = vi.fn(async (entry) => {
      if (entry.name === 'a.jpg') throw { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'sharp failed' } } };
      return uploaded('m-b');
    });
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const round = await drainUploads(broken);
      expect(round.stopped).toBe(true);
      expect((await pendingUploads())[0]).toMatchObject({ name: 'a.jpg', attempts: i, lastError: 'sharp failed' });
    }
    const last = await drainUploads(broken);
    expect(last.refused.map((r) => r.entry.name)).toEqual(['a.jpg']);
    expect(last.sent.map((s) => s.entry.name)).toEqual(['b.jpg']);
  });

  it('describes an upload without its bytes', async () => {
    const entry = await addUpload({ target: 'job', targetId: 'j1', kind: 'ISSUE', caption: '  Damp  ', file: picture('x.jpg') });
    expect(describeUpload(entry)).toEqual({
      id: entry.id, seq: 1, at: entry.at, target: 'job', targetId: 'j1', kind: 'ISSUE', caption: 'Damp',
      name: 'x.jpg', size: 64, attempts: 0, lastError: null,
    });
  });
});

describe('signature → complete ordering', () => {
  it('enqueues `complete` only once the signature is uploaded — with its media id, after every earlier change', async () => {
    // Offline, the technician ticks the last item and has the customer sign.
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't3', payload: { isDone: true } });
    const signature = await addUpload({
      target: 'job', targetId: 'j1', kind: 'SIGNATURE', file: picture('signature.png'),
      then: { kind: 'complete', jobId: 'j1', payload: { note: 'Membrane laid', customerRating: 5 } },
    });
    expect(signature.then.idempotencyKey).toEqual(expect.any(String));
    const followUp = vi.fn((mutation) => enqueue(mutation));

    // Still offline: the upload waits, and no `complete` exists yet — it would have no media id.
    await drainUploads(async () => { throw offline; }, { followUp });
    expect(followUp).not.toHaveBeenCalled();
    expect((await pending()).map((m) => m.kind)).toEqual(['task']);
    expect(await pendingUploads()).toHaveLength(1);

    // Signal: the signature goes up, and its `complete` joins the queue behind the tick.
    await drainUploads(async (entry) => {
      expect(entry.kind).toBe('SIGNATURE');
      return uploaded('m-sig');
    }, { followUp });
    const queue = await pending();
    expect(queue.map((m) => m.kind)).toEqual(['task', 'complete']);
    expect(queue[1]).toMatchObject({
      idempotencyKey: signature.then.idempotencyKey,
      jobId: 'j1',
      payload: { note: 'Membrane laid', customerRating: 5, signatureMediaId: 'm-sig' },
    });
    expect(queue[1].at > queue[0].at).toBe(true);
    expect(await pendingUploads()).toEqual([]);
  });

  it('is still one completion when the follow-up is enqueued twice (a crash between the two writes)', async () => {
    const signature = await addUpload({
      target: 'job', targetId: 'j1', kind: 'SIGNATURE', file: picture('signature.png'),
      then: { kind: 'complete', jobId: 'j1', payload: {} },
    });
    const mutation = { ...signature.then, payload: { signatureMediaId: 'm-sig' } };
    await enqueue(mutation);
    await enqueue(mutation);
    expect(await pending()).toHaveLength(1);
  });

  it('reports a refused signature, and no completion is queued', async () => {
    await addUpload({
      target: 'job', targetId: 'j1', kind: 'SIGNATURE', file: picture('signature.png'),
      then: { kind: 'complete', jobId: 'j1', payload: {} },
    });
    const followUp = vi.fn();
    const result = await drainUploads(async () => { throw { status: 403, data: { error: { code: 'FORBIDDEN', message: 'This job is not assigned to you' } } }; }, { followUp });
    expect(followUp).not.toHaveBeenCalled();
    expect(result.refused[0]).toMatchObject({ code: 'FORBIDDEN', entry: { then: { kind: 'complete' } } });
  });
});
