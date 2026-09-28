import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, badRequest, notFound } from '../utils/AppError.js';
import { dayjs, local } from '../utils/dates.js';
import { recordEvent } from './audit.service.js';
import { resolveMediaMap } from './media.service.js';

/**
 * The site diary (Phase L7): the foreman's day on site — weather, headcount per trade (daily-wage labour are not
 * app users), progress per BOQ line, deliveries with the challan, issues and the hours lost and why, photos.
 * One entry per job per Kathmandu day, saved as a FULL replace (PUT and the `diary_save` sync kind), so a replay
 * lands on the same state. No money anywhere (D1). A delivery does not move stock: that is the purchase list's
 * and issue-to-job's.
 */

/** A diary is filed while the work is on: from scheduling to completion (a late entry for the last day). */
const OPEN_FOR_DIARY = ['SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const MAX_DAYS_BACK = 60;

/** Today, as a Kathmandu calendar day. */
export const todayKtm = () => local(new Date(), 'YYYY-MM-DD');

/** A diary day is a real Kathmandu date, not in the future, and at most 60 days back. */
function assertDay(day) {
  const tz = env.business.timezone;
  const d = dayjs.tz(day, tz);
  if (!d.isValid() || d.format('YYYY-MM-DD') !== day) throw badRequest(`${day} is not a date`);
  const today = dayjs().tz(tz).startOf('day');
  if (d.isAfter(today)) throw badRequest('A diary day cannot be in the future');
  if (today.diff(d, 'day') > MAX_DAYS_BACK) throw badRequest(`A diary day can be at most ${MAX_DAYS_BACK} days back`);
}

const LINE = { id: true, number: true, section: true, source: true, description: true, unit: true, quotedQty: true, progressPct: true, sortOrder: true };

async function jobOf(jobId, client = prisma) {
  const job = await client.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: { id: true, number: true, status: true, lines: { orderBy: { sortOrder: 'asc' }, select: LINE } },
  });
  if (!job) throw notFound('Job');
  return job;
}

const shape = (row) => (row ? {
  id: row.id, jobId: row.jobId, day: row.day, weather: row.weather, headcount: row.headcount ?? [], progress: row.progress ?? [],
  received: row.received ?? [], issues: row.issues, lostHours: row.lostHours, lostReason: row.lostReason,
  photoMediaIds: row.photoMediaIds ?? [], note: row.note, createdBy: row.createdBy ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt,
} : null);

const AUTHOR = { createdBy: { select: { id: true, name: true } } };

/** GET /tech/jobs/:id/diary — the job's diary days, newest first, and today's date in Kathmandu. */
export async function diaryDays(jobId) {
  await jobOf(jobId);
  const rows = await prisma.siteDiary.findMany({ where: { jobId }, orderBy: { day: 'desc' }, take: 120 });
  return {
    today: todayKtm(),
    days: rows.map((r) => ({
      day: r.day, weather: r.weather, lostHours: r.lostHours, updatedAt: r.updatedAt,
      headcountTotal: (r.headcount ?? []).reduce((a, h) => a + Number(h.count || 0), 0),
    })),
  };
}

/**
 * GET /tech/jobs/:id/diary/:day — the day's entry (or null) with what the form needs: the job's lines (no
 * rate), the trades for the headcount, the materials for a delivery.
 */
export async function getDiaryDay(jobId, day) {
  assertDay(day);
  const job = await jobOf(jobId);
  const [entry, trades, materials] = await Promise.all([
    prisma.siteDiary.findUnique({ where: { jobId_day: { jobId, day } }, include: AUTHOR }),
    prisma.trade.findMany({ where: { deletedAt: null, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, code: true, name: true } }),
    prisma.material.findMany({ where: { deletedAt: null, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, code: true, name: true, unit: true } }),
  ]);
  const media = await resolveMediaMap(entry?.photoMediaIds ?? []);
  return { day, entry: shape(entry), lines: job.lines.map(({ sortOrder: _s, ...l }) => l), trades, materials, media };
}

/**
 * Each line's progress is what the latest diary day that mentions it says — so filing an older day never
 * rolls a line back past a newer one. Worked out afresh from all the job's diaries on every save.
 */
