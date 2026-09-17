import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import { useCreateTemplateMutation, useGetTemplatesByKeyQuery } from '@/api/messagesApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { MESSAGE_KEYS, TEMPLATE_VARIANTS, templateHref, variantValue } from '@/config/admin/messageKeys';
import { messageTemplateSchema } from '@/form/schemas/messageTemplate.schema';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { VariantEditor } from './sections/VariantEditor';

const LIST = '/admin/platform/message-templates';

const newFields = [
  { name: 'key', type: 'text', label: 'Key', required: true, placeholder: 'quotation_sent',
    description: 'The name the system sends this message by: lower-case letters, digits and underscores.' },
  { name: 'channel', type: 'select', label: 'Channel', required: true, span: 'half',
    options: [{ value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }] },
  { name: 'locale', type: 'select', label: 'Language', required: true, span: 'half',
    options: [{ value: 'en', label: 'English' }, { value: 'ne', label: 'नेपाली' }] },
  { name: 'subject', type: 'text', label: 'Subject (email)', maxLength: 250 },
  { name: 'body', type: 'textarea', label: 'Message', required: true, rows: 6, maxLength: 5000 },
  { name: 'isActive', type: 'switch', label: 'In use' },
];

function NewTemplate() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [create] = useCreateTemplateMutation();
  return (
    <PageTransition>
      <PageHeader title="New template" description="Most messages already have a key the system sends by — pick one from the list to add a version to it." />
      <div className="max-w-3xl rounded-xl border bg-background p-4 sm:p-6">
        <ResourceForm
          schema={messageTemplateSchema}
          fields={newFields}
          defaultValues={{ key: '', channel: 'sms', locale: 'en', subject: '', body: '', isActive: true }}
          onSubmit={async (body) => {
            const created = await create(body).unwrap();
            dispatch(toastSuccess('Template created'));
            navigate(templateHref(created.key), { replace: true, state: { variant: variantValue(created) } });
          }}
          submitLabel="Create template"
          onCancel={() => navigate(LIST)}
        />
      </div>
    </PageTransition>
  );
}

/**
 * `/admin/platform/message-templates/:key` (ADMIN) — one message in all its versions: SMS
 * and email, English and Nepali, each edited beside a live preview. `new` creates a template
 * under any key.
 */
export default function MessageTemplateEditPage() {
  const { key } = useParams();
  if (key === 'new') return <NewTemplate />;
  return <TemplateVersions key={key} templateKey={key} />;
}

function TemplateVersions({ templateKey }) {
  const { data: rows, isLoading, error, refetch } = useGetTemplatesByKeyQuery(templateKey);
  const known = MESSAGE_KEYS[templateKey];
  const find = (v) => rows?.find((r) => r.channel === v.channel && r.locale === v.locale);
  const firstWritten = useMemo(
    () => TEMPLATE_VARIANTS.find((v) => rows?.some((r) => r.channel === v.channel && r.locale === v.locale)),
    [rows],
  );
  const [tab, setTab] = useState(null);
  const active = tab ?? variantValue(firstWritten ?? TEMPLATE_VARIANTS[0]);

  let body;
  if (error) body = <ErrorState error={error} onRetry={refetch} />;
  else if (isLoading) body = <div className="space-y-3" aria-hidden><Skeleton className="h-9 w-80" /><Skeleton className="h-48" /></div>;
  else if (!rows.length && !known) {
    body = (
      <EmptyState
        title="No template with this key"
        description="The system does not send a message by this name."
        action={<Button asChild variant="outline"><Link to={templateHref('new')}>New template</Link></Button>}
      />
    );
  } else {
    body = (
      <Tabs value={active} onValueChange={setTab}>
        <TabsList aria-label="Versions" className="flex h-auto flex-wrap justify-start">
          {TEMPLATE_VARIANTS.map((v) => (
            <TabsTrigger key={variantValue(v)} value={variantValue(v)} lang={v.locale === 'ne' ? 'ne' : undefined}>
              {v.label}{find(v) ? '' : ' · not written'}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Only the open version is mounted, so one form holds the page's leave-guard. */}
        {TEMPLATE_VARIANTS.filter((v) => variantValue(v) === active).map((v) => (
          <TabsContent key={variantValue(v)} value={variantValue(v)} className="pt-4">
            <VariantEditor
              key={`${variantValue(v)}-${find(v)?.id ?? 'new'}`}
              templateKey={templateKey}
              channel={v.channel}
              locale={v.locale}
              record={find(v)}
              english={find({ channel: v.channel, locale: 'en' })}
            />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title={<span className="font-mono">{templateKey}</span>}
        description={known ? `${known.when} Goes to ${known.audience === 'customer' ? 'the customer, in their language' : 'staff, in English'}.` : undefined}
        actions={<Button asChild variant="outline"><Link to={LIST}><ArrowLeft aria-hidden /> All templates</Link></Button>}
      />
      <div className="rounded-xl border bg-background p-4 sm:p-6">{body}</div>
    </PageTransition>
  );
}
