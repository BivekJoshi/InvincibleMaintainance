import { useNavigate } from 'react-router-dom';
import { Clock, Ruler } from 'lucide-react';
import { useGetSurveyStageCountQuery, useGetSurveysQuery } from '@/api/surveysApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { SURVEY_STAGE_TABS, SURVEY_WAIT_WARN_HOURS } from '@/config/constants';
import { formatDate, formatDateTime, relativeTime } from '@/helpers/format';

const WAITING = ['SUBMITTED', 'IN_REVIEW'];

/** How long a submitted survey has waited for the office — flagged once it is too long. */
function Waiting({ survey }) {
  if (!WAITING.includes(survey.status) || !survey.submittedAt) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const hours = (Date.now() - new Date(survey.submittedAt).getTime()) / 3_600_000;
  const label = relativeTime(survey.submittedAt);
  return hours >= SURVEY_WAIT_WARN_HOURS ? (
    <StateBadge tone="warning" title={`Submitted ${formatDateTime(survey.submittedAt)}`}>
      <Clock className="mr-1 h-3 w-3" aria-hidden />{label}
    </StateBadge>
  ) : (
    <span className="whitespace-nowrap text-xs text-muted-foreground" title={`Submitted ${formatDateTime(survey.submittedAt)}`}>{label}</span>
  );
}

const columns = [
  {
    key: 'number', header: 'Survey', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-medium">{r.number}</p>
        <p className="truncate text-xs text-muted-foreground">{r.job?.number}</p>
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.customer?.name}</p>
        <a href={`tel:${r.customer?.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
          {r.customer?.phone}
        </a>
      </div>
    ),
  },
  { key: 'service', header: 'Service', cell: (r) => r.service?.name ?? <span className="text-muted-foreground">General</span> },
  { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
  { key: 'submittedAt', header: 'Waiting', sortable: true, cell: (r) => <Waiting survey={r} />, exportValue: (r) => r.submittedAt ?? '' },
  {
    // What the office needs at a glance: is there enough here to price?
    key: 'scope', header: 'Scope',
    cell: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        <Ruler className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        {r._count?.items ?? 0} line{(r._count?.items ?? 0) === 1 ? '' : 's'} · {r._count?.readings ?? 0} reading{(r._count?.readings ?? 0) === 1 ? '' : 's'}
      </span>
    ),
  },
  { key: 'surveyor', header: 'Surveyor', cell: (r) => r.surveyor?.user?.name ?? <span className="text-muted-foreground">Unassigned</span> },
  { key: 'visit', header: 'Visited', cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.job?.scheduledStart)}</span> },
  {
    key: 'quotation', header: 'Quotation',
    cell: (r) => (r.quotation
      ? <span className="font-mono text-xs">{r.quotation.number}</span>
      : <span className="text-xs text-muted-foreground">—</span>),
  },
  { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
];

function TabCount({ statuses }) {
  const { data } = useGetSurveyStageCountQuery(statuses.join(','));
  if (!data) return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">
      {data}
    </span>
  );
}

const EMPTY = {
  to_price: ['Nothing is waiting to be priced', 'A survey lands here when a surveyor submits it from the field.'],
  returned: ['Nothing is sent back', 'Surveys you send back for more detail wait here until the surveyor resubmits.'],
  in_field: ['No survey is in progress', 'A survey is in the field from the visit until the surveyor submits it.'],
  quoted: ['No survey has been quoted yet', 'Build a quotation from a submitted survey and it moves here.'],
  all: ['No surveys yet', 'A survey appears here once a surveyor starts one from the field.'],
};

/**
 * The site surveys, as work queues (`?stage=`). Whoever prices surveys opens on
 * "To price", oldest first; everyone else opens on All.
 */
export default function SurveysPage() {
  const { can } = useAuth();
  const defaultStage = can('quotations:write') || can('surveys:write') ? 'to_price' : 'all';
  const [params, setParams] = useListParams({ limit: 20, stage: defaultStage });
  const tab = SURVEY_STAGE_TABS.find((t) => t.value === params.stage) ?? SURVEY_STAGE_TABS.find((t) => t.value === defaultStage);
  const { stage: _stage, ...rest } = params;
  const query = {
    ...rest,
    ...(tab.statuses ? { status: tab.statuses.join(',') } : {}),
    ...(!rest.sort && tab.sort ? { sort: tab.sort } : {}),
  };
  const { data, isLoading, isFetching, error, refetch } = useGetSurveysQuery(query);
  const navigate = useNavigate();
  const [emptyTitle, emptyDescription] = EMPTY[tab.value];

  return (
    <PageTransition>
      <PageHeader
        title="Site surveys"
        description="What the surveyor measured on site, waiting to be priced."
      />

      <Tabs value={tab.value} onValueChange={(next) => setParams({ ...params, stage: next, sort: undefined, page: 1 })} className="mb-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max">
            {SURVEY_STAGE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                {t.label}
                {t.counted ? <TabCount statuses={t.statuses} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <CustomTable
        storageKey="surveys"
        exportable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={{ ...params, sort: query.sort }}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(`/admin/surveys/${row.id}`)}
        rowLabel={(row) => `${row.number} for ${row.customer?.name ?? 'a customer'}`}
        searchPlaceholder="Search number, customer, diagnosis…"
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </PageTransition>
  );
}
