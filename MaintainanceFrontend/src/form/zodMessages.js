import { defaultErrorMap } from 'zod';
import { VALIDATION } from '@/config/i18n/validation';
import { createT } from '@/helpers/i18n';

/**
 * Validation messages in the form's language (Phase J1, J1.4). `useZodForm` applies both halves:
 * - `validationErrorMap(locale)` words every issue a schema left unworded (`.max(1000)`, `.min(1)`, a missing number,
 *   an email) from `config/i18n/validation.js#issues`;
 * - `translateValidationMessage` resolves the message keys a schema chose (`.min(2, vKey('name'))`).
 * A schema's plain English message (the back office's) is left as it is.
 */

const KEY = /^v:(\w+)$/;

/** A message by name, for a schema — `z.string().min(2, vKey('name'))`. The words are `validation.js#messages.name`. */
export const vKey = (name) => `v:${name}`;

/** `v:name` → its words in `locale`; any other message unchanged. */
export function translateValidationMessage(message, locale = 'en') {
  const match = KEY.exec(message ?? '');
  return match ? createT(VALIDATION, locale)(`messages.${match[1]}`) : message;
}

/**
 * zod's `errorMap` for `locale`, for the issues a schema left unworded. zod never asks it about a check's own message
 * (`.min(2, '…')`), but it does run it after a schema-level one (`z.string({ required_error: 'Say when' })`), passing
 * that in as `ctx.defaultError` — so words that differ from zod's own default are the schema's, and are kept.
 *
 * @param {'en'|'ne'} locale
 * @returns {import('zod').ZodErrorMap}
 */
export function validationErrorMap(locale = 'en') {
  const t = createT(VALIDATION, locale);
  const count = (n) => ({ count: Number(n), min: Number(n), max: Number(n) });
  return (issue, ctx) => {
    if (ctx.defaultError !== defaultErrorMap(issue, { data: ctx.data, defaultError: '' }).message) {
      return { message: ctx.defaultError };
    }
    switch (issue.code) {
      case 'invalid_type':
        if (issue.received === 'undefined' || issue.received === 'null') return { message: t('issues.required') };
        if (issue.expected === 'number') return { message: t('issues.number') };
        break;
      case 'too_small':
        if (issue.type === 'string') {
          return { message: Number(issue.minimum) <= 1 ? t('issues.required') : t('issues.minChars', count(issue.minimum)) };
        }
        if (issue.type === 'number') return { message: t('issues.minNumber', count(issue.minimum)) };
        if (issue.type === 'array') return { message: t('issues.minItems', count(issue.minimum)) };
        break;
      case 'too_big':
        if (issue.type === 'string') return { message: t('issues.maxChars', count(issue.maximum)) };
        if (issue.type === 'number') return { message: t('issues.maxNumber', count(issue.maximum)) };
        if (issue.type === 'array') return { message: t('issues.maxItems', count(issue.maximum)) };
        break;
      case 'invalid_string':
        if (issue.validation === 'email') return { message: t('messages.email') };
        break;
      case 'invalid_enum_value':
        return { message: t('issues.choose') };
      default:
        break;
    }
    // zod's own words are English; a Nepali screen says "check this" rather than mix languages.
    return { message: locale === 'en' ? ctx.defaultError : t('issues.invalid') };
  };
}

/** Every `message` in a react-hook-form error tree, keys resolved in `locale`. */
export function translateFieldErrors(errors, locale) {
  if (!errors || typeof errors !== 'object') return errors;
  const out = Array.isArray(errors) ? [] : {};
  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref') out[key] = value;
    else if (key === 'message' && typeof value === 'string') out[key] = translateValidationMessage(value, locale);
    else out[key] = value && typeof value === 'object' ? translateFieldErrors(value, locale) : value;
  }
  return out;
}
