import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Trash2 } from 'lucide-react';
import { useCreateTemplateMutation, useDeleteTemplateMutation, useUpdateTemplateMutation } from '@/api/messagesApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { messageTemplateSchema } from '@/form/schemas/messageTemplate.schema';
import { placeholdersIn } from '@/config/admin/messageKeys';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { PreviewPanel } from './PreviewPanel';

const smsFields = [
  { name: 'body', type: 'textarea', label: 'Message', required: true, rows: 6, maxLength: 5000 },
  { name: 'isActive', type: 'switch', label: 'In use', description: 'Off: this version is skipped (a Nepali one falls back to English).' },
];
const emailFields = [
  { name: 'subject', type: 'text', label: 'Subject', maxLength: 250 },
  { name: 'body', type: 'textarea', label: 'Message', required: true, rows: 10, maxLength: 5000 },
  smsFields[1],
];

/**
 * One version of a message — a channel in a language — with the live preview beside it.
 * A version not written yet is created on save.
 *
 * @param {{ templateKey: string, channel: 'sms'|'email', locale: 'en'|'ne', record?: object, english?: object }} props
 */
export function VariantEditor({ templateKey, channel, locale, record, english }) {
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [create] = useCreateTemplateMutation();
  const [update] = useUpdateTemplateMutation();
  const [remove, { isLoading: removing }] = useDeleteTemplateMutation();
  const [values, setValues] = useState({});
  const schema = useMemo(() => messageTemplateSchema.pick({ subject: true, body: true, isActive: true }), []);
  const englishPlaceholders = useMemo(
    () => (locale === 'ne' && english ? placeholdersIn(english.subject, english.body) : []),
    [locale, english],
  );

  const submit = async (body) => {
    if (record) {
      await update({ id: record.id, ...body }).unwrap();
      dispatch(toastSuccess('Template saved'));
    } else {
      await create({ key: templateKey, channel, locale, ...body }).unwrap();
      dispatch(toastSuccess('Template created', 'The system uses it from the next message on.'));
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this version?',
      description: locale === 'ne'
        ? 'Customers who read Nepali get the English version instead.'
        : 'The system goes back to its own built-in English words for this message.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove(record.id).unwrap();
      dispatch(toastSuccess('Version deleted'));
    } catch (err) {
      dispatch(toastError('Could not delete it', err?.data?.error?.message));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div lang={locale === 'ne' ? 'ne' : undefined}>
        {!record ? (
          <p className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {locale === 'ne' && english
              ? 'Not written yet — customers who read Nepali get the English version. Write it here.'
              : 'Not written yet — the system uses its own words. Write it here.'}
          </p>
        ) : null}
        <ResourceForm
          schema={schema}
          fields={channel === 'email' ? emailFields : smsFields}
          defaultValues={record ?? { subject: '', body: '', isActive: true }}
          onSubmit={submit}
          submitLabel={record ? 'Save' : 'Create this version'}
          onValuesChange={setValues}
          extraActions={record ? (
            <Button type="button" variant="outline" onClick={onDelete} loading={removing} className="mr-auto text-destructive hover:text-destructive">
              <Trash2 aria-hidden /> Delete
            </Button>
          ) : null}
        />
      </div>
      <aside aria-label="Preview" className="rounded-xl border bg-muted/20 p-4">
        <PreviewPanel
          templateId={record?.id}
          channel={channel}
          locale={locale}
          values={values}
          englishPlaceholders={englishPlaceholders}
        />
      </aside>
      {confirmDialog}
    </div>
  );
}
