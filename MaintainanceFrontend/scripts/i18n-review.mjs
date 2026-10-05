#!/usr/bin/env node
/**
 * `npm run -s i18n:review > nepali-review.csv` — every Nepali word the system shows or sends, beside its English, for a
 * native speaker to read through (Phase J1). One row per text:
 *
 *   where, key, English, Nepali, placeholders
 *
 * - the UI catalogues, `src/config/i18n/*.js` (plain data, so Node imports them as they are);
 * - the customer messages, the API's seeded templates (`MaintainanceBackend/prisma/seed-data.js`);
 * - the seeded inspection checklists' question and option words.
 *
 * `{name}` / `{{name}}` are values filled in when shown or sent and must stay as they are. Written as UTF-8 with a BOM,
 * so Excel opens the Devanagari correctly. Nothing here changes a file.
 */
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOGUES = resolve(HERE, '../src/config/i18n');
const SEED = resolve(HERE, '../../MaintainanceBackend/prisma/seed-data.js');

const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];
const isPlural = (v) => v && typeof v === 'object' && 'other' in v && Object.keys(v).every((k) => PLURAL.includes(k));
const placeholders = (...texts) => [...new Set(texts.join(' ').match(/\{\{?\s*[\w.]+\s*\}?\}/g) ?? [])].join(' ');
const csv = (cells) => cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');

/** Every leaf of a catalogue tree: `[path, text]`, a plural's forms as `path (one)`, `path (other)`. */
function leaves(tree, prefix = '') {
  return Object.entries(tree ?? {}).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') return [[path, v]];
    if (isPlural(v)) return Object.entries(v).map(([form, text]) => [`${path} (${form})`, text]);
    return v && typeof v === 'object' ? leaves(v, path) : [];
  });
}

const rows = [['where', 'key', 'English', 'Nepali', 'placeholders']];

for (const file of readdirSync(CATALOGUES).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).sort()) {
  let mod;
  try {
    mod = await import(pathToFileURL(resolve(CATALOGUES, file)).href);
  } catch (err) {
    console.error(`skipped ${file}: ${err.message}`);
    continue;
  }
  for (const [name, catalogue] of Object.entries(mod)) {
    if (!catalogue?.en || !catalogue?.ne) continue;
    const ne = new Map(leaves(catalogue.ne));
    for (const [path, en] of leaves(catalogue.en)) {
      rows.push([`UI · ${name}`, path, en, ne.get(path) ?? '(missing)', placeholders(en, ne.get(path) ?? '')]);
    }
  }
}

try {
  const seed = await import(pathToFileURL(SEED).href);
  const templates = seed.MESSAGE_TEMPLATES ?? [];
  const nepali = templates.filter((t) => t.locale === 'ne');
  for (const ne of nepali) {
    const en = templates.find((t) => t.key === ne.key && t.channel === ne.channel && t.locale === 'en');
    if (ne.subject) rows.push([`Message · ${ne.channel}`, `${ne.key} (subject)`, en?.subject, ne.subject, placeholders(ne.subject)]);
    rows.push([`Message · ${ne.channel}`, ne.key, en?.body, ne.body, placeholders(ne.body)]);
  }
  for (const template of seed.INSPECTION_TEMPLATES ?? []) {
    for (const q of template.questions ?? []) {
      if (q.labelNe) rows.push([`Checklist · ${template.name}`, q.key, q.label, q.labelNe, '']);
      (q.optionsNe ?? []).forEach((word, i) => rows.push([`Checklist · ${template.name}`, `${q.key} option ${i + 1}`, q.options?.[i], word, '']));
    }
  }
} catch (err) {
  console.error(`skipped the API's seeded messages: ${err.message}`);
}

process.stdout.write(`﻿${rows.map(csv).join('\r\n')}\r\n`);
console.error(`${rows.length - 1} texts`);
