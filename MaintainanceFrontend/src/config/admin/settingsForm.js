import { z } from 'zod';
import { email, nepaliPhone } from '@/form/schemas/fields';
import { ICON_OPTIONS } from '@/config/admin/resources/iconOptions';

/**
 * The settings screen, described as data: which card each `Setting.group` is, and which
 * input each row gets. A row's `type` (seeded in the API's `prisma/seed-data.js`) picks the
 * input — `string`, `number`, `boolean`, `richtext`, `media`, `json` — and a few keys refine
 * it: phone numbers take the Nepali phone rule, `booking.closedWeekdays` is seven checkboxes,
 * and the two JSON lists of the home page are editable rows.
 *
 * Setting keys have dots in them, which react-hook-form reads as nesting, so a key becomes a
 * field name with `__` instead (`fieldNameOf`).
 */

/** Cards in this order; a group not listed here follows them, titled from its key. */
export const SETTING_GROUPS = [
  { key: 'contact', label: 'Contact details', description: 'The header, the footer, the contact page and the lead alerts use these.' },
  { key: 'branding', label: 'Brand and home page', description: 'The tagline, the trust badges under the hero and the counters.' },
  { key: 'social', label: 'Social links', description: 'Full addresses, starting with https://.' },
  { key: 'seo', label: 'Search engines and tracking', description: 'Used where a page has no title or description of its own.' },
  { key: 'booking', label: 'Online booking', description: 'What the booking calendar offers.' },
  { key: 'sla', label: 'Lead response', description: 'The two-hour promise, as the system enforces it.' },
  { key: 'finance', label: 'Quotations and invoices', description: 'Defaults for new documents; existing ones keep their own.' },
  { key: 'warranty', label: 'Warranty', description: 'The default for new warranties.' },
];

const PHONE_KEYS = new Set(['contact.phonePrimary', 'contact.phoneSecondary', 'contact.onCallPhone', 'contact.viber', 'contact.whatsapp']);
const EMAIL_KEYS = new Set(['contact.email', 'contact.salesEmail']);
const REQUIRED_KEYS = new Set(['contact.companyName', 'contact.phonePrimary']);
/** Number settings that may be left empty; every other number is required. */
const OPTIONAL_NUMBERS = new Set(['booking.slotCapacity']);
const NUMBER_RANGES = {
  'finance.vatRate': [0, 100],
  'finance.paymentTermDays': [0, 365],
  'sla.leadResponseMinutes': [1, 10080],
  'sla.warnBeforeMinutes': [0, 1440],
  'booking.maxDaysAhead': [1, 365],
  'booking.slotCapacity': [1, 100],
  'booking.leadTimeHours': [0, 168],
  'warranty.defaultDays': [0, 3650],
};

const isUrlKey = (key) => key.startsWith('social.') || key === 'contact.mapEmbed';
const blankRow = (row) => !Object.values(row ?? {}).some((v) => String(v ?? '').trim());
const dropBlankRows = (v) => (Array.isArray(v) ? v.filter((row) => !blankRow(row)) : v);

/** Per-key inputs for the JSON settings the site reads. */
const JSON_FIELDS = {
  'booking.closedWeekdays': {
    spec: { type: 'weekdays' },
    schema: z.array(z.number().int().min(0).max(6))
      .refine((days) => days.length < 7, 'Leave at least one day open for bookings'),
  },
  'badges.items': {
    spec: {
      type: 'objectList',
      itemLabel: 'Badge',
      maxItems: 6,
      itemFields: [
        { name: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS, className: 'sm:max-w-[12rem]' },
        { name: 'label', label: 'Text', maxLength: 60, placeholder: 'Free Consultation' },
      ],
    },
    schema: z.preprocess(dropBlankRows, z.array(z.object({
      icon: z.string().min(1, 'Pick an icon'),
      label: z.string().trim().min(1, 'Write the badge text').max(60),
    })).max(6, 'Six badges at most')),
  },
  'stats.items': {
    spec: {
      type: 'objectList',
      itemLabel: 'Counter',
      maxItems: 8,
      itemFields: [
        { name: 'value', label: 'Figure', maxLength: 20, placeholder: '2.5k+', className: 'sm:max-w-[9rem]' },
        { name: 'label', label: 'Label', maxLength: 60, placeholder: 'Satisfied Clients' },
      ],
    },
    schema: z.preprocess(dropBlankRows, z.array(z.object({
      value: z.string().trim().min(1, 'Write the figure').max(20),
      label: z.string().trim().min(1, 'Write the label').max(60),
    })).max(8, 'Eight counters at most')),
  },
};

const HINTS = {
  'badges.items': 'The strip under the hero.',
  'stats.items': 'The counters band; the hero shows the first three.',
  'branding.logoId': 'Shown in the site header and footer, the login page and the back office. A square PNG or SVG works best; without one, the company’s initial is shown.',
  'contact.mapEmbed': 'The address from Google Maps → Share → Embed a map (the src of the iframe).',
};

/**
 * JSON with object keys sorted. PostgreSQL's jsonb stores object keys in its own order
 * (`{ label, value }` for a counter the form holds as `{ value, label }`), so two equal
 * values can stringify differently.
 */
const canonical = (value) => JSON.stringify(value ?? null, (_key, v) => (
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
));

/** `contact.phonePrimary` → `contact__phonePrimary`. */
export const fieldNameOf = (key) => key.replaceAll('.', '__');

