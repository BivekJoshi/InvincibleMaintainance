import { createElement, Fragment } from 'react';
import { IS_DEV } from '@/config/env';
import { formatNumber } from '@/helpers/format';

/**
 * The UI's words in English and Nepali (Phase J1) — a small `t()` over plain catalogues, no library.
 *
 * A **catalogue** is `{ en: tree, ne: tree }`, one file per audience in `config/i18n/` (`field.js`, `site.js`,
 * `documents.js`, `validation.js`, `common.js`), imported by the code that shows it — so the marketing bundle never
 * carries the field app's words. A tree nests plain objects; every **leaf** is either
 * - a string, with `{name}` placeholders: `'Sync {count} changes'`, or
 * - plural forms, picked by `vars.count`: `{ one: '{count} photo', other: '{count} photos' }` — the categories of
 *   `Intl.PluralRules` (English and Nepali use `one` and `other`), plus an optional `zero` for a count of 0.
 * Nothing else: no functions, no arrays, so a catalogue is data a translator can review (`npm run i18n:review`).
 *
 * `t('sync.waiting', { count: 3 })` looks the key up in the locale's tree, falls back to English when Nepali has no
 * text (warning once in development), and to the key itself when neither has it. A number in `vars` is printed the
 * locale's way (`formatNumber` — lakh grouping, the locale's digits); pass a string to print it as it is (a job number,
 * a year). `t.rich()` fills `<tag>…</tag>` spans with React elements, for a link inside a sentence.
 */

const PLACEHOLDER = /\{(\w+)\}/g;
const RICH_TAG = /<(\w+)>(.*?)<\/\1>/g;
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** Is `value` a set of plural forms — only plural categories as keys, `other` among them, every form a string? */
export function isPluralForms(value) {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.includes('other') && keys.every((k) => PLURAL_CATEGORIES.includes(k) && typeof value[k] === 'string');
}

const isLeaf = (value) => typeof value === 'string' || isPluralForms(value);

