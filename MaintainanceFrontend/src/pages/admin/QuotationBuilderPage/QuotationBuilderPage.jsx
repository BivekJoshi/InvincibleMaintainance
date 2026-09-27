import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft, ClipboardCheck, Contact, FileSpreadsheet, Phone, Printer, UserRoundSearch,
} from 'lucide-react';
import { useGetQuotationQuery, useLazyExportQuotationXlsxQuery, useUpdateQuotationMutation } from '@/api/quotationsApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { RecordHistory } from '@/components/common/RecordHistory';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useQuotationActions } from '@/hooks/useQuotationActions';
import { quotationFormSchema } from '@/form/schemas/quotation.schema';
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS, QUOTATION_STATUS_LABELS } from '@/config/constants';
import { documentCopy } from '@/components/documents/quotationDocumentCopy';
import { quotationActions, waitingFor } from '@/helpers/quotationActions';
import { downloadBase64 } from '@/helpers/download';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { QuotationActionBar } from './sections/QuotationActionBar';
import { QuotationNotices } from './sections/QuotationNotices';
import { SendPanel } from './sections/SendPanel';
import { VersionSwitcher } from './sections/VersionSwitcher';
import { TotalsCard } from './sections/TotalsCard';
import { MarginCard } from './sections/MarginCard';
import { TrailCard } from './sections/TrailCard';
import { DiscountHelper } from './sections/DiscountHelper';
import { RepriceButton } from './sections/RepriceButton';
import { TakeoffTab } from './sections/TakeoffTab';
import { LabourTab } from './sections/LabourTab';
import { CustomerViewTab } from './sections/CustomerViewTab';
import { TermsPicker } from './sections/TermsPicker';
import { useBoqFigures } from './useBoqFigures';

/** The builder's tabs, in order. `boq`, `terms` and `customer` are the one form's three panels. */
const TABS = [
  { value: 'boq', label: 'BOQ' },
  { value: 'takeoff', label: 'Take-off' },
  { value: 'labour', label: 'Labour' },
  { value: 'terms', label: 'Payment & terms' },
  { value: 'customer', label: 'Customer view' },
  { value: 'history', label: 'History', capability: 'quotations:history' },
];
const FORM_TABS = ['boq', 'terms', 'customer'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** The panel each field outside the BOQ lives on — a refused save opens the panel with the first error. */
const FIELD_TAB = {
  validUntil: 'terms', terms: 'terms', internalNote: 'terms',
  contractType: 'terms', estimatedDays: 'terms', exclusions: 'terms', paymentStages: 'terms',
  showMeasurements: 'customer', summaryOnly: 'customer',
};
const CONTRACT_OPTIONS = CONTRACT_TYPES.map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }));
/** What the customer reads for a contract type — the document's own sentence (L-D2). */
const contractSentence = (type) => documentCopy('en').contract[type]?.body;

/**
 * The builder's form, described as data: the BOQ panel (the rows — a `lineItems` field on the kit's EditableGrid —
 * the discount, its helpers and VAT), the Payment & terms panel (Phase L4: the contract type with the sentence the
 * customer reads, the duration, the exclusions, the payment schedule — a `paymentSchedule` field — the terms with
 * the library picker, validity and the internal note) and the Customer view panel's two options. One form, one
 * Save; the panels not on screen stay mounted and keep their values.
 */
