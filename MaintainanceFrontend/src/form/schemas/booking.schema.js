import { z } from 'zod';
import { personName, nepaliPhone, requiredAddress, message } from './fields';

/** Step 3 of the booking wizard — the visit needs an address to dispatch to. */
export const bookingDetailsSchema = z.object({
  name: personName,
  phone: nepaliPhone,
  address: requiredAddress,
  message,
});

export const bookingDetailsDefaults = { name: '', phone: '', address: '', message: '' };
