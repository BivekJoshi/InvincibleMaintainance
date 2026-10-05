import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import { useGetJobsQuery } from '@/api/jobsApi';
import { useCreateInvoiceFromJobMutation, useGetFinalBillQuery } from '@/api/financeApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { invoiceFromJobFormSchema } from '@/form/schemas/finance.schema';
import { JOB_STATUS_LABELS } from '@/config/constants';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { billingRuleOf } from '@/helpers/finance';
import { formatDate } from '@/helpers/format';
import { FinalBillPreview } from './FinalBillPreview';

/** A job's billing rule as a chip, with the one line that says what it means. */
function BillsChip({ job }) {
  const rule = billingRuleOf(job);
  const Icon = rule.kind === 'quotation' ? FileText : Package;
  return (
    <div className="min-w-0" data-testid="bills">
      <StateBadge tone={rule.kind === 'quotation' ? 'info' : 'warning'}>
        <Icon className="mr-1 h-3 w-3" aria-hidden />{rule.label}
      </StateBadge>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{rule.detail}</p>
    </div>
  );
}

const JOB_COLUMNS = [
  {
    key: 'number', header: 'Job',
    cell: (r) => (
      <div className="min-w-0 max-w-[14rem]">
        <p className="font-mono text-xs text-muted-foreground">{r.number}</p>
        <p className="truncate font-medium">{r.title}</p>
      </div>
    ),
  },
  { key: 'customer', header: 'Customer', cell: (r) => <span className="line-clamp-1 max-w-[10rem]">{r.customer?.name}</span> },
  {
    key: 'status', header: 'Finished',
    cell: (r) => (
      <span className="whitespace-nowrap text-xs">
        {JOB_STATUS_LABELS[r.status] ?? r.status}
        <span className="block text-muted-foreground">{formatDate(r.actualEnd ?? r.updatedAt)}</span>
      </span>
    ),
  },
  { key: 'bills', header: 'Bills', cell: (r) => <BillsChip job={r} /> },
];

const DUE_FIELD = { name: 'dueDate', type: 'date', label: 'Due on', description: 'The payment term from the settings, when left empty.' };

/** A quoted job bills its quotation as accepted — lines, discount and VAT — so only the due date is asked. */
const QUOTED_FIELDS = [DUE_FIELD];

/** An unquoted job bills what it used: which of it, the VAT choice and any discount. */
const ACTUAL_FIELDS = [
  { name: 'includeMaterials', type: 'switch', label: 'Bill the materials', description: 'Billable materials issued to the job, at the rate they were issued at.', span: 'half' },
  { name: 'includeLabour', type: 'switch', label: 'Bill the labour', description: 'The logged hours, at the rate card’s labour rate.', span: 'half' },
  { name: 'vatApplied', type: 'switch', label: 'Charge VAT', span: 'half' },
  { name: 'discount', type: 'money', label: 'Discount', span: 'half' },
  DUE_FIELD,
];
const ACTUAL_DEFAULTS = { includeMaterials: true, includeLabour: true, vatApplied: true };

/**
 * "Create from job" (Phase I): picks a finished, billable job no invoice has taken yet (`GET /admin/jobs?invoiced=false`)
 * and shows **how it will be billed** — its quotation as accepted, or what it used (materials and labour) — then makes
 * the draft (`POST /admin/invoices/from-job/:jobId`). A quoted job is never sent `includeMaterials` / `includeLabour`
 * (the API answers 422 QUOTED_JOB_BILLS_SCOPE); extra work is a manual invoice.
 *
 * Phase L8: a quoted job's **final bill preview** comes first — `GET /admin/jobs/:id/final-bill`. On a BOQ job
 * (`boq: true`) the sheet shows `FinalBillPreview` (the server's lines, deductions and totals) and what blocks it; while
 * anything does, it cannot be created. Only the due date is sent. A job without BOQ lines (`boq: false`) bills as Phase I
 * says. `job` opens the sheet on that job (the job page's "Raise final bill…"), with no list to go back to.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, onCreated?: (invoice: object) => void, job?: object }} props
 */