/** The value at a dot path of a tree, or undefined. */
export function lookup(tree, key) {
  let node = tree;
  for (const part of String(key).split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

const warned = new Set();

function warnOnce(message) {
  if (!IS_DEV || warned.has(message)) return;
  warned.add(message);
  console.warn(`[i18n] ${message}`);
}

/** Forgets which warnings were printed — for a test that counts them. */
export const resetI18nWarnings = () => warned.clear();

/** The leaf for `key` in `locale`, English when that locale has none; undefined when neither has it. */
function resolve(catalogue, locale, key) {
  const own = lookup(catalogue?.[locale], key);
  if (isLeaf(own)) return own;
  if (locale !== 'en') {
    warnOnce(`missing ${locale} text for "${key}"`);
    const english = lookup(catalogue?.en, key);
    if (isLeaf(english)) return english;
  }
  warnOnce(`missing text for "${key}"`);
  return undefined;
}

const rulesByLocale = new Map();
const pluralRules = (locale) => {
  if (!rulesByLocale.has(locale)) rulesByLocale.set(locale, new Intl.PluralRules(locale));
  return rulesByLocale.get(locale);
};

/** The form of `forms` for `count` in `locale` — `zero` for 0 when there is one, else the Intl category, else `other`. */
export function selectPlural(forms, count, locale = 'en') {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    warnOnce('a plural text was used without a numeric "count"');
    return forms.other;
  }
  if (count === 0 && forms.zero != null) return forms.zero;
  return forms[pluralRules(locale).select(count)] ?? forms.other;
}

const printVar = (value, locale) => {
  if (typeof value === 'number') return formatNumber(value, { locale });
  return value == null ? '' : String(value);
};

/** `template` with each `{name}` replaced by `vars.name`; a name with no value prints nothing (and warns in development). */
export function interpolate(template, vars = {}, locale = 'en') {
  return template.replace(PLACEHOLDER, (_whole, name) => {
    if (!(name in vars)) {
      warnOnce(`no value for {${name}} in "${template}"`);
      return '';
    }
    return printVar(vars[name], locale);
  });
}

/**
 * A bound translator for one catalogue and locale.
 *
 * @param {{ en: object, ne?: object }} catalogue
 * @param {'en'|'ne'} [locale]
 * @returns {((key: string, vars?: object) => string) & {
 *   locale: 'en'|'ne',
 *   has: (key: string) => boolean,
 *   rich: (key: string, vars?: object, components?: Record<string, (children: string) => import('react').ReactNode>) => import('react').ReactNode,
 * }}
 */
export function createT(catalogue, locale = 'en') {
  const template = (key, vars) => {
    const leaf = resolve(catalogue, locale, key);
    if (leaf === undefined) return undefined;
    return typeof leaf === 'string' ? leaf : selectPlural(leaf, vars?.count, locale);
  };

  const t = (key, vars = {}) => {
    const text = template(key, vars);
    return text === undefined ? key : interpolate(text, vars, locale);
  };

  t.locale = locale;
  t.has = (key) => isLeaf(lookup(catalogue?.[locale], key)) || isLeaf(lookup(catalogue?.en, key));

  /**
   * The text as React nodes, each `<name>…</name>` span rendered by `components.name(children)` — the tags are
   * found before the values go in, so a customer's name can never become markup.
   */
  t.rich = (key, vars = {}, components = {}) => {
    const text = template(key, vars);
    if (text === undefined) return key;
    const nodes = [];
    let last = 0;
    for (const match of text.matchAll(RICH_TAG)) {
      const [whole, name, inner] = match;
      if (match.index > last) nodes.push(interpolate(text.slice(last, match.index), vars, locale));
      const render = components[name];
      const children = interpolate(inner, vars, locale);
      nodes.push(render ? render(children) : children);
      last = match.index + whole.length;
    }
    if (last < text.length) nodes.push(interpolate(text.slice(last), vars, locale));
    return createElement(Fragment, null, ...nodes.map((node, i) => (
      typeof node === 'string' ? node : createElement(Fragment, { key: i }, node)
    )));
  };

  return t;
}

/**
 * Every leaf of a tree as `{ path, kind, placeholders, tags }` — what the parity test compares between English and
 * Nepali, and what `scripts/i18n-review.mjs` prints for a reviewer.
 *
 * @param {object} tree
 * @returns {{ path: string, kind: 'text'|'plural'|'invalid', placeholders: string[], tags: string[], value: unknown }[]}
 */
export function describeCatalogue(tree, prefix = '') {
  return Object.entries(tree ?? {}).flatMap(([k, value]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    const texts = typeof value === 'string' ? [value] : isPluralForms(value) ? Object.values(value) : null;
    if (texts) {
      const found = (re) => [...new Set(texts.flatMap((s) => [...s.matchAll(re)].map((m) => m[1])))].sort();
      return [{
        path, kind: typeof value === 'string' ? 'text' : 'plural', placeholders: found(PLACEHOLDER), tags: found(RICH_TAG), value,
      }];
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) return describeCatalogue(value, path);
    return [{ path, kind: 'invalid', placeholders: [], tags: [], value }];
  });
}

/**
 * An RTK Query error in words: the catalogue's `errors.<CODE>`, then `common`'s, then the server's own message, then
 * `common`'s `errors.generic`. The API's codes are stable; its messages are English (and the fallback).
 *
 * @param {unknown} error an RTK Query error — `{ status, data: { error: { code, message } } }` or `{ status: 'FETCH_ERROR' }`
 * @param {ReturnType<typeof createT>} t the screen's translator
 * @param {ReturnType<typeof createT>} common a translator over `config/i18n/common.js`, same locale
 */
export function apiErrorText(error, t, common) {
  const status = error?.status;
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return common('errors.offline');
  const { code, message, details } = error?.data?.error ?? {};
  // A code's details (`{ max: 5 }`) fill its placeholders; a validation error's list of issues does not.
  const vars = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
  if (code && t?.has(`errors.${code}`)) return t(`errors.${code}`, vars);
  if (code && common.has(`errors.${code}`)) return common(`errors.${code}`, vars);
  return message || common('errors.generic');
}
