import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, ClipboardCheck, Contact, UserRoundSearch } from 'lucide-react';
import {
  useGetQuotationQuery, useGetRateCardQuery, useUpdateQuotationMutation,
} from '@/api/quotationsApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { RecordHistory } from '@/components/common/RecordHistory';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useQuotationActions } from '@/hooks/useQuotationActions';
import { quotationFormSchema } from '@/form/schemas/quotation.schema';
import { QUOTATION_STATUS_LABELS } from '@/config/constants';
import { quotationActions, waitingFor } from '@/helpers/quotationActions';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { formatDate, formatDateTime, formatNpr } from '@/helpers/format';
import { QuotationActionBar } from './sections/QuotationActionBar';
import { QuotationNotices } from './sections/QuotationNotices';
import { SendPanel } from './sections/SendPanel';
import { VersionSwitcher } from './sections/VersionSwitcher';

const TABS = ['quotation', 'history'];

/** The builder's form, described as data. The lines are one `lineItems` field. */
const quotationFields = ({ rateCard, frozen }) => [
  { name: 'items', type: 'lineItems', label: 'Line items', rateCard, disabled: frozen, required: true },
  {
    type: 'group', label: 'Terms', variant: 'card', fields: [
      { name: 'discount', type: 'money', label: 'Discount', span: 'half' },
      { name: 'validUntil', type: 'date', label: 'Valid until', time: '23:59', span: 'half', description: 'The customer can answer until the end of this day.' },
      { name: 'vatApplied', type: 'switch', label: 'Apply VAT', span: 'half' },
      { name: 'terms', type: 'textarea', label: 'Terms shown to the customer', rows: 5 },
      { name: 'internalNote', type: 'textarea', label: 'Internal note', description: 'Staff only — never shown to the customer.', rows: 3 },
    ],
  },
];

