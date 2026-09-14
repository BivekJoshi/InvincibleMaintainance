import { Label } from '@/components/ui/label';
import { cn } from '@/helpers/utils';

/**
 * Label, description and error around one control, wired for assistive tech: the
 * control gets `aria-invalid`, and `aria-describedby` points at the description and
 * the error so both are read when it takes focus.
 *
 * `children` is a function receiving those attributes to spread onto the control.
 * A control made of several inputs (a list, a gallery) renders as a `fieldset` with
 * a `legend` instead of a `label`.
 *
 * @param {object} props
 * @param {string} props.id                 id of the control the label points at
 * @param {{ label?: string, description?: string, required?: boolean }} props.field
 * @param {{ message?: string }} [props.error]
 * @param {'div'|'fieldset'} [props.as]
 * @param {(control: object) => import('react').ReactNode} props.children
 */
export function FormField({ id, field, error, as = 'div', className, children }) {
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = error?.message ? `${id}-error` : undefined;
  const control = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-required': field.required || undefined,
  };

  const Wrapper = as;
  const heading = field.label
    ? as === 'fieldset'
      ? (
        <legend className="mb-2 text-sm font-medium leading-none">
          {field.label}
          {field.required ? <span className="ml-0.5 text-destructive" aria-hidden>*</span> : null}
        </legend>
      )
      : <Label htmlFor={id} required={field.required}>{field.label}</Label>
    : null;

  return (
    <Wrapper className={cn('min-w-0 space-y-2', className)} {...(as === 'fieldset' ? { 'aria-describedby': control['aria-describedby'] } : {})}>
      {heading}
      {children(control)}
      {field.description ? <p id={descriptionId} className="text-xs text-muted-foreground">{field.description}</p> : null}
      {error?.message ? <p id={errorId} className="text-xs font-medium text-destructive">{error.message}</p> : null}
    </Wrapper>
  );
}