const groupLabel = (key) => SETTING_GROUPS.find((g) => g.key === key)?.label
  ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');

/** The input and the rule for one setting row. */
function describe(row) {
  const name = fieldNameOf(row.key);
  const base = { name, label: row.label, description: row.hint ?? HINTS[row.key] };
  const required = REQUIRED_KEYS.has(row.key);

  if (JSON_FIELDS[row.key]) {
    const { spec, schema } = JSON_FIELDS[row.key];
    return { spec: { ...base, ...spec }, schema, kind: spec.type };
  }

  switch (row.type) {
    case 'number': {
      const optional = OPTIONAL_NUMBERS.has(row.key);
      const [min, max] = NUMBER_RANGES[row.key] ?? [0, 1_000_000];
      let schema = z.number({ required_error: 'Enter a number', invalid_type_error: 'Enter a number' })
        .min(min, `At least ${min}`).max(max, `At most ${max}`);
      if (optional) schema = schema.optional();
      return {
        spec: { ...base, type: 'number', min, max, step: 1, required: !optional, span: 'half' },
        schema,
        kind: 'number',
      };
    }
    case 'boolean':
      return { spec: { ...base, type: 'switch' }, schema: z.boolean(), kind: 'boolean' };
    case 'richtext':
      return { spec: { ...base, type: 'textarea', rows: 5 }, schema: z.string().max(5000), kind: 'string' };
    case 'media':
      return { spec: { ...base, type: 'media' }, schema: z.string().optional(), kind: 'media' };
    case 'json':
      return {
        spec: { ...base, type: 'textarea', rows: 4, description: base.description ?? 'JSON.' },
        schema: z.string().refine((v) => {
          try { JSON.parse(v); return true; } catch { return false; }
        }, 'This is not valid JSON'),
        kind: 'json',
      };
    default: {
      let schema = z.string().trim().max(2000);
      let spec = { ...base, type: 'text', required };
      if (PHONE_KEYS.has(row.key)) {
        schema = required ? nepaliPhone : z.union([nepaliPhone, z.literal('')]);
        spec = { ...spec, inputType: 'tel', span: 'half', placeholder: '9808338255' };
      } else if (EMAIL_KEYS.has(row.key)) {
        schema = z.union([email, z.literal('')]);
        spec = { ...spec, inputType: 'email', span: 'half' };
      } else if (isUrlKey(row.key)) {
        schema = schema.refine((v) => !v || /^https:\/\/\S+$/i.test(v), 'Paste the full address, starting with https://');
        spec = { ...spec, inputType: 'url', placeholder: 'https://' };
      } else if (required) {
        schema = schema.min(1, `${row.label} is required`);
      }
      return { spec, schema, kind: 'string' };
    }
  }
}

/** A stored value → what its input holds. */
function toInput(kind, value) {
  switch (kind) {
    case 'number': return typeof value === 'number' ? value : undefined;
    case 'boolean': return Boolean(value);
    case 'media': return value || undefined;
    case 'json': return JSON.stringify(value ?? null, null, 2);
    case 'weekdays': return Array.isArray(value) ? value.map(Number) : [];
    case 'objectList': return Array.isArray(value) ? value.map((row) => ({ ...row })) : [];
    default: return value == null ? '' : String(value);
  }
}

/** An input's value → what the API stores. */
function toStored(kind, value) {
  switch (kind) {
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? value : null;
    case 'boolean': return Boolean(value);
    case 'media': return value || '';
    case 'json': return JSON.parse(value);
    case 'weekdays': return [...(value ?? [])].map(Number).sort((a, b) => a - b);
    case 'objectList': return dropBlankRows(value ?? []).map((row) => Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    ));
    default: return typeof value === 'string' ? value.trim() : value ?? '';
  }
}

/**
 * Everything the settings form needs from `GET /admin/settings`.
 *
 * @param {Record<string, object[]>} grouped `{ [group]: Setting[] }`
 * @returns {{ fields: object[], schema: import('zod').ZodTypeAny, values: object,
 *   changes: (body: object) => Record<string, unknown> }}
 *   `values` is the form's starting point; `changes(body)` turns a submitted form into
 *   `{ [key]: value }` for the keys whose stored value would change — the PATCH body.
 */
export function buildSettingsForm(grouped = {}) {
  const known = SETTING_GROUPS.map((g) => g.key);
  const order = [...known.filter((k) => grouped[k]?.length), ...Object.keys(grouped).filter((k) => !known.includes(k)).sort()];
  const rows = [];
  const fields = [];
  const shape = {};

  for (const group of order) {
    const described = (grouped[group] ?? []).map((row) => ({ row, ...describe(row) }));
    if (!described.length) continue;
    rows.push(...described);
    fields.push({
      key: group,
      type: 'group',
      variant: 'card',
      label: groupLabel(group),
      description: SETTING_GROUPS.find((g) => g.key === group)?.description,
      fields: described.map((d) => d.spec),
    });
    for (const d of described) shape[d.spec.name] = d.schema;
  }

  const values = Object.fromEntries(rows.map(({ row, spec, kind }) => [spec.name, toInput(kind, row.value)]));

  const changes = (body) => {
    const out = {};
    for (const { row, spec, kind } of rows) {
      const next = toStored(kind, body[spec.name]);
      if (canonical(next) !== canonical(row.value)) out[row.key] = next;
    }
    return out;
  };

  return { fields, schema: z.object(shape), values, changes };
}
