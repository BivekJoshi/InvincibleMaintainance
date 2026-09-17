import { env } from '../config/env.js';

/**
 * Error reporting. Entirely optional: with no SENTRY_DSN nothing is imported and
 * every call is a no-op, so development and tests never load the SDK.
 */

let sentry = null;

/** Loads and starts @sentry/node when SENTRY_DSN is set. Safe to call more than once. */
export async function initSentry({ dsn = env.sentryDsn, environment = env.nodeEnv } = {}) {
  if (!dsn || sentry) return sentry;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // server.js and worker.js report these themselves, tagged, then exit — so the
    // SDK's own process handlers would only double-report.
    integrations: (defaults) => defaults.filter((i) => !['OnUncaughtException', 'OnUnhandledRejection'].includes(i.name)),
  });
  sentry = Sentry;
  return sentry;
}

/**
 * @param {unknown} err
 * @param {{ requestId?: string|null, [key: string]: unknown }} [context]
 */
export function captureException(err, { requestId, ...extra } = {}) {
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId);
    scope.setExtras(extra);
    sentry.captureException(err);
  });
}

/** Waits for queued reports to leave before the process exits. */
export async function flushSentry(timeoutMs = 2000) {
  if (sentry) await sentry.flush(timeoutMs).catch(() => {});
}
