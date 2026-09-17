import { prisma } from '../lib/prisma.js';
import { maskPhone } from '../lib/logger.js';
import { notFound, AppError } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { makeCrud } from './crud.service.js';
import { recordEvent } from './audit.service.js';
import { deliver, previewTemplate, REDACTED_TEXT } from './notify.service.js';

// ── templates

/** One row per key × channel × language. No soft delete and no manual order. */
export const templates = makeCrud({
  model: 'messageTemplate',
  label: 'Message template',
  searchFields: ['key', 'subject', 'body'],
  softDelete: false,
  sortable: false,
  defaultSort: 'key',
  filter: (q) => ({
    ...(q.key ? { key: q.key } : {}),
    ...(q.channel ? { channel: q.channel } : {}),
    ...(q.locale ? { locale: q.locale } : {}),
  }),
});

/**
 * The templates grouped by key, a page of keys at a time: the editor lists a message
 * once, with the language and channel variants it has.
 *
 * @param {{ page?: number, limit?: number, q?: string, channel?: string }} query  validated
 */
export async function templateGroups(query) {
  const { page, limit, skip, take, q } = parseListQuery(query);
  const where = {
    ...(q ? { OR: [{ key: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}),
    ...(query.channel ? { channel: query.channel } : {}),
  };
  const keys = await prisma.messageTemplate.findMany({ where, distinct: ['key'], select: { key: true }, orderBy: { key: 'asc' } });
  const pageKeys = keys.slice(skip, skip + take).map((k) => k.key);
  const rows = pageKeys.length
    ? await prisma.messageTemplate.findMany({
      where: { key: { in: pageKeys } },
      select: { id: true, key: true, channel: true, locale: true, subject: true, isActive: true, updatedAt: true },
      orderBy: [{ channel: 'asc' }, { locale: 'asc' }],
    })
    : [];
  const items = pageKeys.map((key) => ({
    key,
    variants: rows.filter((r) => r.key === key).map(({ key: _key, ...variant }) => variant),
  }));
  return { items, meta: meta({ page, limit, total: keys.length }) };
}

/**
 * A template rendered with sample vars. Unsaved `subject` / `body` win over the stored
 * ones, so the editor previews what is being typed.
 *
 * @param {string|null} id  a saved template, or null for text that is not saved yet
 * @param {{ vars?: object, subject?: string, body?: string }} input
 */
export async function previewMessageTemplate(id, { vars = {}, subject, body }) {
  const saved = id ? await templates.get(id) : null;
  return previewTemplate({
    subject: subject !== undefined ? subject : saved?.subject,
    body: body !== undefined ? body : saved?.body,
  }, vars);
}

// ── delivery logs

/**
 * The address a delivery went to, as the log screen shows it: a phone keeps its last
 * four digits, an email its first two letters and its domain.
 */
export function maskAddress(value) {
  if (!value) return value;
  const at = value.indexOf('@');
  if (at > 0) return `${value.slice(0, Math.min(2, at))}***${value.slice(at)}`;
  const masked = maskPhone(value);
  return masked === value ? `***${value.slice(-4)}` : masked;
}

/** A link's `token=` value, in rows logged before messages kept their secrets out. */
const TOKEN_IN_TEXT = /([?&]token=)[^&\s]+/g;
const scrub = (text) => (text ? text.replace(TOKEN_IN_TEXT, `$1${REDACTED_TEXT}`) : text);

const toLogEntry = (row) => ({
  ...row,
  toAddress: maskAddress(row.toAddress),
  subject: scrub(row.subject),
  body: scrub(row.body),
});

/** @param {object} query  validated by `messageLogQuery` */
export async function listMessageLogs(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const where = {
    ...(query.channel ? { channel: query.channel } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.templateKey ? { templateKey: query.templateKey } : {}),
    ...(query.relatedModel ? { relatedModel: query.relatedModel } : {}),
    ...(query.relatedId ? { relatedId: query.relatedId } : {}),
    ...(created ? { createdAt: created } : {}),
    // The address is searched as stored; the answer shows it masked.
    ...(q ? { toAddress: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.messageLog.findMany({ where, orderBy: [orderBy, { id: 'desc' }], skip, take }),
    prisma.messageLog.count({ where }),
  ]);
  return { items: items.map(toLogEntry), meta: meta({ page, limit, total }) };
}

/**
 * Sends a failed message again, from what its log kept, and records who asked. A message
 * whose log had a secret taken out (a password link) cannot be rebuilt: the person asks
 * for a new link instead.
 */
export async function retryMessage(id) {
  const log = await prisma.messageLog.findUnique({ where: { id } });
  if (!log) throw notFound('Message');
  if (log.status !== 'failed') {
    throw new AppError(422, 'NOT_RETRYABLE', 'Only a failed message can be sent again');
  }
  if (log.body.includes(REDACTED_TEXT) || log.subject?.includes(REDACTED_TEXT)) {
    throw new AppError(422, 'NOT_RETRYABLE', 'This message carried a one-time link, which is not kept. Send a new link instead.');
  }
  // Claimed first, so two retries of the same message send it once.
  const { count } = await prisma.messageLog.updateMany({ where: { id, status: 'failed' }, data: { status: 'queued' } });
  if (!count) throw new AppError(422, 'NOT_RETRYABLE', 'Only a failed message can be sent again');

  const result = await deliver(log, { subject: log.subject, body: log.body });
  await recordEvent('message.retried', {
    model: 'MessageLog',
    recordId: id,
    before: { status: log.status, error: log.error },
    after: { status: result.status, ...(result.error ? { error: result.error } : {}) },
    meta: { channel: log.channel, templateKey: log.templateKey },
  });
  return toLogEntry(result);
}
