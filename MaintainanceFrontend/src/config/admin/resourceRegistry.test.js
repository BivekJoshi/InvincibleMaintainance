import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import { RESOURCES, getResourceEntry, screenPathOf } from '@/config/admin/resourceRegistry';
import { ADMIN_NAV, BESPOKE_CONTENT } from '@/config/admin/adminNav';
import { flattenFields } from '@/components/common/ResourceForm/formValues';
import { PERMISSIONS } from '@/helpers/permissions';

/** The resources the API's CRUD factory mounts, read from the route files themselves (tests run from MaintainanceFrontend/). */
const readApi = (file) => readFileSync(resolve(cwd(), '../MaintainanceBackend/src/routes/admin', file), 'utf8');
const cmsRoutes = readApi('cms.routes.js');
const MOUNTED = new Set([...cmsRoutes.matchAll(/mountResource\(router, '([a-z-]+)'/g)].map((m) => m[1]));

/**
 * The same eight endpoints, mounted by hand outside cms.routes.js (the rate card). Each
 * must answer every call the generic screens make.
 */
const HAND_MOUNTED = { 'rate-card': readApi('crm.routes.js') };
const GENERIC_CALLS = (r) => [
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

const contentItems = ADMIN_NAV.find((g) => g.key === 'content').items;
const allItems = ADMIN_NAV.flatMap((g) => g.items);
const entries = Object.values(RESOURCES);

describe('resource registry', () => {
  it('reads the mounted CMS resources from the API', () => {
    expect(MOUNTED.has('faqs')).toBe(true);
    expect(MOUNTED.size).toBeGreaterThan(10);
  });

  it.each(entries.map((e) => [e.resource, e]))('%s is a complete, valid entry', (resource, entry) => {
    expect(resource).toMatch(/^[a-z][a-z-]*$/);
    expect(entry.path).toBe(`/admin/${resource}`);
    expect(isMounted(resource), `${resource} is not mounted with all eight endpoints`).toBe(true);
    expect(getResourceEntry(resource)).toBe(entry);

    expect(CAPABILITIES.has(entry.capability), `unknown capability ${entry.capability}`).toBe(true);
    expect(CAPABILITIES.has(entry.writeCapability ?? 'cms:write')).toBe(true);
    expect(entry.model).toMatch(/^[a-z][A-Za-z]*$/);
    expect(entry.label).toBeTruthy();
    expect(entry.labelPlural).toBeTruthy();
    expect(typeof entry.titleOf).toBe('function');
    expect(typeof entry.sortable).toBe('boolean');

    expect(typeof entry.schema?.safeParse).toBe('function');
    const shape = shapeOf(entry.schema);
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

  it('has an entry behind every built Content nav item', () => {
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
