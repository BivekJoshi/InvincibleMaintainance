import { describe, expect, it } from 'vitest';
import {
  applyPending, completionUpload, historyQuery, jobsInRange, openTasks, recentRange, runningTimer,
} from '@/helpers/fieldJob';

const JOB = {
  id: 'j1',
  status: 'ASSIGNED',
  actualStart: null,
  tasks: [
    { id: 't1', title: 'Photograph before', isDone: false, isSkipped: false },
    { id: 't2', title: 'Apply membrane', isDone: false, isSkipped: false },
    { id: 't3', title: 'Flood test', isDone: false, isSkipped: true },
  ],
  materials: [{ id: 'jm1', qty: 22, material: { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' } }],
  timeLogs: [
    { id: 'tl-other', startedAt: '2026-09-27T04:00:00.000Z', endedAt: null, minutes: null, technician: { user: { id: 'u-suresh' } } },
  ],
};

const m = (kind, at, rest = {}) => ({ idempotencyKey: `k-${kind}-${at}`, kind, jobId: 'j1', at, payload: {}, ...rest });

describe('applyPending — the job as it will be once the queue is sent', () => {
  it('applies status, ticks, a material and the timer in order, and marks what is still waiting', () => {
    const queue = [
      m('status', '2026-09-27T05:00:00.000Z', { payload: { status: 'EN_ROUTE' } }),
      m('status', '2026-09-27T05:20:00.000Z', { payload: { status: 'IN_PROGRESS' } }),
      m('task', '2026-09-27T05:21:00.000Z', { taskId: 't1', payload: { isDone: true } }),
      m('time_start', '2026-09-27T05:22:00.000Z'),
      m('material', '2026-09-27T05:30:00.000Z', {
        payload: { materialId: 'mat2', qty: 3 },
        meta: { material: { id: 'mat2', code: 'CEM-OPC', name: 'Cement (OPC)', unit: 'bag' } },
      }),
      m('time_stop', '2026-09-27T06:52:00.000Z'),
      { ...m('task', '2026-09-27T06:00:00.000Z', { taskId: 't2', payload: { isDone: true } }), jobId: 'another-job' },
    ];
    const job = applyPending(JOB, queue, { userId: 'u-hari' });

    expect(job.status).toBe('IN_PROGRESS');
    expect(job.actualStart).toBe('2026-09-27T05:20:00.000Z');
    expect(job.tasks.map((t) => [t.id, t.isDone, Boolean(t.pending)])).toEqual([['t1', true, true], ['t2', false, false], ['t3', false, false]]);
    expect(job.materials.at(-1)).toMatchObject({ qty: 3, pending: true, material: { name: 'Cement (OPC)', unit: 'bag' } });
    // Hari's own timer ran 05:22 → 06:52; Suresh's is left alone.
    expect(job.timeLogs.find((l) => l.pending)).toMatchObject({ endedAt: '2026-09-27T06:52:00.000Z', minutes: 90 });
    expect(job.timeLogs.find((l) => l.id === 'tl-other').endedAt).toBeNull();
    expect(job.pendingCount).toBe(6);
    // Pure: the server's job is untouched.
    expect(JOB.status).toBe('ASSIGNED');
    expect(JOB.tasks[0].isDone).toBe(false);
  });

  it('completes the job and closes every running timer, as the server will', () => {
    const job = applyPending({ ...JOB, status: 'IN_PROGRESS' }, [
      m('complete', '2026-09-27T08:00:00.000Z', { payload: { note: 'Done', customerRating: 5, signatureMediaId: 'm-sig' } }),
    ]);
    expect(job).toMatchObject({ status: 'COMPLETED', completionNote: 'Done', customerRating: 5, actualEnd: '2026-09-27T08:00:00.000Z' });
    expect(job.timeLogs.every((l) => l.endedAt)).toBe(true);
  });

  it('writes nothing extra when patching the cache after a sync (`mark: false`)', () => {
    const job = applyPending(JOB, [m('task', '2026-09-27T05:21:00.000Z', { taskId: 't1', payload: { isDone: true } }), m('time_start', '2026-09-27T05:22:00.000Z')], { mark: false });
    expect(job.tasks[0]).not.toHaveProperty('pending');
    expect(job.timeLogs.some((l) => 'pending' in l)).toBe(false);
    expect(job).not.toHaveProperty('pendingCount');
  });

  it('returns the same job when nothing waits for it', () => {
    expect(applyPending(JOB, [])).toBe(JOB);
    expect(applyPending(undefined, [m('status', 'x')])).toBeUndefined();
  });
});

describe('job helpers', () => {
  it('counts open checklist items — a skipped one is not open', () => {
    expect(openTasks(JOB).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('finds the signed-in technician’s own running timer', () => {
    expect(runningTimer(JOB, 'u-hari')).toBeNull();
    expect(runningTimer(JOB, 'u-suresh').id).toBe('tl-other');
  });

  it('finds the signature upload that will complete a job', () => {
    const uploads = [
      { id: 'u1', target: 'job', targetId: 'j1', kind: 'DURING' },
      { id: 'u2', target: 'job', targetId: 'j1', kind: 'SIGNATURE', then: { kind: 'complete' } },
    ];
    expect(completionUpload(uploads, 'j1').id).toBe('u2');
    expect(completionUpload(uploads, 'j2')).toBeNull();
  });
});

describe('history range', () => {
  it('asks for a day more on each side — the API reads days in the server’s clock', () => {
    expect(historyQuery({ from: '2026-09-01', to: '2026-09-27' })).toEqual({ from: '2026-08-31', to: '2026-09-28' });
    expect(historyQuery({ from: '2026-01-01', to: '2026-01-01' })).toEqual({ from: '2025-12-31', to: '2026-01-02' });
  });

  it('keeps the jobs on a Kathmandu day inside the range, newest first', () => {
    const jobs = [
      { id: 'early', scheduledStart: '2026-08-31T18:14:00.000Z' }, // 31 Aug 23:59 in Kathmandu — outside
      { id: 'first', scheduledStart: '2026-08-31T18:15:00.000Z' }, // 1 Sep 00:00 in Kathmandu — inside
      { id: 'last', scheduledStart: '2026-09-27T18:14:00.000Z' }, // 27 Sep 23:59 — inside
      { id: 'late', scheduledStart: '2026-09-27T18:15:00.000Z' }, // 28 Sep 00:00 — outside
      { id: 'undated', scheduledStart: null },
    ];
    expect(jobsInRange(jobs, { from: '2026-09-01', to: '2026-09-27' }).map((j) => j.id)).toEqual(['last', 'first']);
  });

  it('builds the preset ranges ending today', () => {
    expect(recentRange(7, '2026-09-27')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(recentRange(30, '2026-09-27')).toEqual({ from: '2026-08-29', to: '2026-09-27' });
  });
});
