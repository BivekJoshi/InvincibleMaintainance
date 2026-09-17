import { z } from 'zod';
import { nepaliPhone, optionalPhone, optionalEmail, optionalText, preferredLocale } from './fields';
import { CUSTOMER_TYPES } from '@/config/constants';

/** Mirrors `customerSchema` in MaintainanceBackend/src/shared/schemas/crm.js. */
export const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES),
  name: z.string().trim().min(2, 'Enter the customer’s name').max(160),
  phone: nepaliPhone,
  altPhone: optionalPhone,
  email: optionalEmail,
  panVatNo: z.string().trim().max(30).optional(),
  notes: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  preferredLocale,
});

export const customerDefaults = { type: 'individual', preferredLocale: 'en', tags: [] };

const optionalCoordinate = (min, max) => z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().min(min).max(max).optional(),
);

/** Mirrors `customerSiteSchema`. */
export const customerSiteSchema = z.object({
  label: z.string().trim().min(1, 'Name the site, e.g. Home').max(120),
  address: z.string().trim().min(3, 'Enter the address').max(400),
  area: z.string().trim().max(120).optional(),
  lat: optionalCoordinate(-90, 90),
  lng: optionalCoordinate(-180, 180),
  accessNotes: optionalText,
  isPrimary: z.boolean(),
});

export const siteDefaults = { label: '', address: '', isPrimary: false };

/**
 * "27.6712, 85.3240" — what copying a pin from a map app gives — split into lat and lng.
 * @returns {{ lat: number, lng: number }|null}
 */
export function parseMapPin(text) {
  const m = String(text ?? '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