const quotationFields = ({ tab, frozen, figures, stale, stages, quotationId, customerLocale }) => [
  {
    type: 'group', variant: 'card', label: 'Bill of quantities', hidden: tab !== 'boq',
    description: frozen ? undefined : 'Arrow keys move, Enter edits, typing overwrites; / searches the rate library; paste rows from Excel.',
    fields: [
      { name: 'items', type: 'lineItems', label: 'Rows', gridLabel: 'Bill of quantities', figures, stale, costCapability: 'costs:read', disabled: frozen },
      { name: 'discount', type: 'money', label: 'Discount', span: 'half', description: 'One amount, before VAT. The helpers below work it out on the server.' },
      { name: 'vatApplied', type: 'switch', label: 'Apply VAT', span: 'half' },
      ...(frozen ? [] : [{ name: 'discountHelper', type: 'preview', label: 'Discount helpers', component: DiscountHelper, quotationId }]),
    ],
  },
  {
    type: 'group', variant: 'card', label: 'Contract', hidden: tab !== 'terms',
    description: 'How the final bill is worked out, how long the work takes, and what the price leaves out — all shown to the customer.',
    fields: [
      {
        name: 'contractType', type: 'select', label: 'Contract type', options: CONTRACT_OPTIONS, span: 'half', required: true,
        adapt: (values) => ({ description: contractSentence(values.contractType) ? `The customer reads: “${contractSentence(values.contractType)}”` : undefined }),
      },
      {
        name: 'estimatedDays', type: 'number', label: 'Estimated duration (days)', min: 1, max: 3650, step: 1, span: 'half', nullable: true,
        description: 'Shown as “About N days”. Leave empty to leave it out.',
      },
      {
        name: 'exclusions', type: 'textarea', label: 'Not included in the price', rows: 3, maxLength: 4000, nullable: true,
        placeholder: 'Water and electricity during the work are provided by the owner.\nShifting furniture is not included.',
      },
    ],
  },
  {
    type: 'group', variant: 'card', label: 'Payment schedule', hidden: tab !== 'terms',
    description: 'How the total is paid, stage by stage. A stage “On acceptance” is the advance. The amounts are the server’s, for the totals on screen.',
    fields: [
      { name: 'paymentStages', type: 'paymentSchedule', label: 'Payment stages', figures: stages ?? undefined, stale },
    ],
  },
  {
    type: 'group', variant: 'card', label: 'Terms', hidden: tab !== 'terms',
    description: 'What the customer agrees to.',
    fields: [
      { name: 'validUntil', type: 'date', label: 'Valid until', time: '23:59', span: 'half', description: 'The customer can answer until the end of this day.' },
      ...(frozen ? [] : [{ name: 'termsPicker', type: 'preview', label: 'Terms library', component: TermsPicker, customerLocale }]),
      { name: 'terms', type: 'textarea', label: 'Terms shown to the customer', rows: 6 },
      { name: 'internalNote', type: 'textarea', label: 'Internal note', description: 'Staff only — never shown to the customer.', rows: 3 },
    ],
  },
  {
    type: 'group', variant: 'card', label: 'What the customer sees', hidden: tab !== 'customer',
    fields: [
      {
        name: 'showMeasurements', type: 'switch', label: 'Show the measurements', span: 'half', defaultValue: true,
        description: 'An annex with the measurement sheet behind each measured row, on the link and the print.',
      },
      {
        name: 'summaryOnly', type: 'switch', label: 'Section totals only', span: 'half',
        description: 'The customer sees each section’s subtotal, not the item rows. Totals, schedule and terms are unchanged.',
      },
    ],
  },
];

/**
 * One quotation version, as a bill of quantities (Phase L3). Tabs: **BOQ** (the rows, discount and VAT — editable
 * only as a DRAFT with `quotations:write`), **Take-off** (materials in buying units, stock and shortfall),
 * **Labour** (man-days per trade and a crew-size calculator), **Payment & terms** (Phase L4: contract type,
 * duration, exclusions, the payment schedule with the server's stage amounts, the terms and the library picker),
 * **Customer view** (showMeasurements / summaryOnly, and the saved quotation as the link shows it) and **History**.
 * The header: **Print** (`/admin/quotations/:id/print`, no cost even for a manager) and **Excel** (the .xlsx, through
 * RTK Query). The right rail: **Totals** (the server's live preview while editing, the saved figures otherwise),
 * **Margin** (`costs:read` only), **Send** (the link, "Opened N×", WhatsApp and Viber) and **Trail**.
 */
