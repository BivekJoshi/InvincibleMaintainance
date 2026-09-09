import { useParams } from 'react-router-dom';
import { Receipt, Printer, Phone } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useGetInvoiceByTokenQuery, useGetBootstrapQuery } from '@/api/publicApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion';
import { selectLocale } from '@/redux/slices/uiSlice';
import { formatNpr, formatDate } from '@/helpers/format';

/**
 * The customer's view of an invoice, opened from the SMS or email link that
 * `invoice.service.js` sends. Read-only: payment is settled offline, so this
 * shows what is owed and how to pay, and nothing it could get wrong.
 */
export default function InvoicePublicPage() {
  const { token } = useParams();
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetInvoiceByTokenQuery(token);
  const { data: boot } = useGetBootstrapQuery(locale);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  const settings = boot?.settings ?? {};
  const due = Math.max(0, (data.total ?? 0) - (data.paidAmount ?? 0));
  const overdue = data.dueDate && new Date(data.dueDate) < new Date() && due > 0;

  return (
    <PageTransition className="container max-w-3xl py-14">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <Receipt className="h-3.5 w-3.5" aria-hidden /> Invoice
              </p>
              <h1 className="mt-1 text-2xl font-bold tabular-nums">{data.number}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                For {data.customer?.name}
                {data.customer?.panVatNo ? ` · PAN/VAT ${data.customer.panVatNo}` : ''}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={data.status} />
              <p className="mt-2 text-xs text-muted-foreground">Issued {formatDate(data.issuedAt)}</p>
              {data.dueDate ? (
                <p className={overdue ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
                  Due {formatDate(data.dueDate)}
                </p>
              ) : null}
            </div>
          </header>

          <div className="overflow-x-auto py-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {item.qty}{item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNpr(item.rate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatNpr(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <dl className="ml-auto max-w-xs space-y-2 border-t pt-5 text-sm">
            <Row label="Subtotal" value={formatNpr(data.subtotal)} />
            {data.discount ? <Row label="Discount" value={`− ${formatNpr(data.discount)}`} /> : null}
            <Row
              label={data.vatApplied ? `VAT (${data.vatRate}%)` : 'VAT (not applied)'}
              value={formatNpr(data.vatAmount)}
            />
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatNpr(data.total)}</dd>
            </div>
            {data.paidAmount ? <Row label="Paid" value={`− ${formatNpr(data.paidAmount)}`} /> : null}
            <div className={`flex items-center justify-between border-t pt-2 text-base font-bold ${overdue ? 'text-destructive' : ''}`}>
              <dt>{due > 0 ? 'Amount due' : 'Settled'}</dt>
              <dd className="tabular-nums">{formatNpr(due)}</dd>
            </div>
          </dl>

          {(data.payments ?? []).length ? (
            <section className="mt-8 border-t pt-5">
              <h2 className="text-sm font-semibold">Payments received</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.payments.map((payment, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{formatDate(payment.receivedAt)} · {payment.method}</span>
                    <span className="tabular-nums">{formatNpr(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.terms ? (
            <p className="mt-8 whitespace-pre-wrap border-t pt-5 text-xs leading-relaxed text-muted-foreground">
              {data.terms}
            </p>
          ) : null}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="text-xs text-muted-foreground">
              Questions about this invoice? Call us and quote {data.number}.
            </p>
            <div className="flex gap-2 print:hidden">
              {settings['contact.phonePrimary'] ? (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${settings['contact.phonePrimary']}`}>
                    <Phone className="h-4 w-4" /> {settings['contact.phonePrimary']}
                  </a>
                </Button>
              ) : null}
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </footer>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
