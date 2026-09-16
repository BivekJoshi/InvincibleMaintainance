import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../utils/phone.js';

// ── SMS adapters ────────────────────────────────────────────────────────────

/** @typedef {{send(to:string, body:string):Promise<{id?:string}>}} SmsAdapter */

const consoleSms = {
  name: 'console',
  async send(to, body) {
    logger.info({ to, body }, '[SMS:console]');
    return { id: `console-${Date.now()}` };
  },
};

const sparrowSms = {
  name: 'sparrow',
  async send(to, body) {
    const res = await fetch('https://api.sparrowsms.com/v2/sms/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: env.sms.sparrowToken,
        from: env.sms.sparrowFrom,
        to: normalizePhone(to),
        text: body,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.response || `Sparrow SMS failed with ${res.status}`);
    return { id: String(json?.message_id ?? '') };
  },
};

const aakashSms = {
  name: 'aakash',
  async send(to, body) {
    const res = await fetch('https://sms.aakashsms.com/sms/v3/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_token: env.sms.aakashToken, to: normalizePhone(to), text: body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) throw new Error(json?.message || `Aakash SMS failed with ${res.status}`);
    return { id: String(json?.data?.id ?? '') };
  },
};

const SMS_ADAPTERS = { console: consoleSms, sparrow: sparrowSms, aakash: aakashSms };

function smsAdapter() {
  const chosen = SMS_ADAPTERS[env.sms.driver];
  if (!chosen) return consoleSms;
  if (chosen.name === 'sparrow' && !env.sms.sparrowToken) {
    logger.warn('SPARROW_TOKEN is not set — falling back to the console SMS adapter');
    return consoleSms;
  }
  if (chosen.name === 'aakash' && !env.sms.aakashToken) {
    logger.warn('AAKASH_TOKEN is not set — falling back to the console SMS adapter');
    return consoleSms;
  }
  return chosen;
}

// ── Email ───────────────────────────────────────────────────────────────────

let transporter = null;
function mailer() {
  if (transporter) return transporter;
  if (!env.mail.host) {
    transporter = {
      name: 'console',
      async sendMail({ to, subject, text }) {
        logger.info({ to, subject, text }, '[MAIL:console]');
        return { messageId: `console-${Date.now()}` };
      },
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transporter;
}

// ── Templates ───────────────────────────────────────────────────────────────

/** Replaces {{var}} placeholders. Missing variables render as an empty string. */
export function renderTemplate(body, vars = {}) {
  return String(body).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const value = key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), vars);
    return value == null ? '' : String(value);
  });
}

/**
 * The template for this language, else the English one, else none (the caller's
 * fallback text). A Nepali template missing is normal — they are added one by one —
 * and must never leave a customer without their message.
 */
export async function loadTemplate(key, channel, locale = 'en') {
  const find = (lang) => prisma.messageTemplate.findFirst({ where: { key, channel, locale: lang, isActive: true } });
  return (await find(locale)) ?? (locale === 'en' ? null : await find('en'));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sends a templated message and records it in MessageLog. Never throws into the
 * caller's request — delivery failures are logged and surfaced via MessageLog.
 *
 * A message to a customer or a lead passes `locale`: that record's `preferredLocale`.
 * Staff messages stay English (the back office is English — decision D7).
 * @param {{templateKey:string, channel:'sms'|'email'|'inapp', to:string, vars?:object,
 *          locale?:string, userId?:string, related?:{model:string,id:string},
 *          fallbackBody?:string, fallbackSubject?:string}} opts
 */
export async function notify(opts) {
  const { templateKey, channel, to, vars = {}, userId, related } = opts;
  const locale = opts.locale === 'ne' ? 'ne' : 'en';

  const tpl = await loadTemplate(templateKey, channel, locale);
  const body = renderTemplate(tpl?.body ?? opts.fallbackBody ?? '', vars);
  const subject = renderTemplate(tpl?.subject ?? opts.fallbackSubject ?? '', vars);

  if (!body) {
    logger.warn({ templateKey, channel }, 'no template body — message skipped');
    return null;
  }

  if (channel === 'inapp') {
    if (!userId) return null;
    return prisma.notification.create({
      data: { userId, type: templateKey, title: subject || templateKey, body, link: vars.link ?? null },
    });
  }

  const log = await prisma.messageLog.create({
    data: {
      channel, templateKey, toAddress: to, subject: subject || null, body,
      status: 'queued', relatedModel: related?.model ?? null, relatedId: related?.id ?? null,
    },
  });

  try {
    let providerId = null;
    let provider = null;
    if (channel === 'sms') {
      const adapter = smsAdapter();
      provider = adapter.name;
      ({ id: providerId } = await adapter.send(to, body));
    } else {
      const t = mailer();
      provider = t.name ?? 'smtp';
      const info = await t.sendMail({ from: env.mail.from, to, subject: subject || env.appName, text: body });
      providerId = info?.messageId ?? null;
    }
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: 'sent', provider, providerId },
    });
    return log;
  } catch (err) {
    logger.error({ err: err.message, channel, to, templateKey }, 'message delivery failed');
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err.message).slice(0, 900) },
    });
    return log;
  }
}

/** Fan-out helper: in-app notification to every user holding one of these roles. */
export async function notifyRoles(roles, { type, title, body, link }) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!users.length) return 0;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type, title, body: body ?? null, link: link ?? null })),
  });
  return users.length;
}
