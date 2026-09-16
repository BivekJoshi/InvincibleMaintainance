import { paisaToRupees } from '@/helpers/format';

/** Every field spec with `group` wrappers flattened away. */
export function flattenFields(fields = []) {
  return fields.flatMap((f) => (f.type === 'group' ? flattenFields(f.fields) : [f]));
}

/**
 * What an empty field holds. Numbers, money, dates and media are `undefined` rather
 * than null, because zod's `.optional()` accepts undefined and a mirrored
 * `z.coerce.number()` would turn null into 0. A relation is null, because the API's
 * relation ids are `.nullable()` and null is how a relation is cleared.
 */
function emptyValue(type) {
  switch (type) {
    case 'text': case 'textarea': case 'prose': case 'markdown': case 'slug': return '';
    case 'switch': return false;
    case 'relation': return null;
    case 'stringList': case 'mediaList': case 'weekdays': case 'objectList': return [];
    case 'keyValue': return {};
    default: return undefined;
  }
}

/**
 * A record as the API returns it → the values the form edits.
 *
 * `record` is in API shape: money in integer **paisa**. Money fields are converted to
 * rupees here — the only direction a form needs, because requests send rupees.
 *
 * @param {object[]} fields
 * @param {object} [record]
 */
export function toFormValues(fields, record) {
  const out = { ...(record ?? {}) };
  const names = new Set(flattenFields(fields).map((f) => f.name));
  // A column the form does not edit keeps its value, but a null one is dropped: the schema's
  // `.optional()` refuses null, and an invisible field must not block a save (a testimonial's jobId).
  for (const [key, value] of Object.entries(out)) {
    if (value === null && !names.has(key)) delete out[key];
  }
  for (const f of flattenFields(fields)) {
    let value = record?.[f.name];
    if (f.type === 'money' && value != null) value = paisaToRupees(value);
    if (value == null) value = f.defaultValue ?? emptyValue(f.type);
    out[f.name] = value;
  }
  return out;
}

/**
 * The form's validated values → a request body. Money stays in rupees (the API
 * converts); blank list items are dropped; an empty optional value is omitted.
 *
 * @param {object[]} fields
 * @param {object} values
 */
export function toRequestValues(fields, values) {
  const out = { ...values };
  for (const f of flattenFields(fields)) {
    const value = out[f.name];
    if (f.type === 'stringList') {
      out[f.name] = (Array.isArray(value) ? value : []).map((s) => String(s).trim()).filter(Boolean);
    } else if (f.type === 'objectList') {
      // A row left completely empty is not an item.
      out[f.name] = (Array.isArray(value) ? value : [])
        .filter((row) => Object.values(row ?? {}).some((v) => String(v ?? '').trim()));
    } else if (f.type === 'relation') {
      out[f.name] = value || null;
    } else if (value === '' && !['text', 'textarea', 'prose', 'markdown', 'slug'].includes(f.type)) {
      out[f.name] = undefined;
    }
  }
  return out;
}
