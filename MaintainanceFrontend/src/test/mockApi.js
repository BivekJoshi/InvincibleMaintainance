import { vi } from 'vitest';

/**
 * RTK Query builds `new Request(url, { signal })`, and Node's Request rejects both a
 * relative URL and jsdom's AbortSignal, so tests stub it with this.
 */
export class TestRequest {
  constructor(url, init = {}) {
    this.url = String(url);
    this.method = (init.method ?? 'GET').toUpperCase();
    this.headers = new Headers(init.headers);
    this.body = init.body;
  }

  clone() {
    return this;
  }
}

/** A JSON response in the API's envelope shape (pass the whole body). */
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

/** A 404 in the API's error envelope. */
export const notFound = (what = 'Record') => json({ error: { code: 'NOT_FOUND', message: `${what} not found` } }, 404);

/** One page of a list, as `{ data, meta }`. */
export const page = (items) => json({ data: items, meta: { page: 1, limit: 20, total: items.length, pages: 1 } });

/**
 * Stubs `fetch` with `handler`, which gets `{ method, path, query, body }` (the path without
 * `/api/v1`, the body parsed from JSON) and returns a Response — or nothing, for `{ data: {} }`.
 * Returns the list of calls, in order. Undo with `vi.unstubAllGlobals()`.
 *
 * @param {(call: { method: string, path: string, query: Record<string, string>, body: any }) => Response|undefined|Promise<Response|undefined>} handler
 */
export function mockApi(handler) {
  const calls = [];
  vi.stubGlobal('Request', TestRequest);
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    const url = new URL(request.url, 'http://localhost');
    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* keep the text */ }
    }
    const call = {
      method: request.method,
      path: url.pathname.replace(/^\/api\/v1/, ''),
      query: Object.fromEntries(url.searchParams),
      body,
    };
    calls.push(call);
    return (await handler(call)) ?? json({ data: {} });
  }));
  return calls;
}
