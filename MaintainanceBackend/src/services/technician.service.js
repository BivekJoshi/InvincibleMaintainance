import { prisma } from '../lib/prisma.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { can } from '../shared/permissions.js';
import { meta, parseListQuery } from '../utils/pagination.js';
import { toPaisa } from '../utils/money.js';
import { dayjs } from '../utils/dates.js';
import { env } from '../config/env.js';
import { recordEvent } from './audit.service.js';

/**
 * Technician profiles — the people dispatch sends out (technicians and surveyors).
 *
 * The profile is mounted like a registry resource (`routes/admin/mountResource.js`), so this
 * service answers the same calls as `makeCrud`. Two things differ:
 *
 * - `hourlyRate` is labour cost. One profile returns it only to a caller holding `technicians:write`
 *   (the roles that set it); the list never does — SALES reads it to pick a surveyor. The profile's
 *   history is guarded by `technicians:write` for the same reason.
 * - The registry's on/off switch is **availability** (`isAvailable`), because a profile has no
 *   `isActive` — a person who has left is switched off on their user account instead.
 */

const USER = { select: { id: true, name: true, email: true, phone: true, role: true, isActive: true } };

/** Sorts a list may ask for; `name` is the person's. */
const SORTS = {
  employeeCode: (dir) => ({ employeeCode: dir }),
  name: (dir) => ({ user: { name: dir } }),
  rating: (dir) => ({ rating: dir }),
  dailyCapacity: (dir) => ({ dailyCapacity: dir }),
  isAvailable: (dir) => ({ isAvailable: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
};

const withRateFor = (ctx) => Boolean(ctx?.role && can(ctx.role, 'technicians:write'));

/** A profile as a caller may see it. */
function shape(row, ctx) {
  if (!row) return row;
  const out = { ...row };
  if (!withRateFor(ctx)) delete out.hourlyRate;
  return out;
}

/** The Kathmandu week (Sunday to Saturday) holding `now`, as UTC instants. */
export function weekBounds(now = new Date()) {
  const start = dayjs(now).tz(env.business.timezone).startOf('week');
  return { from: start.toDate(), to: start.add(7, 'day').subtract(1, 'millisecond').toDate() };
}

/**
 * How many live jobs each technician has scheduled in the week holding `now`.
 * @returns {Promise<Record<string, number>>}
 */
export async function weekLoad(technicianIds, now = new Date()) {
  if (!technicianIds.length) return {};
  const { from, to } = weekBounds(now);
  const grouped = await prisma.jobAssignment.groupBy({
    by: ['technicianId'],
    where: {
      technicianId: { in: technicianIds },
      job: { deletedAt: null, status: { not: 'CANCELLED' }, scheduledStart: { gte: from, lte: to } },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.technicianId, g._count._all]));
}

/** A JSON string array holds this exact value (skills and areas are picked from the board's own list). */
const listHas = (field, value) => ({ [field]: { array_contains: [value] } });

function listWhere(query) {
  const deleted = query.deleted === true || query.deleted === 'true';
  const q = query.q?.trim();
  return {
    deletedAt: deleted ? { not: null } : null,
    ...(query.role ? { user: { role: query.role } } : {}),
    ...(query.available != null ? { isAvailable: query.available } : {}),
    ...(query.skill ? listHas('skills', query.skill) : {}),
    ...(query.area ? listHas('serviceAreas', query.area) : {}),
    ...(q ? {
      OR: [
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q } } },
      ],
    } : {}),
  };
}

export const model = 'technician';

/**
 * GET /admin/technicians — paginated. Each row carries `loadThisWeek`, the jobs scheduled for
 * that person in the current Kathmandu week. The list never carries `hourlyRate`, whoever asks:
 * it feeds pickers across the office, and the rate is read on the profile itself.
 */
export async function list(query = {}) {
  const { page, limit, skip, take } = parseListQuery(query, { defaultSort: 'employeeCode' });
  const raw = String(query.sort || 'employeeCode');
  const dir = raw.startsWith('-') ? 'desc' : 'asc';
  const orderBy = (SORTS[raw.replace(/^-/, '')] ?? SORTS.employeeCode)(dir);
  const where = listWhere(query);
  const [rows, total] = await Promise.all([
    prisma.technician.findMany({ where, include: { user: USER }, orderBy: [orderBy, { id: 'asc' }], skip, take }),
    prisma.technician.count({ where }),
  ]);
  const load = await weekLoad(rows.map((r) => r.id));
  return {
    items: rows.map((r) => ({ ...shape(r, null), loadThisWeek: load[r.id] ?? 0 })),
    meta: meta({ page, limit, total }),
  };
}

