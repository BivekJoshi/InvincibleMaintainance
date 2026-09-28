import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import {
  MAX_ATTEMPTS, TERMINAL_CODES, dropPending, enqueue, failureKind, flush, pending, scopeOf, settle, toWire,
} from '@/helpers/offlineQueue';

/** jsdom has no IndexedDB, so the queue runs on `fieldDb`'s in-memory stores — the same code above them. */
beforeEach(() => resetFieldDbForTests());
afterEach(() => vi.restoreAllMocks());

const answer = (results) => ({ results, applied: 0, duplicates: 0, failed: 0 });

describe('offline queue — order', () => {
  it('keeps the order the technician acted in, even inside one millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-27T05:00:00.000Z'));
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    await enqueue({ kind: 'material', jobId: 'j1', payload: { materialId: 'm1', qty: 3 } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't2', payload: { isDone: true } });

    const queue = await pending();
    expect(queue.map((m) => `${m.kind}:${m.taskId ?? ''}`)).toEqual(['status:', 'task:t1', 'material:', 'task:t2']);
    // `at` is what the server sorts a replay by, so it must be strictly increasing.
    const ats = queue.map((m) => Date.parse(m.at));
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(new Set(ats).size).toBe(4);
    expect(queue.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
  });

  it('never stamps a change before an earlier one when the clock goes back', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(Date.parse('2026-09-27T05:00:10.000Z'));
    await enqueue({ kind: 'time_start', jobId: 'j1' });
    now.mockReturnValue(Date.parse('2026-09-27T04:59:00.000Z')); // NTP set the phone back a minute
    await enqueue({ kind: 'time_stop', jobId: 'j1' });
    const [start, stop] = await pending();
    expect(stop.at > start.at).toBe(true);
  });

  it('sends the queue in that order, in the shape /tech/sync takes', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    await enqueue({ kind: 'material', jobId: 'j1', payload: { materialId: 'm1', qty: 2.5 }, meta: { material: { name: 'Cement' } } });
    const send = vi.fn(async (batch) => answer(batch.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied' }))));

    const result = await flush(send);

    const [batch] = send.mock.calls[0];
    expect(batch.map((m) => m.kind)).toEqual(['status', 'material']);
    expect(batch[1]).toEqual({
      idempotencyKey: expect.any(String), at: expect.any(String), kind: 'material', jobId: 'j1',
      payload: { materialId: 'm1', qty: 2.5 },
    });
    // The queue's bookkeeping never leaves the phone.
    expect(batch[1]).not.toHaveProperty('meta');
    expect(batch[1]).not.toHaveProperty('seq');
    expect(result.applied).toHaveLength(2);
    expect(await pending()).toEqual([]);
  });
});

