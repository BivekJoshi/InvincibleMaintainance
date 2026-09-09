import { z } from 'zod';
import { personName, nepaliPhone, address, message, optionalId } from './fields';

/** The public enquiry form. Mirrors the API's leads.create schema. */
export const leadSchema = z.object({
  name: personName,
  phone: nepaliPhone,
  address: address.optional(),
  serviceId: optionalId,
  message,
});

export const leadDefaults = { name: '', phone: '', address: '', serviceId: '', message: '' };
