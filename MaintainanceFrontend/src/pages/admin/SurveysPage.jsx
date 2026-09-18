import { useNavigate } from 'react-router-dom';
import {
  Calculator, ClipboardList, Clock, FileCheck2, Gauge, HardHat, Layers, Ruler, Undo2, UserX,
} from 'lucide-react';
import { useGetSurveyStageCountQuery, useGetSurveysQuery } from '@/api/surveysApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { SURVEY_STAGE_TABS, SURVEY_WAIT_WARN_HOURS } from '@/config/constants';
import { formatDate, formatDateTime, initials, relativeTime, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** Each status's colour, a theme variable — the same one its queue uses. */
const STATUS_TONES = {
  DRAFT: '--info',
  SUBMITTED: '--warning',
  IN_REVIEW: '--gold',
  RETURNED: '--destructive',
  QUOTED: '--success',
  CANCELLED: '--muted-foreground',
};
const STATUS_LABELS = {
  DRAFT: 'In the field', SUBMITTED: 'Submitted', IN_REVIEW: 'In review', RETURNED: 'Sent back', QUOTED: 'Quoted', CANCELLED: 'Cancelled',
};
const tone = (cssVar) => ({ '--tone': `var(${cssVar})` });

/** Each queue's look, and what it is for — shown under the tabs for the open one. */
const QUEUE_LOOK = {
  in_field: { icon: HardHat, tone: '--info', blurb: 'Visited, still being measured. A survey leaves here when the surveyor submits it.' },
  to_price: { icon: Calculator, tone: '--warning', blurb: `Oldest first. Anything waiting over ${SURVEY_WAIT_WARN_HOURS} hours is flagged — price it before the customer cools.` },
  returned: { icon: Undo2, tone: '--destructive', blurb: 'Sent back for more detail. It returns to To price when the surveyor resubmits.' },
  quoted: { icon: FileCheck2, tone: '--success', blurb: 'Priced and turned into a quotation.' },
  all: { icon: Layers, tone: '--primary', blurb: 'Every survey, whatever its stage.' },
};

/** The queues in the order a survey moves through them, with All last. */
const QUEUE_ORDER = ['in_field', 'to_price', 'returned', 'quoted', 'all'];

function StatusPill({ status }) {
  return (
    <span
      style={tone(STATUS_TONES[status] ?? '--muted-foreground')}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[hsl(var(--tone)/0.12)] px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-[hsl(var(--tone)/0.25)]"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone))]" />
      {STATUS_LABELS[status] ?? titleCase(status)}
    </span>
  );
}

const WAITING = ['SUBMITTED', 'IN_REVIEW'];

/**
 * How long a submitted survey has waited for the office — flagged once it is too long — with
 * a meter filling towards that limit.
 */
function Waiting({ survey }) {
  if (!WAITING.includes(survey.status) || !survey.submittedAt) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const hours = (Date.now() - new Date(survey.submittedAt).getTime()) / 3_600_000;
  const label = relativeTime(survey.submittedAt);
  const late = hours >= SURVEY_WAIT_WARN_HOURS;
  const ratio = Math.min(1, hours / SURVEY_WAIT_WARN_HOURS);
  return (
    <div className="w-28 space-y-1">
      {late ? (
        <StateBadge tone="warning" title={`Submitted ${formatDateTime(survey.submittedAt)}`}>
          <Clock className="mr-1 h-3 w-3" aria-hidden />{label}
        </StateBadge>
      ) : (
        <span className="block whitespace-nowrap text-xs text-muted-foreground" title={`Submitted ${formatDateTime(survey.submittedAt)}`}>{label}</span>
      )}
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn('h-full rounded-full', late ? 'bg-destructive' : ratio >= 0.5 ? 'bg-warning' : 'bg-success')}
          style={{ width: `${Math.max(6, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Someone's initials in a circle; the caller sets its colour. */
function Initials({ name, className }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full font-bold', className)}>
      {initials(name)}
    </span>
  );
}

const columns = [
  {
    key: 'number', header: 'Survey', sortable: true,
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-2.5" style={tone(STATUS_TONES[r.status] ?? '--primary')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--tone)/0.12)] text-[hsl(var(--tone))]">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold">{r.number}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{r.job?.number}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Initials name={r.customer?.name} className="h-8 w-8 bg-primary/10 text-[11px] text-primary" />
        <div className="min-w-0">
          <p className="truncate font-medium">{r.customer?.name}</p>
          <a href={`tel:${r.customer?.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs tabular-nums text-muted-foreground hover:text-primary hover:underline">
            {r.customer?.phone}
          </a>
        </div>
      </div>
    ),
  },
  { key: 'service', header: 'Service', cell: (r) => r.service?.name ?? <span className="text-muted-foreground">General</span> },
  { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusPill status={r.status} />, exportValue: (r) => STATUS_LABELS[r.status] ?? r.status },
  { key: 'submittedAt', header: 'Waiting', sortable: true, cell: (r) => <Waiting survey={r} />, exportValue: (r) => r.submittedAt ?? '' },
  {
    // What the office needs at a glance: is there enough here to price?
    key: 'scope', header: 'Scope',
    cell: (r) => {
      const lines = r._count?.items ?? 0;
      const readings = r._count?.readings ?? 0;
      const chip = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums';
      return (
        <span className="inline-flex gap-1.5 whitespace-nowrap">
          <span className={cn(chip, lines ? 'bg-primary/10 text-foreground' : 'bg-muted text-muted-foreground')}>
            <Ruler className="h-3 w-3" aria-hidden />{lines} line{lines === 1 ? '' : 's'}
          </span>
          <span className={cn(chip, readings ? 'bg-info/10 text-foreground' : 'bg-muted text-muted-foreground')}>
            <Gauge className="h-3 w-3" aria-hidden />{readings} reading{readings === 1 ? '' : 's'}
          </span>
        </span>
      );
    },
  },
  {
    key: 'surveyor', header: 'Surveyor',
    cell: (r) => (r.surveyor?.user?.name ? (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <Initials name={r.surveyor.user.name} className="h-6 w-6 bg-info/15 text-[10px] text-info" />
        {r.surveyor.user.name}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning-border px-2 py-0.5 text-xs text-warning-foreground">
        <UserX className="h-3 w-3" aria-hidden /> Unassigned
      </span>
    )),
  },
  { key: 'visit', header: 'Visited', cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.job?.scheduledStart)}</span> },
  {
    key: 'quotation', header: 'Quotation',
    cell: (r) => (r.quotation ? (
      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-xs text-foreground ring-1 ring-inset ring-success/25">
        <FileCheck2 className="h-3 w-3 text-success" aria-hidden />{r.quotation.number}
      </span>
    ) : <span className="text-xs text-muted-foreground">—</span>),
  },
  { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
];

function TabCount({ statuses }) {
  const { data } = useGetSurveyStageCountQuery(statuses.join(','));
  if (!data) return null;
  return (
    <span className="ml-auto rounded-full bg-[hsl(var(--tone))] px-2 text-[11px] font-bold leading-5 text-primary-foreground tabular-nums">
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

      <Tabs value={tab.value} onValueChange={(next) => setParams({ ...params, stage: next, sort: undefined, page: 1 })} className="mb-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <TabsList className="grid h-auto w-full min-w-[40rem] grid-cols-5 gap-2 bg-transparent p-0">
            {QUEUE_ORDER.map((value) => SURVEY_STAGE_TABS.find((t) => t.value === value)).filter(Boolean).map((t, i) => {
              const look = QUEUE_LOOK[t.value];
              const Icon = look.icon;
              return (
                <TabsTrigger
                  key={t.value} value={t.value} style={tone(look.tone)}
                  className={cn(
                    'group relative flex h-auto items-center justify-start gap-2.5 overflow-hidden rounded-2xl border bg-card px-3 py-3 text-left shadow-[var(--elevation-1)] transition-all motion-reduce:transition-none',
                    'hover:border-[hsl(var(--tone)/0.4)] data-[state=active]:border-[hsl(var(--tone)/0.55)] data-[state=active]:bg-[hsl(var(--tone)/0.08)] data-[state=active]:shadow-[var(--elevation-2)]',
                  )}
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[hsl(var(--tone))] opacity-0 transition-opacity group-data-[state=active]:opacity-100" />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--tone)/0.14)] text-[hsl(var(--tone))] transition-colors group-data-[state=active]:bg-[hsl(var(--tone))] group-data-[state=active]:text-primary-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    {t.value !== 'all' ? <span aria-hidden className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step {i + 1}</span> : null}
                    <span className="block whitespace-nowrap text-sm font-semibold text-foreground">{t.label}</span>
                  </span>
                  {t.counted ? <TabCount statuses={t.statuses} /> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>

      <p
        style={tone(QUEUE_LOOK[tab.value].tone)}
        className="mb-4 flex items-center gap-2 rounded-xl border border-dotted border-[hsl(var(--tone)/0.4)] bg-[hsl(var(--tone)/0.05)] px-3 py-2 text-xs text-muted-foreground"
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--tone))]" />
        <span><span className="font-semibold text-foreground">{tab.label}:</span> {QUEUE_LOOK[tab.value].blurb}</span>
      </p>

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