describe('offline queue — dedupe by idempotency key', () => {
  it('stores a key once: enqueueing it again is a no-op that keeps its place', async () => {
    const key = await enqueue({ idempotencyKey: 'complete-sig-0001', kind: 'complete', jobId: 'j1', payload: { note: 'first' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    const again = await enqueue({ idempotencyKey: 'complete-sig-0001', kind: 'complete', jobId: 'j1', payload: { note: 'second' } });

    expect(again).toBe(key);
    const queue = await pending();
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ idempotencyKey: 'complete-sig-0001', payload: { note: 'first' } });
  });

  it('drops what the server says it applied before (`duplicate`) — a resend after a lost answer is harmless', async () => {
    const key = await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    const result = await flush(async () => answer([{ idempotencyKey: key, status: 'duplicate' }]));
    expect(result.applied.map((m) => m.idempotencyKey)).toEqual([key]);
    expect(await pending()).toEqual([]);
  });
});

describe('offline queue — failures', () => {
  it('drops a terminal refusal with its reason, keeps a retryable one, and keeps what was not answered', async () => {
    const replay = await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    const flaky = await enqueue({ kind: 'material', jobId: 'j1', payload: { materialId: 'm1', qty: 1 } });
    const unanswered = await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });

    const result = await flush(async () => answer([
      { idempotencyKey: replay, status: 'failed', code: 'INVALID_TRANSITION', error: 'Cannot move a job from COMPLETED to EN_ROUTE' },
      { idempotencyKey: flaky, status: 'failed', code: 'SYNC_FAILED', error: 'Deadlock' },
    ]));

    expect(result.refused).toEqual([
      { entry: expect.objectContaining({ idempotencyKey: replay }), code: 'INVALID_TRANSITION', message: 'Cannot move a job from COMPLETED to EN_ROUTE' },
    ]);
    const left = await pending();
    expect(left.map((m) => m.idempotencyKey)).toEqual([flaky, unanswered]);
    expect(left[0]).toMatchObject({ attempts: 1, lastError: 'Deadlock' });
    expect(left[1].attempts).toBe(0);
  });

  it(`gives up on a retryable failure after ${MAX_ATTEMPTS} attempts — never retried for ever`, async () => {
    const key = await enqueue({ kind: 'material', jobId: 'j1', payload: { materialId: 'm1', qty: 1 } });
    const send = async () => answer([{ idempotencyKey: key, status: 'failed', code: 'SYNC_FAILED', error: 'Boom' }]);
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const result = await flush(send);
      expect(result.refused).toEqual([]);
    }
    const last = await flush(send);
    expect(last.refused).toHaveLength(1);
    expect(await pending()).toEqual([]);
  });

  it('keeps everything, uncounted, when there is no answer (offline)', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    await expect(flush(async () => { throw { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' }; }))
      .rejects.toMatchObject({ status: 'FETCH_ERROR' });
    const left = await pending();
    expect(left).toHaveLength(2);
    expect(left.every((m) => m.attempts === 0)).toBe(true);
  });

  it('counts an attempt on each entry when the whole batch is refused, instead of dropping them all', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    const result = await flush(async () => { throw { status: 400, data: { error: { code: 'VALIDATION_ERROR', message: 'Invalid' } } }; });
    expect(result.refused).toEqual([]);
    expect((await pending())[0].attempts).toBe(1);
  });

  it('reads a failed request as offline, server or refused', () => {
    expect(failureKind({ status: 'FETCH_ERROR' })).toBe('offline');
    expect(failureKind({ status: 'TIMEOUT_ERROR' })).toBe('offline');
    expect(failureKind({ status: 401 })).toBe('offline');
    expect(failureKind({ status: 429 })).toBe('offline');
    expect(failureKind({ status: 502 })).toBe('server');
    expect(failureKind({ status: 'PARSING_ERROR', originalStatus: 504 })).toBe('server');
    expect(failureKind({ status: 413 })).toBe('refused');
    expect(failureKind({ status: 403 })).toBe('refused');
  });
});

describe('settle', () => {
  it('is pure: the batch is not changed', () => {
    const batch = [{ idempotencyKey: 'k1', kind: 'task', attempts: 0 }];
    const copy = structuredClone(batch);
    settle(batch, answer([{ idempotencyKey: 'k1', status: 'failed', code: 'SYNC_FAILED' }]));
    expect(batch).toEqual(copy);
  });

  it('toWire leaves out an absent jobId, surveyId and taskId', () => {
    expect(toWire({ idempotencyKey: 'k', at: 'a', kind: 'survey_submit', surveyId: 's1', seq: 3, attempts: 0 }))
      .toEqual({ idempotencyKey: 'k', at: 'a', kind: 'survey_submit', surveyId: 's1', payload: {} });
  });
});

