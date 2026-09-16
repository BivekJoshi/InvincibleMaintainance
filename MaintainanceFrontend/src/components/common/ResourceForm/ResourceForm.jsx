import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { useZodForm } from '@/form/useZodForm';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/helpers/utils';
import { FieldGrid } from './FieldRenderer';
import { flattenFields, toFormValues, toRequestValues } from './formValues';
import { applyServerErrors } from './serverErrors';

const LEAVE = {
  title: 'Leave without saving?',
  description: 'Your changes have not been saved. If you leave now, they are lost.',
  confirmLabel: 'Leave without saving',
  cancelLabel: 'Keep editing',
  destructive: true,
};

/**
 * A form described by data. Every admin create/edit screen is one of these.
 *
 *   <ResourceForm
 *     schema={faqSchema}
 *     fields={[{ name: 'question', type: 'text', label: 'Question', required: true }, …]}
 *     defaultValues={faq}
 *     onSubmit={(body) => updateFaq({ id, ...body }).unwrap()}
 *   />
 *
 * - `defaultValues` is a record **as the API returns it** — money in paisa. Money
 *   fields are shown and submitted in rupees, which is what requests carry.
 * - `onSubmit(body)` should return the mutation's `unwrap()` promise. If it rejects
 *   with the API's error envelope, `error.details` lands on the matching fields and
 *   the rest shows above the form.
 * - While saving, every control is disabled. After a successful save the form is
 *   clean again, so the navigation `onSubmit` may start is not held.
 * - With unsaved changes, leaving the page (a link, Back, closing the tab) or closing
 *   the sheet asks first. Needs the data router `AppProviders` sets up. Only one
 *   guard can be active per page: pass `guard={false}` to any second form.
 * - Render it once the record has loaded, so a saved slug is recognised as saved.
 *
 * Field types: text, textarea, prose (alias markdown), number, money, switch,
 * select/enum, relation, date, datetime, slug, stringList, keyValue, media,
 * mediaList, and `group` for collapsible sections. See `FieldRenderer.jsx`.
 *
 * @param {object} props
 * @param {import('zod').ZodTypeAny} props.schema          validates the form values (money in rupees)
 * @param {object[]} props.fields
 * @param {object} [props.defaultValues]
 * @param {(body: object, helpers: { values: object, form: object }) => Promise<unknown>} props.onSubmit
 * @param {string} [props.submitLabel]
 * @param {'page'|'sheet'} [props.mode]
 * @param {() => void} [props.onCancel]                    page mode: show a Cancel button
 * @param {boolean} [props.open]                           sheet mode
 * @param {(open: boolean) => void} [props.onOpenChange]   sheet mode
 * @param {string} [props.title]                           sheet mode
 * @param {string} [props.description]                    sheet mode
 * @param {boolean} [props.guard]
 * @param {import('react').ReactNode} [props.extraActions] more buttons beside Save
 * @param {boolean} [props.readOnly]                      shows the values with every control disabled and no Save
 * @param {import('react').ReactNode} [props.intro]       shown above the fields, e.g. a record's preview in a sheet
 */
export function ResourceForm({
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  mode = 'page',
  onCancel,
  cancelLabel = 'Cancel',
  open,
  onOpenChange,
  title,
  description,
  guard = true,
  extraActions,
  className,
  readOnly = false,
  intro,
}) {
  const formId = `form-${useId().replace(/[^\w-]/g, '')}`;
  const initial = useMemo(() => toFormValues(fields, defaultValues), [fields, defaultValues]);
  // Callers pass inline field arrays and records; compare by value so a render is not a reset.
  const initialKey = JSON.stringify(initial);
  const form = useZodForm(schema, { defaultValues: initial, mode: 'onTouched' });
  const { reset, setError, setFocus, formState: { isDirty, isSubmitting } } = form;
  const [formError, setFormError] = useState(null);
  const [confirm, confirmDialog] = useConfirm();
  const { blocker, setBypass } = useUnsavedChangesGuard(guard && isDirty);

  // A record that arrives or refetches after mount replaces the values — unless someone is mid-edit.
  const dirty = useRef(isDirty);
  dirty.current = isDirty;
  useEffect(() => {
    if (!dirty.current) reset(JSON.parse(initialKey));
  }, [initialKey, reset]);

  // The first field a failed save names takes focus once the fieldset is enabled again.
  const firstField = formError?.firstField;
  useEffect(() => {
    if (!isSubmitting && firstField) setFocus(firstField);
  }, [isSubmitting, firstField, setFocus]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    setBypass(true);
    try {
      await onSubmit(toRequestValues(fields, values), { values, form });
      // The inputs' own values become the saved state. `values` is the schema's output, where a
      // transform (an empty optional text → undefined) would leave the form dirty after a save.
      reset(form.getValues());
    } catch (err) {
      setFormError(applyServerErrors(err, setError, flattenFields(fields).map((f) => f.name)));
    } finally {
      setBypass(false);
    }
  });

  const closeSheet = async () => {
    if (guard && isDirty && !(await confirm(LEAVE))) return;
    reset(JSON.parse(initialKey));
    setFormError(null);
    onOpenChange?.(false);
  };

  const errorAlert = formError ? (
    <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{formError.message}</p>
        {formError.details?.length ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {formError.details.map((d) => <li key={d}>{d}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  ) : null;

  const saveButton = readOnly ? null : <Button type="submit" form={formId} loading={isSubmitting}>{submitLabel}</Button>;

  const body = (
    <FormProvider {...form}>
      <form id={formId} onSubmit={submit} noValidate className={cn('space-y-6', className)}>
        {intro}
        {errorAlert}
        <fieldset disabled={isSubmitting || readOnly} className="min-w-0">
          <FieldGrid fields={fields} idPrefix={formId} />
        </fieldset>
        {mode === 'page' ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {extraActions}
            {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>{readOnly ? 'Back' : cancelLabel}</Button> : null}
            {saveButton}
          </div>
        ) : null}
      </form>
    </FormProvider>
  );

  const leaveDialog = (
    <ConfirmDialog
      {...LEAVE}
      open={blocker.state === 'blocked'}
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );

  if (mode === 'sheet') {
    return (
      <>
        <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange?.(true) : closeSheet())}>
          <SheetContent
            className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
            {...(description ? {} : { 'aria-describedby': undefined })}
          >
            <SheetHeader className="border-b px-6 py-4 text-left">
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">{body}</div>
            <SheetFooter className="gap-2 border-t px-6 py-4">
              {extraActions}
              <Button type="button" variant="outline" onClick={closeSheet} disabled={isSubmitting}>{readOnly ? 'Close' : cancelLabel}</Button>
              {saveButton}
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {leaveDialog}
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      {body}
      {leaveDialog}
      {confirmDialog}
    </>
  );
}