export async function get(id, ctx) {
  const row = await prisma.technician.findFirst({ where: { id, deletedAt: null }, include: { user: USER } });
  if (!row) throw notFound('Technician');
  const load = await weekLoad([row.id]);
  return { ...shape(row, ctx), loadThisWeek: load[row.id] ?? 0 };
}

const toStorage = (data) => ({
  ...data,
  ...(data.hourlyRate !== undefined ? { hourlyRate: data.hourlyRate === null ? null : toPaisa(data.hourlyRate) } : {}),
});

/**
 * A profile for a user who has none. A TECHNICIAN or SURVEYOR account gets one when it is
 * created (Phase G), so this is for older accounts and for office staff who also go out.
 */
export async function create(data, ctx) {
  const user = await prisma.user.findFirst({ where: { id: data.userId, deletedAt: null }, select: { id: true } });
  if (!user) throw notFound('User');
  const existing = await prisma.technician.findUnique({ where: { userId: data.userId }, select: { id: true, deletedAt: true } });
  if (existing) {
    throw conflict(existing.deletedAt
      ? 'This person has a technician profile in Trash — restore it instead'
      : 'This person already has a technician profile', { technicianId: existing.id });
  }
  const row = await prisma.technician.create({ data: toStorage(data), include: { user: USER } });
  return shape(row, ctx);
}

/** The user a profile belongs to never changes. */
export async function update(id, data, ctx) {
  await get(id);
  const { userId: _userId, ...rest } = data;
  const row = await prisma.technician.update({ where: { id }, data: toStorage(rest), include: { user: USER } });
  return shape(row, ctx);
}

/** The registry switch: available for dispatch, or not. */
export async function toggle(id, ctx) {
  const row = await get(id);
  const updated = await prisma.technician.update({
    where: { id }, data: { isAvailable: !row.isAvailable }, include: { user: USER },
  });
  return shape(updated, ctx);
}

/** Soft delete. A profile is never purged: time logs and ratings hang off it. */
export async function remove(id, { hard = false } = {}) {
  if (hard) throw forbidden('A technician profile cannot be deleted for good');
  await get(id);
  await prisma.$transaction(async (tx) => {
    await tx.technician.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordEvent('cms.deleted', { model: 'Technician', recordId: id }, tx);
  });
}

export async function restore(id, ctx) {
  const row = await prisma.technician.findUnique({ where: { id } });
  if (!row) throw notFound('Technician');
  await prisma.$transaction(async (tx) => {
    await tx.technician.update({ where: { id }, data: { deletedAt: null } });
    await recordEvent('cms.restored', {
      model: 'Technician', recordId: id, before: { deletedAt: row.deletedAt }, after: { deletedAt: null },
    }, tx);
  });
  return get(id, ctx);
}

/** Technicians have no manual order. */
export async function reorder() {}

/**
 * GET /admin/technicians/users — active people who have no live profile yet, for the "New
 * technician" form (a dispatcher cannot read the user list itself).
 */
export async function linkableUsers(query = {}) {
  const { page, limit, skip, take } = parseListQuery(query);
  const q = query.q?.trim();
  const where = {
    deletedAt: null,
    isActive: true,
    OR: [{ technician: { is: null } }, { technician: { is: { deletedAt: { not: null } } } }],
    ...(q ? {
      AND: [{
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      }],
    } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where, select: { id: true, name: true, email: true, role: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take,
    }),
    prisma.user.count({ where }),
  ]);
  return { items: rows.map(labelUser), meta: meta({ page, limit, total }) };
}

/** One person, for the form's label once a user is picked (or on an existing profile). */
export async function linkableUser(id) {
  const row = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true, email: true, role: true } });
  if (!row) throw notFound('User');
  return labelUser(row);
}

const labelUser = (u) => ({ ...u, label: `${u.name} · ${u.role.charAt(0)}${u.role.slice(1).toLowerCase()}` });