describe('offline queue — survey saves (Phase L5)', () => {
  it('drops the drafts a newer full save replaces', async () => {
    const old = await enqueue({ kind: 'survey_draft', surveyId: 's1', payload: { diagnosis: 'first' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    await enqueue({ kind: 'survey_draft', surveyId: 's2', payload: { diagnosis: 'other survey' } });

    expect(await dropPending((e) => e.kind === 'survey_draft' && e.surveyId === 's1')).toBe(1);
    expect((await pending()).map((e) => e.idempotencyKey)).not.toContain(old);
    expect(await pending()).toHaveLength(2);
  });

  it('holds what `resolve` is not ready to send — and everything after it for the same survey — while the rest goes', async () => {
    const draft = await enqueue({ kind: 'survey_draft', surveyId: 's1', payload: { readings: [{ label: 'Moisture', value: 24, photoUploadId: 'u1' }] } });
    const submit = await enqueue({ kind: 'survey_submit', surveyId: 's1', payload: {} });
    const task = await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    let ready = false;
    const resolve = (wire) => {
      if (!wire.payload.readings?.some((r) => r.photoUploadId)) return wire;
      if (!ready) return null;
      return { ...wire, payload: { readings: [{ label: 'Moisture', value: 24, mediaId: 'm1' }] } };
    };
    const sends = [];
    const send = async (mutations) => {
      sends.push(mutations);
      return answer(mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied' })));
    };

    const first = await flush(send, { resolve });
    expect(first).toMatchObject({ sent: 1, held: 2, remaining: 2 });
    expect(sends[0].map((m) => m.idempotencyKey)).toEqual([task]);

    ready = true;
    const second = await flush(send, { resolve });
    expect(second).toMatchObject({ sent: 2, held: 0, remaining: 0 });
    expect(sends[1].map((m) => m.idempotencyKey)).toEqual([draft, submit]);
    expect(sends[1][0].payload.readings[0]).toEqual({ label: 'Moisture', value: 24, mediaId: 'm1' });
  });

  it('drops a submit the server calls incomplete, with the missing items it named', async () => {
    const key = await enqueue({ kind: 'survey_submit', surveyId: 's1', payload: {} });
    const details = [{ questionKey: 'dpc_visible', label: 'DPC visible', missing: 'answer' }];
    const result = await flush(async () => answer([{ idempotencyKey: key, status: 'failed', code: 'SURVEY_INCOMPLETE', error: 'Not finished', details }]));
    expect(result.refused).toEqual([expect.objectContaining({ code: 'SURVEY_INCOMPLETE', details })]);
    expect(await pending()).toEqual([]);
  });
});

describe('the site diary in the queue (Phase L7)', () => {
  it('is a record of its own — a job + day — so a day waiting for its photos holds only that day', () => {
    expect(scopeOf({ kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28' } })).toBe('diary:j1:2026-09-28');
    expect(scopeOf({ kind: 'status', jobId: 'j1' })).toBe('job:j1');
    expect(scopeOf({ kind: 'survey_draft', surveyId: 's1' })).toBe('survey:s1');
  });

  it('keeps what the server warned about beside an applied change, and treats a refused day as final', () => {
    const entry = { idempotencyKey: 'k-material-1', kind: 'material', jobId: 'j1', payload: {} };
    const warnings = [{ code: 'OVER_PLAN', materialId: 'm1', planned: 120, issued: 130 }];
    const { done } = settle([entry], answer([{ idempotencyKey: 'k-material-1', status: 'applied', warnings }]));
    expect(done).toEqual([{ ...entry, warnings }]);
    for (const code of ['JOB_NOT_ON_SITE', 'UNKNOWN_LINE', 'UNKNOWN_TRADE']) expect(TERMINAL_CODES.has(code), code).toBe(true);
  });

  it('holds a diary day and the later saves of that day together, not the job’s other changes', async () => {
    await enqueue({ kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28' }, meta: { photoUploadIds: ['up-1'] } });
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    await enqueue({ kind: 'diary_save', jobId: 'j1', payload: { day: '2026-09-28' } });
    const send = vi.fn(async (batch) => answer(batch.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied' }))));
    const result = await flush(send, { resolve: (wire, entry) => (entry.meta?.photoUploadIds ? null : wire) });
    expect(send.mock.calls[0][0].map((m) => m.kind)).toEqual(['status']);
    expect(result).toMatchObject({ held: 2, remaining: 2 });
  });
});
