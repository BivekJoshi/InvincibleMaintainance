import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheInvalidate } from './cache.service.js';

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
  await prisma.$transaction(
    keys.map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, group: 'custom', label: key, value: values[key] },
        update: { value: values[key] },
      }),
    ),
  );
  await cacheInvalidate('settings', 'public');
  return allSettings();
}