function Row({ label, value, strong }) {
  return (
    <div className={strong ? 'flex items-center justify-between border-t pt-3 text-base font-semibold' : 'flex items-center justify-between'}>
      <span className={strong ? undefined : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums" data-testid={strong ? 'quotation-total' : undefined}>{value}</span>
    </div>
  );
}

/** Who moved it, when — the short version of the History tab. */
function Trail({ q }) {
  const rows = [
    ['Prepared', q.createdBy?.name, q.createdAt],
    q.submittedAt && ['Submitted', q.submittedBy?.name, q.submittedAt],
    q.approvedAt && ['Approved', q.autoApproved ? 'Automatically' : q.approvedBy?.name, q.approvedAt],
    q.sentAt && ['Sent', null, q.sentAt],
    q.decidedAt && ['Customer answered', QUOTATION_STATUS_LABELS[q.status], q.decidedAt],
  ].filter(Boolean);
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(([what, who, at]) => (
        <li key={what} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{what}</span>
          <span className="text-right">{who ? `${who} · ` : ''}{formatDateTime(at)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One quotation version: its lines and terms (editable only as a DRAFT, for
 * `quotations:write`), the action its state is waiting for, the customer's messages,
 * the link and its SMS/email, the versions, and the History tab.
 */
export default function QuotationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [search, setSearch] = useSearchParams();
  // ACCOUNTANT and DISPATCHER can reach this page on quotations:read alone.
  const { can, user } = useAuth();
  const canWrite = can('quotations:write');

  const { data: quotation, isLoading, error, refetch } = useGetQuotationQuery(id);
  const { data: rateCard } = useGetRateCardQuery({ limit: 100 }, { skip: !canWrite });
  const [update] = useUpdateQuotationMutation();
  const [runAction, actionDialogs] = useQuotationActions();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const onDirtyChange = useCallback((next) => setDirty(next), []);

  const frozen = quotation?.status !== 'DRAFT' || !canWrite;
  const fields = useMemo(() => quotationFields({ rateCard: rateCard?.items ?? [], frozen }), [rateCard, frozen]);

  const tab = TABS.includes(search.get('tab')) && can('quotations:history') ? search.get('tab') : 'quotation';
  const setTab = (next) => setSearch(next === 'quotation' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const q = quotation;
  const who = { can, userId: user?.id };
  const actions = quotationActions(q, who);

  const run = async (action) => {
    setBusy(true);
    try {
      await runAction(action, q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={`${q.number}${q.version > 1 ? ` · v${q.version}` : ''}`}
        description={`${q.customer?.name} · ${q.site?.address ?? q.customer?.phone}`}
        actions={(
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quotations')}>
            <ArrowLeft aria-hidden /> Quotations
          </Button>
        )}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={q.status} label={QUOTATION_STATUS_LABELS[q.status]} />
          {q.autoApproved ? <StateBadge tone="info">Auto-approved</StateBadge> : null}
          <VersionSwitcher quotation={q} />
          {q.survey && can('surveys:read') ? (
            <Link to={`/admin/surveys/${q.survey.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Built from {q.survey.number}
            </Link>
          ) : null}
          {q.customer && can('customers:read') ? (
            <Link to={`/admin/customers/${q.customer.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Contact className="h-3.5 w-3.5" aria-hidden /> Customer
            </Link>
          ) : null}
          {q.lead && can('leads:read') ? (
            <Link to={`/admin/leads/${q.lead.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <UserRoundSearch className="h-3.5 w-3.5" aria-hidden /> Lead · {q.lead.status}
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="waiting-for">{waitingFor(q, who)}</p>
      </PageHeader>

      <div className="mb-4">
        <QuotationActionBar
          actions={actions}
          busy={busy}
          onRun={run}
          blockedReason={dirty && q.status === 'DRAFT' ? 'Save your changes first.' : undefined}
        />
      </div>

      <QuotationNotices quotation={q} can={can} userId={user?.id} />

      <Tabs value={tab} onValueChange={setTab}>
        {can('quotations:history') ? (
          <TabsList className="mb-4">
            <TabsTrigger value="quotation">Quotation</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="quotation" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardContent className="p-4 sm:p-6">
                {!canWrite ? (
                  <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">You can read this quotation but not change it.</p>
                ) : frozen ? (
                  <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Only a draft is edited. {q.status === 'PENDING_APPROVAL' || q.status === 'OFFICE_APPROVED'
                      ? 'Send it back (or pull it back) to change it.'
                      : 'Revise it to change the figures and keep the history.'}
                  </p>
                ) : null}
                <ResourceForm
                  key={`${q.id}:${frozen}`}
                  schema={quotationFormSchema}
                  fields={fields}
                  defaultValues={q}
                  readOnly={frozen}
                  submitLabel="Save draft"
                  onDirtyChange={onDirtyChange}
                  onSubmit={async (body) => {
                    await update({ id: q.id, ...body }).unwrap();
                    dispatch(toastSuccess('Quotation saved', 'The totals have been worked out again.'));
                  }}
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Totals</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* The server's figures from the last save — the browser never computes VAT. */}
                  <Row label="Subtotal" value={formatNpr(q.subtotal)} />
                  <Row label="Discount" value={`− ${formatNpr(q.discount)}`} />
                  <Row label={`VAT ${q.vatApplied ? `(${q.vatRate}%)` : '(not applied)'}`} value={formatNpr(q.vatAmount)} />
                  <Row label="Total" value={formatNpr(q.total)} strong />
                  {dirty ? <p className="text-xs text-warning">Unsaved edits — save to recalculate.</p> : null}
                  {q.validUntil ? <p className="text-xs text-muted-foreground">Valid until {formatDate(q.validUntil)}</p> : null}
                </CardContent>
              </Card>
              <SendPanel quotation={q} />
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">So far</CardTitle></CardHeader>
                <CardContent><Trail q={q} /></CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {can('quotations:history') ? (
          <TabsContent value="history" className="mt-0">
            <RecordHistory endpoint={`/admin/quotations/${q.id}/history`} />
          </TabsContent>
        ) : null}
      </Tabs>

      {actionDialogs}
    </PageTransition>
  );
}
