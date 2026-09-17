import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheInvalidate } from './cache.service.js';
import { recordEvent } from './audit.service.js';

const CACHE_KEY = 'settings:all';

/** @returns {Promise<Record<string, any>>} flat key -> value map */
export async function allSettings() {
  const hit = await cacheGet(CACHE_KEY);
  if (hit) return hit;
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  await cacheSet(CACHE_KEY, map, 300, ['settings']);
  return map;
}

export async function getSetting(key, fallback = null) {
  const all = await allSettings();
  return all[key] ?? fallback;
}

export async function groupedSettings() {
  const rows = await prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] });
  return rows.reduce((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});
}

export async function updateSettings(values) {
  const keys = Object.keys(values);
  if (!keys.length) return allSettings();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
    const old = Object.fromEntries(existing.map((r) => [r.key, r.value]));
    for (const key of keys) {
      await tx.setting.upsert({
        where: { key },
        create: { key, group: 'custom', label: key, value: values[key] },
        update: { value: values[key] },
      });
    }
    // One event for the whole save, listing only the keys whose value actually moved.
    const changed = keys.filter((k) => JSON.stringify(old[k] ?? null) !== JSON.stringify(values[k] ?? null));
    if (changed.length) {
      await recordEvent('settings.changed', {
        model: 'Setting',
        before: Object.fromEntries(changed.map((k) => [k, old[k] ?? null])),
        after: Object.fromEntries(changed.map((k) => [k, values[k] ?? null])),
        meta: { keys: changed },
      }, tx);
    }
  });
  await cacheInvalidate('settings', 'public');
  return allSettings();
}
