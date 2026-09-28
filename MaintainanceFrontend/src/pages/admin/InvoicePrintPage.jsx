import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useGetInvoiceQuery } from '@/api/financeApi';
import { InvoiceDocument } from '@/components/documents/InvoiceDocument';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/admin/invoices/:id/print` (Phase I2, `invoices:read`) — the invoice as a printed document: `InvoiceDocument`, the
 * one the customer's link and the invoice page render, with the dates in AD and BS and no status badge, on an A4
 * sheet with no app chrome (the quotation print's pattern). A bar above the sheet (never printed) has Back and
 * **Print** (`window.print()`); `@media print` in `styles/globals.css` sets the page. The sheet always uses the light
 * palette (`theme-light`).
 */
export default function InvoicePrintPage() {
  const { id } = useParams();
  const { data: invoice, isLoading, error, refetch } = useGetInvoiceQuery(id);

  // The browser's print dialog suggests the tab's title as the file name.
  useEffect(() => {
    if (!invoice) return undefined;
    const before = document.title;
    document.title = `${invoice.number} — ${invoice.customer?.name ?? 'Invoice'}`;
    return () => { document.title = before; };
  }, [invoice]);

  if (isLoading) return <div className="mx-auto max-w-[210mm] p-6"><Skeleton className="h-[80vh] w-full" /></div>;
  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-dvh" />;

  return (
    <div className="min-h-dvh bg-muted/50 print:bg-transparent">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/invoices/${invoice.id}`}><ArrowLeft aria-hidden /> Back to {invoice.number}</Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}><Printer aria-hidden /> Print</Button>
        </div>
      </div>
      <main
        className="print-sheet theme-light mx-auto my-4 max-w-[210mm] bg-background p-5 text-foreground shadow-sm sm:my-8 sm:p-[14mm] print:m-0 print:max-w-none print:bg-transparent print:p-0 print:shadow-none"
        data-testid="print-sheet"
      >
        <InvoiceDocument invoice={invoice} print />
      </main>
    </div>
  );
}
