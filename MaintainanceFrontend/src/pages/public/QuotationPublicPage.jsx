import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useGetQuotationByTokenQuery, useDecideQuotationMutation } from '@/api/publicApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition, motion } from '@/three/motion';
import { formatNpr, formatDate } from '@/helpers/format';

/**
 * The customer's view of a quotation, opened from an SMS link. No account, no
 * password — a single-purpose token scoped to this one record.
 */
export default function QuotationPublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetQuotationByTokenQuery(token);
  const [decide, { isLoading: deciding, error: decideError }] = useDecideQuotationMutation();
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState(null);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  const onDecide = async (choice) => {
    const result = await decide({ token, decision: choice, note: note || undefined }).unwrap().catch(() => null);
    if (result) setDecision(choice);
  };

  const settled = decision || ['APPROVED', 'REJECTED', 'CONVERTED'].includes(data.status);
  const approved = decision === 'approve' || ['APPROVED', 'CONVERTED'].includes(data.status);

  return (
    <PageTransition className="container max-w-3xl py-14">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <FileText className="h-3.5 w-3.5" aria-hidden /> Quotation
              </p>
              <h1 className="mt-1 text-2xl font-bold tabular-nums">{data.number}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                For {data.customer.name}
                {data.site ? ` · ${data.site.address}` : ''}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={data.status} />
              {data.validUntil ? (
                <p className="mt-2 text-xs text-muted-foreground">Valid until {formatDate(data.validUntil)}</p>
              ) : null}
            </div>
          </header>

          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.qty} {item.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNpr(item.rate, { symbol: false })}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatNpr(item.amount, { symbol: false })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatNpr(data.subtotal)}</dd></div>
            {data.discount > 0 ? (
              <div className="flex justify-between text-emerald-600"><dt>Discount</dt><dd className="tabular-nums">− {formatNpr(data.discount)}</dd></div>
            ) : null}
            {data.vatApplied ? (
              <div className="flex justify-between"><dt className="text-muted-foreground">VAT {data.vatRate}%</dt><dd className="tabular-nums">{formatNpr(data.vatAmount)}</dd></div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt><dd className="tabular-nums">{formatNpr(data.total)}</dd>
            </div>
          </dl>

          {data.terms ? (
            <section className="mt-8 rounded-lg bg-muted/50 p-4">
              <h2 className="text-sm font-semibold">Terms</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{data.terms}</p>
            </section>
          ) : null}

          <div className="mt-8 border-t pt-6">
            {settled ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className={`flex items-start gap-3 rounded-lg p-4 ${approved ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-muted'}`}
                role="status"
              >
                {approved ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="font-semibold">{approved ? 'Thank you — quotation approved' : 'Quotation declined'}</p>
                  <p className="mt-0.5 text-sm opacity-80">
                    {approved
                      ? 'Our team will call you to schedule the work.'
                      : 'We have let our team know. Call us if you would like a revised quote.'}
                  </p>
                </div>
              </motion.div>
            ) : data.status === 'EXPIRED' ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                This quotation has expired. Please contact us for an updated one.
              </p>
            ) : (
              <>
                <Label htmlFor="q-note">Anything you want to add? (optional)</Label>
                <Textarea
                  id="q-note" rows={2} className="mt-1.5"
                  value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please start after Dashain"
                />
                {decideError ? (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {decideError?.data?.error?.message ?? 'Could not record your decision.'}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button size="lg" className="flex-1" loading={deciding} onClick={() => onDecide('approve')}>
                    <CheckCircle2 className="h-4 w-4" /> Approve this quotation
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" disabled={deciding} onClick={() => onDecide('reject')}>
                    Decline
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