export default function QuotationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [search, setSearch] = useSearchParams();
  // ACCOUNTANT and DISPATCHER can reach this page on quotations:read alone.
  const { can, user } = useAuth();
  const canWrite = can('quotations:write');
  const showMargin = can('costs:read');

  const { data: quotation, isLoading, error, refetch } = useGetQuotationQuery(id);
  const [update] = useUpdateQuotationMutation();
  const [runAction, actionDialogs] = useQuotationActions();
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState(false);
  const onDirtyChange = useCallback((next) => setDirty(next), []);
  // react-hook-form hands the same values object to every watcher: copy it, so each edit is a new preview request.
  const onValuesChange = useCallback((next) => setValues({ ...next }), []);

  const frozen = quotation?.status !== 'DRAFT' || !canWrite;
  const tabs = TABS.filter((t) => !t.capability || can(t.capability));
  const asked = search.get('tab') === 'quotation' ? 'boq' : search.get('tab');
  const tab = tabs.some((t) => t.value === asked) ? asked : 'boq';
  const setTab = (next) => setSearch(next === 'boq' ? {} : { tab: next }, { replace: true });

  const shown = useBoqFigures({ quotation, values, dirty, enabled: Boolean(quotation) && !frozen });
  const customerLocale = quotation?.customer?.preferredLocale;
  const fields = useMemo(
    () => quotationFields({
      tab, frozen, figures: shown.figures, stale: shown.stale, stages: shown.stages, quotationId: quotation?.id, customerLocale,
    }),
    [tab, frozen, shown.figures, shown.stale, shown.stages, quotation?.id, customerLocale],
  );
  const [fetchXlsx, { isFetching: exporting }] = useLazyExportQuotationXlsxQuery();

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const q = quotation;
  const who = { can, userId: user?.id };
  const actions = quotationActions(q, who);
  const formTab = FORM_TABS.includes(tab) ? tab : 'boq';

  // The workbook comes through RTK Query (the Bearer token, the 401 → refresh → retry), never a bare link.
  const exportXlsx = async () => {
    try {
      const file = await fetchXlsx(q.id).unwrap();
      downloadBase64(file, `${q.number}${q.version > 1 ? `-v${q.version}` : ''}.xlsx`, XLSX_TYPE);
    } catch (err) {
      dispatch(toastError('Could not export the quotation', err?.data?.error?.message ?? 'Please try again in a moment.'));
    }
  };

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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quotations')}>
              <ArrowLeft aria-hidden /> Quotations
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/quotations/${q.id}/print`} target="_blank" rel="noreferrer"><Printer aria-hidden /> Print</Link>
            </Button>
            <Button variant="outline" size="sm" loading={exporting} onClick={exportXlsx}>
              <FileSpreadsheet aria-hidden /> Excel
            </Button>
          </div>
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
          {q.customer?.phone ? (
            <a href={`tel:${q.customer.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" aria-hidden /> {q.customer.phone}
            </a>
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
        <div className="-mx-1 mb-4 overflow-x-auto px-1">
          <TabsList className="w-max">
            {tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            {/* One form for the BOQ and Payment & terms tabs; it stays mounted (and keeps its edits) behind the others. */}
            <TabsContent key="form" value={formTab} forceMount hidden={!FORM_TABS.includes(tab)} className="mt-0 space-y-3 data-[state=inactive]:hidden">
              {!canWrite ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">You can read this quotation but not change it.</p>
              ) : frozen ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Only a draft is edited. {q.status === 'PENDING_APPROVAL' || q.status === 'OFFICE_APPROVED'
                    ? 'Send it back (or pull it back) to change it.'
                    : 'Revise it to change the figures and keep the history.'}
                </p>
              ) : tab === 'boq' ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RepriceButton quotation={q} disabledReason={dirty ? 'Save your changes first.' : undefined} />
                </div>
              ) : null}
              <ResourceForm
                key={`${q.id}:${frozen}`}
                schema={quotationFormSchema}
                fields={fields}
                defaultValues={q}
                readOnly={frozen}
                submitLabel="Save draft"
                stickyActions
                onDirtyChange={onDirtyChange}
                onValuesChange={onValuesChange}
                onInvalid={(errors) => {
                  const keys = Object.keys(errors);
                  console.log('INVALID', keys);
                  setTab(keys.some((k) => !FIELD_TAB[k]) ? 'boq' : FIELD_TAB[keys[0]]);
                }}
                onSubmit={async (body) => {
                  await update({ id: q.id, ...body }).unwrap();
                  dispatch(toastSuccess('Quotation saved', 'The server worked out the totals again.'));
                }}
              />
              {/* The Customer view panel: its two options above (in the form), the document as the link shows it here. */}
              {tab === 'customer' ? (
                <CustomerViewTab
                  quotation={q}
                  dirty={dirty}
                  defaultLocale={customerLocale}
                  options={values ? { showMeasurements: values.showMeasurements, summaryOnly: values.summaryOnly } : undefined}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="takeoff" className="mt-0">
              {tab === 'takeoff' ? <TakeoffTab quotationId={q.id} dirty={dirty} /> : null}
            </TabsContent>
            <TabsContent value="labour" className="mt-0">
              {tab === 'labour' ? <LabourTab quotationId={q.id} dirty={dirty} /> : null}
            </TabsContent>

            {can('quotations:history') ? (
              <TabsContent value="history" className="mt-0">
                {tab === 'history' ? <RecordHistory endpoint={`/admin/quotations/${q.id}/history`} /> : null}
              </TabsContent>
            ) : null}
          </div>

          <aside className="space-y-4" aria-label="Totals, margin, sending and trail">
            <TotalsCard
              totals={shown.totals}
              live={shown.live}
              stale={shown.stale}
              skipped={shown.skipped}
              error={shown.error}
              dirty={dirty && !frozen}
              validUntil={q.validUntil}
            />
            {showMargin ? <MarginCard cost={shown.cost} stale={dirty && shown.stale} /> : null}
            <SendPanel quotation={q} />
            <TrailCard quotation={q} />
          </aside>
        </div>
      </Tabs>

      {actionDialogs}
    </PageTransition>
  );
}
