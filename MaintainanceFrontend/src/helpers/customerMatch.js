/**
 * Convert's customer decision (D8), as pure functions the two convert dialogs share.
 *
 * A phone number is shared and recycled, so when an existing customer has the lead's
 * phone, staff must say "same person" or "different person" before anything converts.
 * An email moves onto an existing customer only when staff tick the box for it.
 *
 * `mode`: `linked` (the lead already has a customer), `auto` (nobody has this phone),
 * `same`, `new`, or null (not decided yet).
 */

/** The choice a dialog opens with. */
export function initialChoice(lead, matches) {
  if (lead?.customerId) return { mode: 'linked' };
  if (!matches?.length) return { mode: 'auto' };
  return { mode: null, customerId: null, confirmEmail: false, useLeadLocale: false };
}

/** The lead has an email the customer does not (or a different one). */
export const emailDiffers = (lead, customer) => Boolean(lead?.email) && lead.email !== (customer?.email ?? null);

export const localeDiffers = (lead, customer) => Boolean(customer) && (lead?.preferredLocale ?? 'en') !== (customer.preferredLocale ?? 'en');

/**
 * What the choice adds to `POST /admin/leads/:id/convert`, and whether it is complete.
 *
 * @returns {{ ready: boolean, body: object }}
 */
export function choiceBody(choice, lead, matches = []) {
  switch (choice?.mode) {
    case 'linked':
    case 'auto':
      return { ready: true, body: {} };
    case 'new':
      return { ready: true, body: { createNewCustomer: true } };
    case 'same': {
      const customer = matches.find((c) => c.id === choice.customerId);
      if (!customer) return { ready: false, body: {} };
      return {
        ready: true,
        body: {
          customerId: customer.id,
          ...(choice.confirmEmail && emailDiffers(lead, customer) ? { confirmEmail: true } : {}),
          ...(choice.useLeadLocale && localeDiffers(lead, customer) ? { preferredLocale: lead.preferredLocale } : {}),
        },
      };
    }
    default:
      return { ready: false, body: {} };
  }
}
