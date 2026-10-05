import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useZodForm } from '@/form/useZodForm';
import { translateValidationMessage, validationErrorMap, vKey } from '@/form/zodMessages';
import { bookingDetailsSchema } from '@/form/schemas/booking.schema';
import { LocaleScope } from '@/providers/LocaleProvider';

const messagesFor = (schema, value, locale) =>
  schema.safeParse(value, { errorMap: validationErrorMap(locale) }).error.issues.map((i) => translateValidationMessage(i.message, locale));

describe('validation messages (Phase J1, J1.4)', () => {
  it("resolves a schema's message keys in the form's language", () => {
    expect(translateValidationMessage(vKey('phone'), 'en')).toBe('Enter a valid Nepali number, e.g. 9808338255 or 01-5407720');
    expect(translateValidationMessage(vKey('phone'), 'ne')).toBe('सही नेपाली नम्बर लेख्नुहोस्, जस्तै 9808338255 वा 01-5407720');
    expect(translateValidationMessage('Plain English from an admin schema', 'ne')).toBe('Plain English from an admin schema');
  });

  it('words the limits a schema left unworded, with the numbers in them', () => {
    expect(messagesFor(z.string().max(5), 'too long', 'en')).toEqual(['At most 5 characters']);
    expect(messagesFor(z.string().max(5), 'too long', 'ne')).toEqual(['बढीमा 5 अक्षर']);
    expect(messagesFor(z.string().min(1), '', 'ne')).toEqual(['यो भर्नुहोस्']);
    expect(messagesFor(z.object({ n: z.number() }), {}, 'ne')).toEqual(['यो भर्नुहोस्']);
    expect(messagesFor(z.number().min(3), 1, 'ne')).toEqual(['3 वा सोभन्दा बढी हुनुपर्छ']);
    expect(messagesFor(z.enum(['a', 'b']), 'c', 'ne')).toEqual(['एउटा छान्नुहोस्']);
    expect(messagesFor(z.string().email(), 'nope', 'ne')).toEqual(['सही इमेल ठेगाना लेख्नुहोस्']);
  });

  it("keeps a schema's own words, set on the schema rather than the check", () => {
    expect(messagesFor(z.object({ when: z.string({ required_error: 'Say when' }) }), {}, 'ne')).toEqual(['Say when']);
    expect(messagesFor(z.number({ invalid_type_error: 'A number, please' }), 'x', 'ne')).toEqual(['A number, please']);
  });

  it("keeps zod's own words in English, and says 'check this' in Nepali for anything else", () => {
    expect(messagesFor(z.string().url(), 'nope', 'en')).toEqual(['Invalid url']);
    expect(messagesFor(z.string().url(), 'nope', 'ne')).toEqual(['यो जाँच्नुहोस्']);
  });

  it('checks the booking form in Nepali — name, phone and address', () => {
    const issues = messagesFor(bookingDetailsSchema, { name: 'क', phone: '12345', address: 'x' }, 'ne');
    expect(issues).toEqual(['आफ्नो नाम लेख्नुहोस्', 'सही नेपाली नम्बर लेख्नुहोस्, जस्तै 9808338255 वा 01-5407720', 'इन्जिनियर कहाँ आउने? ठेगाना लेख्नुहोस्']);
  });
});

function PhoneForm() {
  const { register, handleSubmit, formState: { errors } } = useZodForm(z.object({ phone: bookingDetailsSchema.shape.phone }), { defaultValues: { phone: '' } });
  return (
    <form onSubmit={handleSubmit(() => {})}>
      <input aria-label="phone" {...register('phone')} />
      {errors.phone ? <p role="alert">{errors.phone.message}</p> : null}
      <button type="submit">Send</button>
    </form>
  );
}

describe('useZodForm', () => {
  it('shows a zod error in Nepali when the visitor chose Nepali', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PhoneForm />, { preloadedState: { ui: { locale: 'ne', toasts: [] } } });
    await user.type(screen.getByLabelText('phone'), '123');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('सही नेपाली नम्बर लेख्नुहोस्');
  });

  it('stays English in the back office whatever the visitor chose on the site', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocaleScope locale="en"><PhoneForm /></LocaleScope>, { preloadedState: { ui: { locale: 'ne', toasts: [] } } });
    await user.type(screen.getByLabelText('phone'), '123');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid Nepali number');
  });
});
