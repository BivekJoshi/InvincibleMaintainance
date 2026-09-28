import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Ban, Banknote, Link2, Lock, Phone, Printer, Send,
} from 'lucide-react';
import { useGetInvoiceQuery } from '@/api/financeApi';
import { useAuth } from '@/hooks/useAuth';
import { useInvoiceActions } from '@/hooks/useInvoiceActions';
import { RecordHeader } from '@/components/common/RecordHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { RecordHistory } from '@/components/common/RecordHistory';
import { InvoiceDocument } from '@/components/documents/InvoiceDocument';
import { InvoiceLinkCard } from '@/components/finance/InvoiceLinkCard';
import { InvoiceKindBadge } from '@/components/finance/InvoiceKindBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { INVOICE_STATUS_LABELS } from '@/config/constants';
import { canEditInvoice, invoiceActions, invoiceStageLine } from '@/helpers/finance';
import { formatBalance, formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { InvoiceEditForm } from './sections/InvoiceEditForm';
import { InvoicePaymentsTab } from './sections/InvoicePaymentsTab';

/**
 * The jobs an invoice bills: the lines' `jobs`, and (Phase L6) the job an advance or a stage bill belongs to — `job`,
 * which has no lines of its own on that job — once each.
 */
const jobsOf = (invoice) => {
  const jobs = [...(invoice.jobs ?? [])];
  if (invoice.job && !jobs.some((j) => j.id === invoice.job.id)) jobs.unshift(invoice.job);
  return jobs;
};

const ACTION_LOOK = {
  send: { icon: Send },
  recordPayment: { icon: Banknote },
  void: { icon: Ban, variant: 'outline', className: 'text-destructive hover:text-destructive' },
};

/**
 * `/admin/invoices/:id` (Phase I2, `invoices:read`): the invoice as the customer sees it — `InvoiceDocument`, the
 * public page's own component, dates in AD and BS — with the office around it: **Edit** (a DRAFT only, to
 * `invoices:write`: the lines through the kit's `lineItems` field, discount, VAT, due date, note, terms — a 422
 * INVOICE_LOCKED is told in words), **Send** (then the customer's link, copy and WhatsApp), **Record payment**
 * (rupees, no more than the balance), **Void** (why), the payments with **Void payment** (voided ones struck
 * through), **History** (`invoices:history`) and **Print**. Every figure is the server's.
 *
 * Phase L6: a stage or closing bill's draft edits only its due date, note and terms — its lines, discount and VAT are
 * locked (`helpers/finance#invoiceLinesLocked`, `sections/InvoiceEditForm`). An advance invoice wears **Advance** by its
 * status, links its job (`job`) and names the payment stage it
 * bills (`helpers/finance#invoiceStageLine`: "Advance — on acceptance (50%)"); recording its payment in full lifts the job's advance gate.
 */
export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { can } = useAuth();
  const { data: invoice, isLoading, error, refetch } = useGetInvoiceQuery(id);
  const [runAction, invoiceDialogs] = useInvoiceActions();

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const editable = canEditInvoice(invoice, { can });
  const actions = invoiceActions(invoice, { can }).filter((a) => a.key !== 'edit');
  const payments = invoice.payments ?? [];
  const tabs = [
    ...(editable ? ['edit'] : []),
    'document',
    'payments',
    ...(can('invoices:history') ? ['history'] : []),
  ];
  const tab = tabs.includes(search.get('tab')) ? search.get('tab') : tabs[0];
  const setTab = (next) => setSearch(next === tabs[0] ? {} : { tab: next }, { replace: true });
  const isVoid = invoice.status === 'VOID';

  const figures = [
    ['Total', formatNpr(invoice.total), null],
    ['Paid', formatNpr(invoice.paidAmount), null],
    isVoid
      ? ['Balance', 'Void — nothing owed', 'muted']
      : ['Balance', formatBalance(invoice.balance), invoice.status === 'OVERDUE' ? 'destructive' : invoice.balance > 0 ? null : 'success'],
  ];

  return (
    <PageTransition>
      <RecordHeader
        eyebrow={(
          <>
            <span>Invoice</span>
            <span aria-hidden>·</span>
            <span data-testid="invoice-status">{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</span>
            <InvoiceKindBadge kind={invoice.kind} />
          </>
        )}
        title={invoice.number}
        meta={(
          <>
            {invoice.customer ? (
              <Link to={`/admin/customers/${invoice.customer.id}`} className="font-medium hover:text-primary hover:underline">{invoice.customer.name}</Link>
            ) : null}
            {invoice.customer?.phone ? (
              <a href={`tel:${invoice.customer.phone}`} className="inline-flex items-center gap-1.5 tabular-nums hover:text-primary">
                <Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {invoice.customer.phone}
              </a>
            ) : null}
            {jobsOf(invoice).map((job) => (
              <Link key={job.id} to={`/admin/jobs/${job.id}`} className="font-mono text-xs hover:text-primary hover:underline" title={job.title}>{job.number}</Link>
            ))}
            {invoiceStageLine(invoice) ? (
              <span data-testid="invoice-stage" className="text-xs">{invoiceStageLine(invoice)}</span>
            ) : null}
            {invoice.quotation ? (
              <Link to={`/admin/quotations/${invoice.quotation.id}`} className="font-mono text-xs hover:text-primary hover:underline">{invoice.quotation.number}</Link>
            ) : null}
          </>
        )}
        actions={(
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/invoices')}><ArrowLeft aria-hidden /> Invoices</Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/invoices/${invoice.id}/print`}><Printer aria-hidden /> Print</Link>
            </Button>
            {invoice.publicUrl ? (
              <Button variant="outline" size="sm" onClick={() => runAction('link', invoice)}><Link2 aria-hidden /> Customer link</Button>
            ) : null}
            {actions.map((a) => {
              const look = ACTION_LOOK[a.key] ?? {};
              const Icon = look.icon;
              return (
                <Button
                  key={a.key}
                  size="sm"
                  variant={look.variant ?? 'default'}
                  className={look.className}
                  disabled={Boolean(a.disabledReason)}
                  title={a.disabledReason}
                  onClick={() => runAction(a.key, invoice)}
                >
                  {Icon ? <Icon aria-hidden /> : null} {a.label}
                </Button>
              );
            })}
          </>
        )}
      >
        <dl className="grid grid-cols-3 divide-x" data-testid="invoice-figures">
          {figures.map(([label, value, tone]) => (
            <div key={label} className="px-5 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn(
                'text-lg font-semibold tabular-nums',
                tone === 'destructive' && 'text-destructive',
                tone === 'success' && 'text-success',
                tone === 'muted' && 'text-sm font-medium text-muted-foreground',
              )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </RecordHeader>

      {actions.some((a) => a.disabledReason) ? (
        <ul className="mb-4 space-y-1 text-xs text-muted-foreground">
          {actions.filter((a) => a.disabledReason).map((a) => <li key={a.key}>{a.label}: {a.disabledReason}</li>)}
        </ul>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 mb-4 overflow-x-auto px-1">
          <TabsList>
            {editable ? <TabsTrigger value="edit">Edit</TabsTrigger> : null}
            <TabsTrigger value="document">Invoice</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            {can('invoices:history') ? <TabsTrigger value="history">History</TabsTrigger> : null}
          </TabsList>
        </div>

        {editable ? (
          <TabsContent value="edit">
            <Card><CardContent className="pt-6"><InvoiceEditForm invoice={invoice} /></CardContent></Card>
          </TabsContent>
        ) : null}
        <TabsContent value="document">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card><CardContent className="p-4 sm:p-8"><InvoiceDocument invoice={invoice} detailedPayments /></CardContent></Card>
            <div className="space-y-4">
              {invoice.publicUrl ? <Card><CardContent className="pt-6"><InvoiceLinkCard invoice={invoice} /></CardContent></Card> : null}
              {!editable && invoice.status !== 'DRAFT' ? (
                <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground" data-testid="locked-note">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {isVoid
                    ? 'A void invoice is kept as it was.'
                    : 'Sent to the customer, so it can no longer be edited. To change it, void it and issue another.'}
                </p>
              ) : null}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payments">
          {tab === 'payments' ? <InvoicePaymentsTab invoice={invoice} onVoid={(payment) => runAction('voidPayment', invoice, payment)} /> : null}
        </TabsContent>
        {can('invoices:history') ? (
          <TabsContent value="history">
            {tab === 'history' ? <RecordHistory endpoint={`/admin/invoices/${invoice.id}/history`} /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
      {invoiceDialogs}
    </PageTransition>
  );
}
