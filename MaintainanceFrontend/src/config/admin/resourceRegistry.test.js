import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import { RESOURCES, getResourceEntry } from '@/config/admin/resourceRegistry';
import { ADMIN_NAV } from '@/config/admin/adminNav';
import { flattenFields } from '@/components/common/ResourceForm/formValues';
import { PERMISSIONS } from '@/helpers/permissions';

/** The resources the API's CRUD factory mounts, read from the route file itself (tests run from MaintainanceFrontend/). */
const cmsRoutes = readFileSync(resolve(cwd(),'../MaintainanceBackend/src/routes/admin/cms.routes.js'), 'utf8');
const MOUNTED = new Set([...cmsRoutes.matchAll(/mountResource\(router, '([a-z-]+)'/g)].map((m) => m[1]));

const CAPABILITIES = new Set([...Object.values(PERMISSIONS).flat(), 'cms:purge']);
const TEXT_TYPES = new Set(['text', 'textarea', 'prose', 'markdown']);

/** The object schema under any `.refine()` wrappers. */
function shapeOf(schema) {
  let s = schema;
  while (s && !s.shape && s._def?.schema) s = s._def.schema;
  return s?.shape;
}

const contentItems = ADMIN_NAV.find((g) => g.key === 'content').items;
const entries = Object.values(RESOURCES);

describe('resource registry', () => {
  it('reads the mounted CMS resources from the API', () => {
    expect(MOUNTED.has('faqs')).toBe(true);
    expect(MOUNTED.size).toBeGreaterThan(10);
  });

  it.each(entries.map((e) => [e.resource, e]))('%s is a complete, valid entry', (resource, entry) => {
    expect(resource).toMatch(/^[a-z][a-z-]*$/);
    expect(entry.path).toBe(`/admin/${resource}`);
    expect(MOUNTED.has(resource), `${resource} is not mounted in cms.routes.js`).toBe(true);
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

  it('gives every entry a built Content nav item with the same capability', () => {
    for (const entry of entries) {
      const item = contentItems.find((i) => i.to === `/admin/content/${entry.resource}`);
      expect(item, `no nav item for ${entry.resource}`).toBeTruthy();
      expect(item.soon).toBeFalsy();
      expect(item.capability).toBe(entry.capability);
    }
  });

  it('has an entry behind every built Content nav item', () => {
    for (const item of contentItems.filter((i) => !i.soon && i.to.startsWith('/admin/content/'))) {
      expect(getResourceEntry(item.to.split('/')[3]), `no registry entry for ${item.to}`).toBeTruthy();
    }
  });

  it('does not resolve inherited object keys as resources', () => {
    expect(getResourceEntry('constructor')).toBeUndefined();
    expect(getResourceEntry('toString')).toBeUndefined();
    expect(getResourceEntry(undefined)).toBeUndefined();
  });
});
