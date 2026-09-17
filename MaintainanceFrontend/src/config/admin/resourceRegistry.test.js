import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import { RESOURCES, getResourceEntry, schemaOf, screenPathOf } from '@/config/admin/resourceRegistry';
import { cmsApi } from '@/api/cmsApi';
import { ADMIN_NAV, BESPOKE_CONTENT } from '@/config/admin/adminNav';
import { flattenFields } from '@/components/common/ResourceForm/formValues';
import { PERMISSIONS } from '@/helpers/permissions';

/** The resources the API's CRUD factory mounts, read from the route files themselves (tests run from MaintainanceFrontend/). */
const readApi = (file) => readFileSync(resolve(cwd(), '../MaintainanceBackend/src/routes/admin', file), 'utf8');
const mounter = readApi('mountResource.js');
/** Every file that mounts registry resources through `mountResource` (content, and operations since H1). */
const MOUNTING_FILES = ['cms.routes.js', 'ops.routes.js'].map(readApi);
const MOUNTED = new Set(MOUNTING_FILES.flatMap((src) => [...src.matchAll(/mountResource\(router, '([a-z-]+)'/g)].map((m) => m[1])));

/**
 * The same endpoints, mounted by hand outside cms.routes.js (the rate card): the eight the
 * generic screens call, plus the History tab's. Each must answer every call the screens make.
 */
const HAND_MOUNTED = { 'rate-card': readApi('crm.routes.js') };
const GENERIC_CALLS = (r) => [
  `router.get('/${r}/:id/history'`,
  `router.get('/${r}'`, `router.post('/${r}'`, `router.patch('/${r}/reorder'`, `router.get('/${r}/:id'`,
  `router.put('/${r}/:id'`, `router.patch('/${r}/:id/toggle'`, `router.patch('/${r}/:id/restore'`, `router.delete('/${r}/:id'`,
];
const isMounted = (r) => MOUNTED.has(r) || Boolean(HAND_MOUNTED[r] && GENERIC_CALLS(r).every((c) => HAND_MOUNTED[r].includes(c)));

const CAPABILITIES = new Set([...Object.values(PERMISSIONS).flat(), 'cms:purge']);
const TEXT_TYPES = new Set(['text', 'textarea', 'prose', 'markdown']);

/** The object schema under any `.refine()` wrappers. */
function shapeOf(schema) {
  let s = schema;
  while (s && !s.shape && s._def?.schema) s = s._def.schema;
  return s?.shape;
}

const allItems = ADMIN_NAV.flatMap((g) => g.items);
/** Every screen under /admin/content, whichever group lists it (Content, Page blocks, Blog & pages). */
const contentItems = allItems.filter((i) => i.to.startsWith('/admin/content'));
const entries = Object.values(RESOURCES);

describe('resource registry', () => {
  it('reads the mounted CMS resources from the API', () => {
    expect(MOUNTED.has('faqs')).toBe(true);
    expect(MOUNTED.size).toBeGreaterThan(10);
    // The shared mounter gives every resource its History endpoint.
    expect(mounter).toContain('router.get(`/${path}/:id/history`');
  });

  it.each(entries.map((e) => [e.resource, e]))('%s is a complete, valid entry', (resource, entry) => {
    expect(resource).toMatch(/^[a-z][a-z-]*$/);
    expect(entry.path).toBe(`/admin/${resource}`);
    expect(isMounted(resource), `${resource} is not mounted with all eight endpoints`).toBe(true);
    expect(getResourceEntry(resource)).toBe(entry);

    expect(CAPABILITIES.has(entry.capability), `unknown capability ${entry.capability}`).toBe(true);
    expect(CAPABILITIES.has(entry.writeCapability ?? 'cms:write')).toBe(true);
    if (entry.historyCapability) expect(CAPABILITIES.has(entry.historyCapability), `unknown ${entry.historyCapability}`).toBe(true);
    expect(entry.model).toMatch(/^[a-z][A-Za-z]*$/);
    expect(entry.label).toBeTruthy();
    expect(entry.labelPlural).toBeTruthy();
    expect(typeof entry.titleOf).toBe('function');
    expect(typeof entry.sortable).toBe('boolean');

    const schema = schemaOf(entry, { pageSlugs: ['about'] });
    expect(typeof schema?.safeParse).toBe('function');
    const shape = shapeOf(schema);
    expect(shape).toBeTruthy();

    expect(entry.columns.length).toBeGreaterThan(0);
    for (const col of entry.columns) {
      expect(col.key).toBeTruthy();
      expect(col.header).toBeTruthy();
    }

    const fields = flattenFields(entry.fields);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(shape, `field ${field.name} is not in the schema`).toHaveProperty(field.name);
    }
    for (const name of entry.translatable ?? []) {
      const field = fields.find((f) => f.name === name);
      expect(field, `translatable ${name} is not a field`).toBeTruthy();
      expect(TEXT_TYPES.has(field.type)).toBe(true);
    }
    for (const filter of entry.filters ?? []) {
      expect(['enum', 'boolean', 'relation', 'dateRange']).toContain(filter.type);
      if (filter.defaultValue != null) expect(filter.options.map((o) => o.value)).toContain(filter.defaultValue);
    }
    if (entry.reorderWithin) {
      expect(entry.sortable).toBe(true);
      expect(entry.filters.map((f) => f.key)).toContain(entry.reorderWithin);
      expect(entry.reorderHint).toBeTruthy();
    }
    for (const field of fields.filter((f) => f.lockedOnEdit)) expect(field.disabled).toBeFalsy();
    for (const tab of entry.tabs ?? []) {
      expect(tab.value).toMatch(/^[a-z-]+$/);
      expect(['en', 'ne']).not.toContain(tab.value);
      expect(typeof tab.component).toBe('function');
    }
  });

  it('points every extra row action at a cmsApi mutation and a known capability', () => {
    const sample = { id: 'x', isApproved: false, isActive: true };
    for (const entry of entries.filter((e) => e.rowActions)) {
      for (const row of [sample, { ...sample, isApproved: true }]) {
        for (const action of entry.rowActions(row)) {
          expect(cmsApi.endpoints[action.endpoint], `${entry.resource}: ${action.endpoint}`).toBeTruthy();
          expect(action.label && action.done).toBeTruthy();
          if (action.capability) expect(CAPABILITIES.has(action.capability)).toBe(true);
        }
      }
    }
  });

  it('gives every entry a built nav item at its screen path with the same capability', () => {
    for (const entry of entries) {
      const item = allItems.find((i) => i.to === screenPathOf(entry));
      expect(item, `no nav item for ${entry.resource}`).toBeTruthy();
      expect(item.soon).toBeFalsy();
      expect(item.capability).toBe(entry.capability);
    }
  });

  it('has an entry behind every built content nav item, in any group', () => {
    for (const item of contentItems.filter((i) => !i.soon && i.to.startsWith('/admin/content/'))) {
      if (BESPOKE_CONTENT.includes(item.to)) continue;
      const entry = getResourceEntry(item.to.split('/')[3]);
      expect(entry, `no registry entry for ${item.to}`).toBeTruthy();
      expect(screenPathOf(entry)).toBe(item.to);
    }
  });

  it('keeps entries with their own address out of Content, and bespoke pages out of the registry', () => {
    expect(screenPathOf(RESOURCES['rate-card'])).toBe('/admin/rate-card');
    for (const path of BESPOKE_CONTENT) expect(getResourceEntry(path.split('/')[3])).toBeUndefined();
  });

  it('offers only icons the site can draw', async () => {
    const { ICON_NAMES } = await import('@/components/site/DataIcon');
    for (const entry of entries) {
      const icon = flattenFields(entry.fields).find((f) => f.name === 'icon');
      if (!icon) continue;
      expect(icon.type, `${entry.resource} icon is not a picker`).toBe('select');
      expect(icon.options.map((o) => o.value)).toEqual(ICON_NAMES);
    }
  });

  it('does not resolve inherited object keys as resources', () => {
    expect(getResourceEntry('constructor')).toBeUndefined();
    expect(getResourceEntry('toString')).toBeUndefined();
    expect(getResourceEntry(undefined)).toBeUndefined();
  });
});
