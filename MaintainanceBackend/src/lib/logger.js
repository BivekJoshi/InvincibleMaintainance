import pino from 'pino';
import { env } from '../config/env.js';
import { getContext } from './requestContext.js';

/** Body and payload keys whose values never reach a log line, at any of the first three levels. */
const SECRET_KEYS = [
  'password', 'newPassword', 'currentPassword', 'token', 'refreshToken', 'accessToken', 'otp',
  'passwordHash', 'tokenHash', 'publicToken',
];

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SECRET_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
];

/** Keys that carry a phone number in what this app logs (SMS adapters, lead rows, delivery failures). */
const PHONE_KEYS = new Set(['phone', 'altPhone', 'to', 'toAddress', 'mobile', 'onCallPhone']);
const PHONE_SHAPE = /^\+?[\d\s()-]{7,20}$/;

/** "9841234567" → "******4567". Anything that is not phone-shaped (an email in `to`) passes through. */
export function maskPhone(value) {
  if (typeof value !== 'string' || !PHONE_SHAPE.test(value.trim())) return value;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 13 ? `******${digits.slice(-4)}` : value;
}

/** Copy-on-write, so a row that is logged and then returned to the client is never altered. */
function maskPhones(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 3) return obj;
  let out = obj;
  for (const [key, value] of Object.entries(obj)) {
    let next = value;
    if (PHONE_KEYS.has(key) && typeof value === 'string') next = maskPhone(value);
    else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) next = maskPhones(value, depth + 1);
    if (next !== value) {
      if (out === obj) out = { ...obj };
      out[key] = next;
    }
  }
  return out;
}

/** The customer links carry a bearer-equivalent token in the path. */
const PUBLIC_TOKEN_PATH = /(\/public\/(?:quotations|invoices|warranties)\/)[^/?#]+/g;
export const redactUrl = (url) => (typeof url === 'string' ? url.replace(PUBLIC_TOKEN_PATH, '$1[redacted]') : url);

export const serializers = {
  req: (req) => ({ ...req, url: redactUrl(req.url) }),
  err: pino.stdSerializers.err,
};

/**
 * @param {object} [opts]
 * @param {string} [opts.level]
 * @param {{ write(chunk: string): void }} [opts.destination]  a stream to write JSON lines to (tests)
 * @param {string|null} [opts.file]           LOG_FILE — adds a daily-rotating file target
 * @param {number} [opts.retentionDays]       LOG_RETENTION_DAYS — rotated files kept
 * @param {boolean} [opts.pretty]             pino-pretty on stdout (development)
 */
export function createLogger({
  level = env.logLevel,
  destination,
  file = env.logFile,
  retentionDays = env.logRetentionDays,
  pretty = !env.isProd,
} = {}) {
  const options = {
    level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers,
    // Every line carries the request it belongs to, so a service's log correlates with its request line.
    mixin() {
      const ctx = getContext();
      return ctx ? { requestId: ctx.requestId ?? undefined, userId: ctx.userId ?? undefined } : {};
    },
    formatters: { log: (obj) => maskPhones(obj) },
  };
  if (destination) return pino(options, destination);

  const stdout = pretty
    ? { target: 'pino-pretty', level, options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : { target: 'pino/file', level, options: { destination: 1 } };
  if (!file) return pretty ? pino(options, pino.transport({ targets: [stdout] })) : pino(options);

  return pino(options, pino.transport({
    targets: [
      stdout,
      {
        target: 'pino-roll',
        level,
        options: { file, frequency: 'daily', dateFormat: 'yyyy-MM-dd', mkdir: true, limit: { count: retentionDays } },
      },
    ],
  }));
}

export const logger = createLogger();
