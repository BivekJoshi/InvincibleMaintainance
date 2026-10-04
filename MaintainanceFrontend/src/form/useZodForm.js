import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '@/hooks/useT';
import { translateFieldErrors, validationErrorMap } from './zodMessages';

/**
 * react-hook-form wired to a zod schema, so no form has to repeat the resolver
 * import. Everything `useForm` accepts still passes through — including `mode`,
 * which is left at react-hook-form's own default rather than opinionated here.
 *
 * Phase J1: messages come out in the screen's language (`useLocale()` — English under `/admin`). zod words the issues a
 * schema left unworded through `validationErrorMap`, and the message keys a schema chose (`vKey('phone')`) are resolved
 * after it — see `form/zodMessages.js`. Switching the language re-words the next validation.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {import('react-hook-form').UseFormProps} [options]
 * @returns {import('react-hook-form').UseFormReturn}
 */
export function useZodForm(schema, options = {}) {
  const locale = useLocale();
  const resolver = useMemo(() => {
    const zod = zodResolver(schema, { errorMap: validationErrorMap(locale) });
    return async (values, context, opts) => {
      const result = await zod(values, context, opts);
      return { ...result, errors: translateFieldErrors(result.errors, locale) };
    };
  }, [schema, locale]);
  return useForm({ ...options, resolver });
}
