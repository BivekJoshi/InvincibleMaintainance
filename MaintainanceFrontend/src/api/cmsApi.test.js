import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cmsApi } from '@/api/cmsApi';
import { publicApi } from '@/api/publicApi';
import { quotationsApi } from '@/api/quotationsApi';
import { makeStore, signedInAs } from '@/test/renderWithProviders';

/**
 * Store-level: real endpoints, real tag invalidation, fetch mocked. A query that an
 * invalidated tag covers is fetched again, so the GETs after a mutation are the tags
 * it invalidated.
 *
 * `Request` is stubbed as well: RTK Query builds `new Request(url, { signal })`, and
 * Node's Request rejects both a relative URL and jsdom's AbortSignal.
 */
class TestRequest {
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

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let calls;

beforeEach(() => {
  calls = [];
  vi.stubGlobal('Request', TestRequest);
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const path = pathname.replace(/^\/api\/v1/, '');
    calls.push({ method: request.method, path, body: request.body });
    if (request.method === 'DELETE' || path.endsWith('/reorder')) return new Response(null, { status: 204 });
    if (request.method === 'POST') return json({ data: { id: 'f2' } }, 201);
    if (request.method !== 'GET') return json({ data: { id: path.split('/')[3], isActive: false } });
    if (path === '/admin/home-sections') return json({ data: [{ key: 'hero', sortOrder: 0, isVisible: true }] });
    if (path === '/admin/faqs' || path === '/admin/process-steps' || path === '/admin/rate-card') {
      return json({ data: [{ id: 'f1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
    }
    if (path === '/public/bootstrap') return json({ data: { settings: {} } });
    return json({ data: { id: path.split('/').pop() } });
  }));
});

afterEach(() => vi.unstubAllGlobals());

/** A store with the FAQ list, FAQ f1, the process-steps list and the site's bootstrap all cached and subscribed. */
async function primedStore() {
  const store = makeStore(signedInAs('EDITOR'));
  await Promise.all([
    store.dispatch(cmsApi.endpoints.listResource.initiate({ resource: 'faqs', params: { limit: 20 } })),
    store.dispatch(cmsApi.endpoints.getResource.initiate({ resource: 'faqs', id: 'f1' })),
    store.dispatch(cmsApi.endpoints.listResource.initiate({ resource: 'process-steps', params: {} })),
    store.dispatch(publicApi.endpoints.getBootstrap.initiate('en')),
  ]);
  calls.length = 0;
  return store;
}

/** The GETs made once the invalidation has settled, sorted. */
async function refetched() {
  await new Promise((resolve) => { setTimeout(resolve, 30); });
  return calls.filter((c) => c.method === 'GET').map((c) => c.path).sort();
}

describe('cmsApi', () => {
  it('builds the factory URLs for a resource', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.toggleResource.initiate({ resource: 'faqs', id: 'f1' })).unwrap();
    await store.dispatch(cmsApi.endpoints.restoreResource.initiate({ resource: 'faqs', id: 'f1' })).unwrap();
    await store.dispatch(cmsApi.endpoints.reorderResource.initiate({ resource: 'faqs', items: [{ id: 'f1', sortOrder: 0 }] })).unwrap();
    await store.dispatch(cmsApi.endpoints.deleteResource.initiate({ resource: 'faqs', id: 'f1', hard: true })).unwrap();

    const writes = calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH /admin/faqs/f1/toggle',
      'PATCH /admin/faqs/f1/restore',
      'PATCH /admin/faqs/reorder',
      'DELETE /admin/faqs/f1',
    ]);
    expect(JSON.parse(writes[2].body)).toEqual({ items: [{ id: 'f1', sortOrder: 0 }] });
    expect(calls.find((c) => c.method === 'DELETE')).toBeTruthy();
  });

  it('create refetches that resource’s list and the site — not a record, not another resource', async () => {
    const store = await primedStore();
    const created = await store.dispatch(cmsApi.endpoints.createResource.initiate({ resource: 'faqs', body: { question: 'New?' } })).unwrap();
    expect(created).toEqual({ id: 'f2' });
    expect(await refetched()).toEqual(['/admin/faqs', '/public/bootstrap']);
  });

  it('update refetches the list and that record', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.updateResource.initiate({ resource: 'faqs', id: 'f1', body: { question: 'Changed?' } })).unwrap();
    expect(await refetched()).toEqual(['/admin/faqs', '/admin/faqs/f1', '/public/bootstrap']);
  });

  it('update of another record leaves the cached record alone', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.updateResource.initiate({ resource: 'faqs', id: 'f9', body: { question: 'Other?' } })).unwrap();
    expect(await refetched()).toEqual(['/admin/faqs', '/public/bootstrap']);
  });

  it('delete refetches the list and that record', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.deleteResource.initiate({ resource: 'faqs', id: 'f1' })).unwrap();
    expect(await refetched()).toEqual(['/admin/faqs', '/admin/faqs/f1', '/public/bootstrap']);
  });

  it('reorder refetches only the list', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.reorderResource.initiate({ resource: 'faqs', items: [{ id: 'f1', sortOrder: 3 }] })).unwrap();
    expect(await refetched()).toEqual(['/admin/faqs', '/public/bootstrap']);
  });

  it('a rate card write also refetches the quotation builder’s rate card; an FAQ write does not', async () => {
    const store = await primedStore();
    await store.dispatch(quotationsApi.endpoints.getRateCard.initiate({ limit: 100 }));
    calls.length = 0;
    await store.dispatch(cmsApi.endpoints.updateResource.initiate({ resource: 'rate-card', id: 'r1', body: { rate: 12 } })).unwrap();
    expect(calls.find((c) => c.method === 'PUT').path).toBe('/admin/rate-card/r1');
    expect(await refetched()).toEqual(['/admin/rate-card', '/public/bootstrap']);

    calls.length = 0;
    await store.dispatch(cmsApi.endpoints.updateResource.initiate({ resource: 'faqs', id: 'f1', body: {} })).unwrap();
    expect(await refetched()).not.toContain('/admin/rate-card');
  });

  it('saving the home page sends every section and refetches the composer and the site', async () => {
    const store = await primedStore();
    await store.dispatch(cmsApi.endpoints.getHomeSections.initiate());
    calls.length = 0;
    const items = [{ key: 'hero', sortOrder: 0, isVisible: false }];
    await store.dispatch(cmsApi.endpoints.updateHomeSections.initiate(items)).unwrap();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.path).toBe('/admin/home-sections');
    expect(JSON.parse(put.body)).toEqual({ items });
    expect(await refetched()).toEqual(['/admin/home-sections', '/public/bootstrap']);
  });
});
