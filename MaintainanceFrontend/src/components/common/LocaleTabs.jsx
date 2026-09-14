import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { useGetTranslationsQuery, useSaveTranslationsMutation } from '@/api/translationsApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { FieldGrid } from '@/components/common/ResourceForm/FieldRenderer';
import { applyServerErrors } from '@/components/common/ResourceForm/serverErrors';
import { useZodForm } from '@/form/useZodForm';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/** A translation is text; anything else a field might be is edited as a plain textarea. */
const TRANSLATABLE = new Set(['text', 'textarea', 'prose', 'markdown']);

function TranslationForm({ model, recordId, fields, sourceValues }) {
  const dispatch = useDispatch();
  const idPrefix = `ne-${useId().replace(/[^\w-]/g, '')}`;
  const { data, isLoading, error, refetch } = useGetTranslationsQuery({ model, recordId });
  const [save] = useSaveTranslationsMutation();

  const names = fields.map((f) => f.name);
  const namesKey = names.join(',');
  const schema = useMemo(
    () => z.object(Object.fromEntries(namesKey.split(',').map((n) => [n, z.string().max(20000, 'Keep it under 20,000 characters')]))),
    [namesKey],
  );
  const specs = useMemo(() => fields.map((f) => ({
    name: f.name,
    label: f.label,
    type: TRANSLATABLE.has(f.type) ? f.type : 'textarea',
    rows: f.rows,
    description: sourceValues?.[f.name] ? `English: ${String(sourceValues[f.name]).slice(0, 240)}` : 'No English copy yet.',
  })), [fields, sourceValues]);

  const values = Object.fromEntries(names.map((n) => [n, data?.[n]?.ne ?? '']));
  const valuesKey = JSON.stringify(values);
  const form = useZodForm(schema, { defaultValues: values });
  const dirty = useRef(false);
  dirty.current = form.formState.isDirty;
  const [focusField, setFocusField] = useState(null);
  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (!isSubmitting && focusField) {
      form.setFocus(focusField);
      setFocusField(null);
    }
  }, [isSubmitting, focusField, form]);

  // Loaded or refetched translations replace the fields, unless someone is mid-edit.
  useEffect(() => {
    if (!dirty.current) form.reset(JSON.parse(valuesKey));
  }, [valuesKey, form]);

  const submit = form.handleSubmit(async (next) => {
    try {
      await save({
        model,
        recordId,
        // An empty string deletes the translation, so the site falls back to English.
        values: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { ne: v.trim() }])),
      }).unwrap();
      form.reset(next);
      dispatch(toastSuccess('Nepali copy saved'));
    } catch (err) {
      const alert = applyServerErrors(err, form.setError, names, { mapPath: (p) => p.replace(/^values\./, '').replace(/\.ne$/, '') });
      setFocusField(alert.firstField);
      dispatch(toastError('Could not save the Nepali copy', alert.details?.[0] ?? alert.message));
    }
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) return <div className="space-y-3" aria-hidden><Skeleton className="h-9" /><Skeleton className="h-24" /></div>;

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="space-y-6">
        <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
          <FieldGrid fields={specs} idPrefix={idPrefix} />
        </fieldset>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          {form.formState.isDirty ? <p className="mr-auto text-xs text-muted-foreground">Unsaved Nepali changes</p> : null}
          <Button type="submit" loading={form.formState.isSubmitting}>Save Nepali copy</Button>
        </div>
      </form>
    </FormProvider>
  );
}

/**
 * English | Nepali tabs around a record's form.
 *
 * The English tab is the record itself (`children`, usually a `<ResourceForm>`). The
 * Nepali tab edits the `ne` translations of the listed text fields through
 * `/admin/translations`, with each field's English copy shown beneath it for
 * reference, and saves on its own button. A record needs an id before it can be
 * translated, so the tab is disabled until it has one. Both panels stay mounted, so
 * switching tabs never discards unsaved edits; the Nepali panel is `lang="ne"`,
 * which gives it the Devanagari font stack.
 *
 * @param {object} props
 * @param {string} props.model            Prisma model name, e.g. 'faq', 'service'
 * @param {string} [props.recordId]
 * @param {object[]} props.fields         field specs of the translatable fields
 * @param {object} [props.sourceValues]   the English record, for reference
 * @param {import('react').ReactNode} props.children
 */
export function LocaleTabs({ model, recordId, fields, sourceValues, children, className }) {
  const [tab, setTab] = useState('en');
  const canTranslate = Boolean(recordId);
  const active = canTranslate ? tab : 'en';

  return (
    <Tabs value={active} onValueChange={setTab} className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <TabsList aria-label="Language">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="ne" disabled={!canTranslate}>
            <span lang="ne">नेपाली</span>
          </TabsTrigger>
        </TabsList>
        {!canTranslate ? <p className="text-xs text-muted-foreground">Save this first, then add its Nepali version.</p> : null}
      </div>
      <TabsContent value="en" forceMount className="data-[state=inactive]:hidden">{children}</TabsContent>
      <TabsContent value="ne" forceMount lang="ne" className="data-[state=inactive]:hidden">
        {canTranslate ? <TranslationForm model={model} recordId={recordId} fields={fields} sourceValues={sourceValues} /> : null}
      </TabsContent>
    </Tabs>
  );
}
