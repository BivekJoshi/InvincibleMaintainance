import { useState } from 'react';
import {
  CheckCircle2, Circle, ClipboardList, HardHat, Hourglass, Package, Users,
} from 'lucide-react';
import { useGetJobPlanQuery } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { AdBsDate } from '@/components/common/AdBsDate';
import { AdvanceInvoiceLink } from '@/components/jobs/AdvanceNotice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardSkeleton } from '@/components/ui/skeleton';
import {
  advanceState, crewDays, crewVerdict, defaultCrewSize, formatQty,
} from '@/helpers/handoff';
import { formatBalance, formatDateTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** A short in-page table: every row on one page, no search, no paging controls. */
const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};

const qtyWithUnit = (qty, unit) => `${formatQty(qty)}${unit ? ` ${unit}` : ''}`;

const LINE_COLUMNS = [
  { key: 'number', header: 'No.', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
  {
    key: 'description', header: 'Item',
    cell: (r) => (
      <span className="block max-w-md">
        {r.description}
        {r.isProvisional ? <StateBadge tone="info" className="ml-2 align-middle text-[10px]">Provisional</StateBadge> : null}
      </span>
    ),
  },
  { key: 'quotedQty', header: 'Quoted', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyWithUnit(r.quotedQty, r.unit)}</span> },
];

const SECTION_COLUMNS = [
  { key: 'title', header: 'Section', cell: (r) => <span className="font-medium">{r.title || 'Without a section'}</span> },
  {
    key: 'count', header: 'Lines', className: 'text-right',
    cell: (r) => <span className="tabular-nums">{r.lines.length}</span>,
  },
  {
    key: 'provisional', header: 'Provisional', className: 'text-right',
    cell: (r) => {
      const n = r.lines.filter((l) => l.isProvisional).length;
      return n ? <span className="tabular-nums">{n}</span> : <span className="text-muted-foreground">—</span>;
    },
  },
];

const MATERIAL_COLUMNS = [
  {
    key: 'name', header: 'Material',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.name}</p>
        {r.code ? <p className="font-mono text-xs text-muted-foreground">{r.code}</p> : null}
      </div>
    ),
  },
  { key: 'qty', header: 'Need', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyWithUnit(r.qty, r.unit)}</span> },
  {
    key: 'packs', header: 'Packs', className: 'text-right',
    cell: (r) => (r.packs != null ? (
      <span className="whitespace-nowrap tabular-nums">
        {formatQty(r.packs)} {r.packLabel ?? 'packs'}
        {r.packSize ? <span className="block text-[11px] text-muted-foreground">of {qtyWithUnit(r.packSize, r.unit)}</span> : null}
      </span>
    ) : <span className="text-muted-foreground">—</span>),
  },
  { key: 'onHand', header: 'On hand', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyWithUnit(r.onHand ?? 0, r.unit)}</span> },
  {
    key: 'shortfall', header: 'Short', className: 'text-right',
    cell: (r) => (Number(r.shortfall) > 0 ? (
      <StateBadge tone="warning" className="tabular-nums" title="Buy or move stock before the job starts">
        <span data-testid={`shortfall-${r.materialId ?? r.id}`}>Short {qtyWithUnit(r.shortfall, r.unit)}</span>
      </StateBadge>
    ) : <span className="text-xs text-success">In stock</span>),
  },
];

const LABOUR_COLUMNS = [
  {
    key: 'name', header: 'Trade',
    cell: (r) => (
      <span>
        {r.name}
        {r.code ? <span className="ml-2 font-mono text-xs text-muted-foreground">{r.code}</span> : null}
      </span>
    ),
  },
  { key: 'days', header: 'Labour days', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatQty(r.days)}</span> },
];

