import { describe, it, expect } from 'vitest';
import { choiceBody, emailDiffers, initialChoice } from '@/helpers/customerMatch';

const lead = { id: 'l1', email: 'tenant@example.com', preferredLocale: 'ne', customerId: null };
const household = { id: 'c1', name: 'Household', email: 'household@example.com', preferredLocale: 'en' };
const noEmail = { id: 'c2', name: 'No Email', email: null, preferredLocale: 'ne' };
const matches = [household, noEmail];

describe('convert customer choice', () => {
  it('asks only when a customer has the phone and the lead is not linked yet', () => {
    expect(initialChoice(lead, [])).toEqual({ mode: 'auto' });
    expect(initialChoice({ ...lead, customerId: 'c9' }, matches)).toEqual({ mode: 'linked' });
    expect(initialChoice(lead, matches).mode).toBeNull();
    expect(choiceBody(initialChoice(lead, matches), lead, matches)).toEqual({ ready: false, body: {} });
  });

  it('"different person" asks for a new customer', () => {
    expect(choiceBody({ mode: 'new' }, lead, matches)).toEqual({ ready: true, body: { createNewCustomer: true } });
  });

  it('"same person" links, and leaves the email alone unless ticked', () => {
    expect(choiceBody({ mode: 'same', customerId: 'c1', confirmEmail: false }, lead, matches))
      .toEqual({ ready: true, body: { customerId: 'c1' } });
    expect(choiceBody({ mode: 'same', customerId: 'c1', confirmEmail: true }, lead, matches))
      .toEqual({ ready: true, body: { customerId: 'c1', confirmEmail: true } });
  });

  it('never sends confirmEmail when there is nothing to change', () => {
    const same = { ...household, email: lead.email };
    expect(emailDiffers(lead, same)).toBe(false);
    expect(choiceBody({ mode: 'same', customerId: 'c1', confirmEmail: true }, lead, [same]).body).toEqual({ customerId: 'c1' });
    expect(emailDiffers({ ...lead, email: null }, noEmail)).toBe(false);
    expect(emailDiffers(lead, noEmail)).toBe(true);
  });

  it('keeps the customer’s language unless staff choose the lead’s', () => {
    expect(choiceBody({ mode: 'same', customerId: 'c1', useLeadLocale: true }, lead, matches).body)
      .toEqual({ customerId: 'c1', preferredLocale: 'ne' });
    // Already Nepali: nothing to send.
    expect(choiceBody({ mode: 'same', customerId: 'c2', useLeadLocale: true }, lead, matches).body).toEqual({ customerId: 'c2' });
  });

  it('is not ready until a customer is picked', () => {
    expect(choiceBody({ mode: 'same', customerId: null }, lead, matches).ready).toBe(false);
    expect(choiceBody({ mode: 'same', customerId: 'gone' }, lead, matches).ready).toBe(false);
  });
});