export function InvoiceFromJobSheet({ open, onOpenChange, onCreated, job: fixedJob = null }) {
  const dispatch = useDispatch();
  const [params, setParams] = useState({ page: 1, limit: 10 });
  const [picked, setJob] = useState(null);
  const job = fixedJob ?? picked;
  const { data, isLoading, isFetching, error, refetch } = useGetJobsQuery(
    { ...params, invoiced: 'false', sort: '-updatedAt' },
    { skip: !open || Boolean(fixedJob) },
  );
  const [createFromJob] = useCreateInvoiceFromJobMutation();
  const quoted = billingRuleOf(job).kind === 'quotation';
  // Phase L8: a quoted job may be a BOQ job, billed by its contract type less its stage bills — the server's preview.
  const final = useGetFinalBillQuery(job?.id, { skip: !open || !job || !quoted });
  const boq = Boolean(final.data?.boq);
  const blocked = boq && (final.data.blocking ?? []).length > 0;

  const close = (next) => {
    if (!next) setJob(null);
    onOpenChange(next);
  };

  const create = async (body) => {
    const request = quoted ? { dueDate: body.dueDate } : body;
    let invoice;
    try {
      invoice = await createFromJob({ jobId: job.id, ...request }).unwrap();
    } catch (err) {
      // The preview may be out of date (a measurement reopened, a bill voided): ask again, and show why.
      if (boq) final.refetch();
      throw err;
    }
    dispatch(toastSuccess(
      boq ? `Final bill ${invoice.number} drafted` : `Draft ${invoice.number} created`,
      'Check it, then send it to the customer.',
    ));
    close(false);
    onCreated?.(invoice);
  };

  const quotedForm = (
    <ResourceForm
      key={job?.id}
      schema={invoiceFromJobFormSchema}
      fields={QUOTED_FIELDS}
      defaultValues={{}}
      submitLabel={boq ? 'Create final bill (draft)' : 'Create draft invoice'}
      guard={false}
      onCancel={() => close(false)}
      onSubmit={create}
    />
  );

  let billing = null;
  if (job && quoted) {
    if (final.isLoading) billing = <CardSkeleton />;
    else if (final.error) billing = <ErrorState error={final.error} onRetry={final.refetch} />;
    else if (boq) {
      billing = (
        <div className="space-y-5">
          <FinalBillPreview preview={final.data} jobId={job.id} />
          {blocked ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="button" disabled title="Clear what stops it first">Create final bill (draft)</Button>
            </div>
          ) : quotedForm}
        </div>
      );
    } else billing = quotedForm;
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{job ? `${boq ? 'Final bill for' : 'Invoice'} ${job.number}` : 'Create an invoice from a job'}</SheetTitle>
          <SheetDescription>
            {job
              ? `${job.title} · ${job.customer?.name ?? ''}`
              : 'Finished, billable jobs no invoice has taken yet. A quoted job bills its quotation; any other job, what it used.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {job ? (
            <div className="space-y-5">
              {!fixedJob ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setJob(null)}><ArrowLeft aria-hidden /> Pick another job</Button>
              ) : null}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="billing-rule">
                <BillsChip job={job} />
                <p className="mt-2 text-muted-foreground">
                  {boq
                    ? 'Its final bill: the contract by its type, less every advance and running bill. The figures below are the server’s — exactly what the draft will say.'
                    : quoted
                      ? 'Its lines, discount and VAT are the quotation’s, as the customer accepted it. Extra work goes on a separate invoice.'
                      : 'Its lines are what the job used. Nothing recorded? It starts with one line to price by hand while it is a draft.'}
                </p>
              </div>
              {quoted ? billing : (
                <ResourceForm
                  key={job.id}
                  schema={invoiceFromJobFormSchema}
                  fields={ACTUAL_FIELDS}
                  defaultValues={ACTUAL_DEFAULTS}
                  submitLabel="Create draft invoice"
                  guard={false}
                  onCancel={() => close(false)}
                  onSubmit={create}
                />
              )}
            </div>
          ) : (
            <CustomTable
              columns={JOB_COLUMNS}
              data={data?.items}
              meta={data?.meta}
              params={params}
              onParamsChange={setParams}
              isLoading={isLoading}
              isFetching={isFetching}
              error={error}
              refetch={refetch}
              onRowClick={setJob}
              rowLabel={(r) => `${r.number} ${r.title}`}
              searchPlaceholder="Search job number, title or customer…"
              pageSizes={[10, 20]}
              emptyTitle="Nothing waiting to be invoiced"
              emptyDescription="A job shows here once it is completed and billable, until it is invoiced."
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