async function applyProgress(tx, job) {
  const diaries = await tx.siteDiary.findMany({ where: { jobId: job.id }, orderBy: { day: 'desc' }, select: { progress: true } });
  const latest = new Map();
  for (const d of diaries) {
    for (const p of d.progress ?? []) if (!latest.has(p.jobLineId)) latest.set(p.jobLineId, Number(p.progressPct));
  }
  for (const line of job.lines) {
    const pct = latest.get(line.id) ?? 0;
    if (pct !== line.progressPct) await tx.jobLine.update({ where: { id: line.id }, data: { progressPct: pct } });
  }
}

/**
 * PUT /tech/jobs/:id/diary/:day and `diary_save` — the day's entry, replaced whole. A line or trade that is not
 * the job's / not known is 422 (UNKNOWN_LINE, UNKNOWN_TRADE) with the ids; a job not on site is 422 JOB_NOT_ON_SITE.
 * @param {object} input  ops.js#diarySchema
 */
export async function saveDiary(jobId, day, input, userId) {
  assertDay(day);
  const job = await jobOf(jobId);
  if (!OPEN_FOR_DIARY.includes(job.status)) {
    throw new AppError(422, 'JOB_NOT_ON_SITE', `Job ${job.number} is ${job.status.toLowerCase()}: its diary is closed.`);
  }
  const lineIds = new Set(job.lines.map((l) => l.id));
  const strangers = input.progress.filter((p) => !lineIds.has(p.jobLineId)).map((p) => p.jobLineId);
  if (strangers.length) throw new AppError(422, 'UNKNOWN_LINE', 'Progress names a line that is not on this job', strangers);
  const tradeIds = [...new Set(input.headcount.map((h) => h.tradeId))];
  const known = await prisma.trade.count({ where: { id: { in: tradeIds } } });
  if (known !== tradeIds.length) throw new AppError(422, 'UNKNOWN_TRADE', 'The headcount names a trade that does not exist', tradeIds);

  const data = {
    weather: input.weather ?? null,
    headcount: input.headcount.filter((h) => h.count > 0),
    progress: input.progress,
    received: input.received,
    issues: input.issues ?? null,
    lostHours: input.lostHours ?? 0,
    lostReason: input.lostHours > 0 ? input.lostReason : null,
    photoMediaIds: input.photoMediaIds ?? [],
    note: input.note ?? null,
  };
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.siteDiary.upsert({
      where: { jobId_day: { jobId, day } },
      create: { jobId, day, ...data, createdById: userId ?? null },
      update: { ...data, updatedById: userId ?? null },
      include: AUTHOR,
    });
    await applyProgress(tx, job);
    await recordEvent('site_diary.saved', { model: 'SiteDiary', recordId: saved.id, meta: { jobId, day, lines: data.progress.length } }, tx);
    return saved;
  });
  return shape(row);
}

/**
 * GET /admin/jobs/:id/diary — every day filed, newest first, with the trades' names, the lines' numbers and the
 * photos' images (`media`).
 */
export async function officeDiary(jobId) {
  const job = await jobOf(jobId);
  const rows = await prisma.siteDiary.findMany({ where: { jobId }, orderBy: { day: 'desc' }, include: AUTHOR, take: 366 });
  const tradeIds = [...new Set(rows.flatMap((r) => (r.headcount ?? []).map((h) => h.tradeId)))];
  const [trades, media] = await Promise.all([
    prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, name: true } }),
    resolveMediaMap(rows.flatMap((r) => r.photoMediaIds ?? [])),
  ]);
  const tradeName = new Map(trades.map((t) => [t.id, t.name]));
  const line = new Map(job.lines.map((l) => [l.id, l]));
  return {
    days: rows.map((r) => ({
      ...shape(r),
      headcount: (r.headcount ?? []).map((h) => ({ ...h, tradeName: tradeName.get(h.tradeId) ?? null })),
      progress: (r.progress ?? []).map((p) => ({ ...p, number: line.get(p.jobLineId)?.number ?? null, description: line.get(p.jobLineId)?.description ?? null })),
    })),
    media,
  };
}
