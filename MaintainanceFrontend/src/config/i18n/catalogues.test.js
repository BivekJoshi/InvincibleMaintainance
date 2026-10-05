import { describe, expect, it } from 'vitest';
import { describeCatalogue } from '@/helpers/i18n';

/**
 * Every catalogue in `config/i18n/` (Phase J1): English and Nepali have the same keys, each key the same kind of text
 * with the same placeholders and tags, and nothing but text in them. Then every literal key the code asks a translator
 * for exists — so a typo fails here, not as a key printed on a technician's phone.
 */

const modules = import.meta.glob('./*.js', { eager: true });
const CATALOGUES = Object.fromEntries(Object.entries(modules)
  .filter(([file]) => !file.endsWith('.test.js'))
  .flatMap(([file, mod]) => Object.entries(mod)
    .filter(([, value]) => value && typeof value === 'object' && value.en && value.ne)
    .map(([name, value]) => [name, { file: file.slice(2, -3), value }])));

const byPath = (tree) => new Map(describeCatalogue(tree).map((row) => [row.path, row]));

describe('the catalogues', () => {
  it('are found — one export per file, `{ en, ne }`', () => {
    expect(Object.keys(CATALOGUES)).toEqual(expect.arrayContaining(['COMMON', 'VALIDATION']));
  });

  describe.each(Object.entries(CATALOGUES))('%s', (name, { value }) => {
    const en = byPath(value.en);
    const ne = byPath(value.ne);

    it('has the same keys in English and Nepali', () => {
      expect([...ne.keys()].sort()).toEqual([...en.keys()].sort());
    });

    it('holds only text and plural forms — no functions, arrays or empty words', () => {
      for (const [locale, rows] of [['en', en], ['ne', ne]]) {
        for (const row of rows.values()) {
          expect(row.kind, `${name}.${locale}.${row.path}`).not.toBe('invalid');
          const texts = row.kind === 'text' ? [row.value] : Object.values(row.value);
          for (const text of texts) expect(text.trim(), `${name}.${locale}.${row.path} is empty`).not.toBe('');
          if (row.kind === 'plural') expect(Object.keys(row.value), `${name}.${locale}.${row.path}`).toEqual(expect.arrayContaining(['one', 'other']));
        }
      }
    });

    it('uses the same placeholders, tags and kind of text in both languages', () => {
      for (const [path, row] of en) {
        const other = ne.get(path);
        if (!other) continue;
        expect({ kind: other.kind, placeholders: other.placeholders, tags: other.tags }, `${name}.${path}`)
          .toEqual({ kind: row.kind, placeholders: row.placeholders, tags: row.tags });
      }
    });
  });
});

/**
 * The source scan. A file that imports a catalogue and binds a translator — `const t = useT(FIELD)`,
 * `const common = createT(COMMON, locale)` — may only ask that translator for keys the catalogue has. Keys built at run
 * time (`t(`status.${s}`)`) are skipped here; the screens' own tests cover those.
 */
const SOURCES = import.meta.glob(['/src/**/*.{js,jsx}', '!/src/**/*.test.{js,jsx}'], { query: '?raw', import: 'default', eager: true });

const IMPORT = /import\s*\{([^}]+)\}\s*from\s*'@\/config\/i18n\/(\w+)'/g;
const BINDING = /(?:const|let)\s+(\w+)\s*=\s*(?:useT|createT)\(\s*(\w+)/g;

function literalCalls(source, name) {
  const call = new RegExp(`(?<![\\w.])${name}(?:\\.rich|\\.has)?\\(\\s*(['"\`])([^'"\`$]+)\\1`, 'g');
  return [...source.matchAll(call)].map((m) => m[2]);
}

describe('keys the code asks for', () => {
  const problems = [];
  for (const [file, source] of Object.entries(SOURCES)) {
    const imported = new Set([...source.matchAll(IMPORT)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop())));
    if (!imported.size) continue;
    for (const [, variable, catalogueName] of source.matchAll(BINDING)) {
      const catalogue = CATALOGUES[catalogueName];
      if (!catalogue || !imported.has(catalogueName)) continue;
      const known = byPath(catalogue.value.en);
      for (const key of literalCalls(source, variable)) {
        if (!known.has(key)) problems.push(`${file}: ${variable}('${key}') — no such key in ${catalogueName}`);
      }
    }
  }

  it('exist in the catalogue the translator was made from', () => {
    expect(problems).toEqual([]);
  });
});