function SectionCard({ icon: Icon, title, description, id, children, aside }) {
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle id={id} className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" aria-hidden /> {title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {aside}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

/** The hand-off checklist from the server's `readiness[]` — advance, BOQ, materials, crew, schedule, site. */
function Readiness({ items }) {
  const done = items.filter((r) => r.done).length;
  return (
    <SectionCard
      id="plan-readiness"
      icon={ClipboardList}
      title="Hand-off checklist"
      description="What the job needs before the crew goes to site."
      aside={<StateBadge tone={done === items.length ? 'success' : 'warning'}>{done} of {items.length} ready</StateBadge>}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((r) => (
          <li
            key={r.key}
            data-testid={`ready-${r.key}`}
            data-done={r.done ? 'true' : 'false'}
            className={cn('flex items-start gap-2 rounded-md border p-2.5', r.done ? 'bg-muted/30' : 'surface-warning')}
          >
            {r.done
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              : <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span className="min-w-0">
              <span className="block font-medium">{r.label}<span className="sr-only">{r.done ? ' — done' : ' — not yet'}</span></span>
              {r.detail ? <span className="block text-xs opacity-80">{r.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function AdvancePanel({ advance }) {
  const state = advanceState(advance);
  if (!state) {
    return <p className="text-muted-foreground">No advance on this job — its quotation asked for none, so nothing holds it.</p>;
  }
  const { invoice } = advance;
  return (
    <div className="space-y-2">
      <StateBadge tone={state.tone === 'muted' ? 'muted' : state.tone}>{state.title}</StateBadge>
      {invoice ? (
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Invoice</dt><dd><AdvanceInvoiceLink invoice={invoice} /></dd></div>
          <div><dt className="text-muted-foreground">Still to pay</dt><dd className="font-medium tabular-nums">{formatBalance(invoice.balance)}</dd></div>
          <div><dt className="text-muted-foreground">Due</dt><dd><AdBsDate iso={invoice.dueDate} /></dd></div>
        </dl>
      ) : null}
      {advance.override ? (
        <p className="text-xs text-muted-foreground">
          Overridden by {advance.override.by?.name ?? 'someone no longer listed'}{advance.override.at ? ` on ${formatDateTime(advance.override.at)}` : ''}: “{advance.override.reason}”
        </p>
      ) : null}
    </div>
  );
}

/**
 * The crew plan: labour days by trade (the take-off, quantities only — L-D4), a crew size that starts at the people
 * assigned (else two), and the duration — **total labour days ÷ crew, rounded up** (`helpers/handoff#crewDays`) —
 * against the job's planned days. The foreman is the lead technician. Days, not money: nothing here is priced.
 */
function CrewPlan({ plan }) {
  const [typed, setTyped] = useState(null);
  const size = typed == null ? defaultCrewSize(plan) : Math.floor(Number(typed));
  const valid = size >= 1 && size <= 100;
  const duration = valid ? crewDays(plan.labourDays, size) : 0;
  const verdict = crewVerdict(duration, plan.job?.plannedDays);
  const labour = plan.labour ?? [];
  const lead = plan.crew?.lead;
  const people = plan.crew?.technicians ?? [];

  return (
    <SectionCard
      id="plan-crew"
      icon={Users}
      title="Crew plan"
      description="Labour days from the quotation’s take-off, shared by the crew."
    >
      <CustomTable
        columns={LABOUR_COLUMNS}
        data={labour}
        meta={onePage(labour)}
        params={{}}
        onParamsChange={noop}
        searchable={false}
        pageSizes={[]}
        rowLabel={(r) => r.name}
        emptyTitle="No labour on the take-off"
      />
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="crew-size">Crew size</Label>
          <Input
            id="crew-size"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={1}
            className="w-24"
            value={typed ?? String(defaultCrewSize(plan))}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby="crew-duration"
            aria-invalid={valid ? undefined : true}
          />
        </div>
        <p id="crew-duration" aria-live="polite" className="text-sm">
          {valid ? (
            <>
              <span className="tabular-nums">{formatQty(plan.labourDays ?? 0)}</span> labour days ÷ <span className="tabular-nums">{size}</span> {size === 1 ? 'person' : 'people'} ={' '}
              <strong data-testid="crew-duration" className="tabular-nums">{duration} day{duration === 1 ? '' : 's'}</strong> on site
              <span className="text-muted-foreground"> (rounded up)</span>
            </>
          ) : <span className="text-destructive">Enter a crew of 1 to 100 people.</span>}
        </p>
      </div>
      <p data-testid="crew-verdict" className={cn('text-sm', verdict.tone === 'warning' && 'font-medium text-warning', verdict.tone === 'success' && 'text-success')}>
        {verdict.text}
      </p>
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium" data-testid="crew-foreman">
          <HardHat className="h-4 w-4 text-primary" aria-hidden />
          {lead ? <>Foreman: {lead.name}</> : 'No foreman yet — the lead technician is the foreman once the crew is assigned.'}
        </p>
        {people.length ? (
          <p className="text-xs text-muted-foreground">
            On the job: {people.map((t) => `${t.name}${t.isLead ? ' (lead)' : ''}`).join(', ')}
          </p>
        ) : <p className="text-xs text-muted-foreground">Nobody is assigned yet — the calculator starts from a crew of two.</p>}
      </div>
    </SectionCard>
  );
}

/**
 * The **Plan** tab (Phase L6.4) — only on a BOQ job, one whose accepted quotation became job lines. A hand-off
 * checklist from `GET /admin/jobs/:id/plan` (`jobs:read`; quantities only, never a rate — L-D4): the readiness items,
 * the advance with its invoice, the BOQ as imported (lines grouped by section, each section opens), the materials
 * needed against stock with the shortfall, and the crew plan. Every figure is the server's but the crew
 * calculator's division of days.
 *
 * @param {{ job: { id: string } }} props
 */
export function JobPlanTab({ job }) {
  const { data: plan, isLoading, error, refetch } = useGetJobPlanQuery(job.id);

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!plan?.lineCount) {
    return <EmptyState title="No plan on this job" description="Only a job made from an accepted bill of quantities has one." />;
  }

  const sections = (plan.sections ?? []).map((s, i) => ({ ...s, id: `section-${i}`, lines: s.lines ?? [] }));
  const materials = plan.materials ?? [];
  const short = materials.filter((m) => Number(m.shortfall) > 0).length;

  return (
    <div className="space-y-4" data-testid="job-plan">
      {plan.readiness?.length ? <Readiness items={plan.readiness} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard id="plan-advance" icon={Hourglass} title="Advance" description="The job is scheduled once the advance is paid.">
          <AdvancePanel advance={plan.advance} />
        </SectionCard>

        <SectionCard
          id="plan-boq"
          icon={ClipboardList}
          title="Bill of quantities imported"
          description={`${plan.lineCount} line${plan.lineCount === 1 ? '' : 's'} from the accepted quotation, in ${sections.length} section${sections.length === 1 ? '' : 's'}. Open a section for its lines.`}
        >
          <CustomTable
            columns={SECTION_COLUMNS}
            data={sections}
            meta={onePage(sections)}
            params={{}}
            onParamsChange={noop}
            searchable={false}
            pageSizes={[]}
            rowLabel={(r) => r.title || 'Without a section'}
            expandable={{
              render: (s) => (
                <CustomTable
                  columns={LINE_COLUMNS}
                  data={s.lines}
                  meta={onePage(s.lines)}
                  params={{}}
                  onParamsChange={noop}
                  searchable={false}
                  pageSizes={[]}
                  rowLabel={(l) => `${l.number} ${l.description}`}
                  emptyTitle="No lines in this section"
                />
              ),
            }}
            emptyTitle="No sections"
          />
        </SectionCard>
      </div>

      <SectionCard
        id="plan-materials"
        icon={Package}
        title="Materials needed vs stock"
        description="The take-off’s quantities, in packs where the material is bought by the pack, against what the store holds now."
        aside={short
          ? <StateBadge tone="warning">{short} short</StateBadge>
          : materials.length ? <StateBadge tone="success">All in stock</StateBadge> : null}
      >
        <CustomTable
          columns={MATERIAL_COLUMNS}
          data={materials}
          meta={onePage(materials)}
          params={{}}
          onParamsChange={noop}
          searchable={false}
          pageSizes={[]}
          rowLabel={(r) => r.name}
          emptyTitle="No materials on the take-off"
        />
      </SectionCard>

      <CrewPlan plan={plan} />
    </div>
  );
}
