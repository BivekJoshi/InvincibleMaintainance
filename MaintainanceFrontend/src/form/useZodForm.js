import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * react-hook-form wired to a zod schema, so no form has to repeat the resolver
 * import. Everything `useForm` accepts still passes through — including `mode`,
 * which is left at react-hook-form's own default rather than opinionated here.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {import('react-hook-form').UseFormProps} [options]
 * @returns {import('react-hook-form').UseFormReturn}
 */
export function useZodForm(schema, options = {}) {
  return useForm({ ...options, resolver: zodResolver(schema) });
}
