import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Who and what a piece of work belongs to, carried across every await without
 * being passed by hand. The logger mixin, the audit extension and recordEvent
 * all read it.
 *
 * @typedef {object} RequestContext
 * @property {string|null} requestId  the X-Request-Id, or `<task>:<job id>` for background work
 * @property {string|null} userId
 * @property {string|null} role
 * @property {string|null} ip
 * @property {string|null} userAgent
 * @property {'user'|'public'|'system'} actorType
 */

const storage = new AsyncLocalStorage();

/** Accepted shape for an incoming X-Request-Id; anything else is replaced, so it can never inject into a log line. */
export const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

export const isValidRequestId = (id) => typeof id === 'string' && REQUEST_ID_RE.test(id);

/**
 * Runs `fn` with a fresh context. Missing fields default to a system actor.
 * @template T
 * @param {Partial<RequestContext>} context
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithContext(context, fn) {
  return storage.run({ requestId: null, userId: null, role: null, ip: null, userAgent: null, actorType: 'system', ...context }, fn);
}

/** @returns {RequestContext|undefined} */
export const getContext = () => storage.getStore();

/**
 * Fills in the current context — authenticate does this once it knows the user.
 * Outside a context it does nothing.
 * @param {Partial<RequestContext>} patch
 */
export function setContext(patch) {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
  return store;
}
