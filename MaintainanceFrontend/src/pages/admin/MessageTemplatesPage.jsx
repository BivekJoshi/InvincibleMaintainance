import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useGetTemplateGroupsQuery } from '@/api/messagesApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { MESSAGE_KEYS, TEMPLATE_VARIANTS, templateHref } from '@/config/admin/messageKeys';

/** One chip per variant: written and in use, written but off, or not written. */
function VariantChips({ group }) {
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Versions">
      {TEMPLATE_VARIANTS.map((v) => {
        const found = group.variants.find((x) => x.channel === v.channel && x.locale === v.locale);
        const tone = !found ? 'muted' : found.isActive ? 'success' : 'warning';
        const state = !found ? 'not written' : found.isActive ? 'in use' : 'switched off';
        return (
          <li key={v.label}>
            <StateBadge tone={tone} title={`${v.label}: ${state}`} className={found ? undefined : 'opacity-60'}>
              <span lang={v.locale === 'ne' ? 'ne' : undefined}>{v.label}</span>
              <span className="sr-only">: {state}</span>
            </StateBadge>
          </li>
        );
      })}
    </ul>
  );
}

const columns = [
  {
    key: 'key', header: 'Message',
    cell: (g) => (
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium">{g.key}</p>
        <p className="max-w-[420px] text-xs text-muted-foreground">{MESSAGE_KEYS[g.key]?.when ?? 'Not sent by the system itself.'}</p>
      </div>
    ),
  },
  {
    key: 'audience', header: 'To',
    cell: (g) => (MESSAGE_KEYS[g.key]?.audience === 'customer' ? 'Customer' : MESSAGE_KEYS[g.key] ? 'Staff' : '—'),
  },
  { key: 'variants', header: 'Versions', cell: (g) => <VariantChips group={g} /> },
];

const filters = [
  { key: 'channel', label: 'Channel', type: 'enum', allLabel: 'SMS and email', options: [{ value: 'sms', label: 'Has an SMS' }, { value: 'email', label: 'Has an email' }] },
];

/**
 * `/admin/platform/message-templates` (ADMIN) — the words of every SMS and email, one row per
 * message with its English and Nepali, SMS and email versions.
 */
export default function MessageTemplatesPage() {
  const [params, setParams] = useListParams({ limit: 50 });
  const { data, isLoading, isFetching, error, refetch } = useGetTemplateGroupsQuery(params);
  const navigate = useNavigate();

  return (
    <PageTransition>
      <PageHeader
        title="Message templates"
        description="The words of every SMS and email. Customers get their own language; a missing Nepali version falls back to English."
        actions={<Button asChild><Link to={templateHref('new')}><Plus aria-hidden /> New template</Link></Button>}
      />
      <DataTable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        getRowId={(g) => g.key}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(g) => navigate(templateHref(g.key))}
        rowLabel={(g) => g.key}
        filters={filters}
        searchPlaceholder="Key or words in a message…"
        emptyTitle="No templates match"
        emptyDescription="Without a template, a message goes out in the system's own English words."
      />
    </PageTransition>
  );
}
