import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useGetQuotationQuery } from '@/api/quotationsApi';
import { QuotationDocument } from '@/components/documents/QuotationDocument';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/**
 * `/admin/quotations/:id/print` (Phase L4, `quotations:read`) — the quotation as a printed document: the same
 * `QuotationDocument` the customer's link and the builder's Customer view render, in its print layout — the letterhead
 * with the logo and PAN/VAT number, the dates in AD and BS, the measurements annex open — on an A4 sheet with no app
 * chrome. A bar above the sheet (never printed) has the language, Back and **Print** (`window.print()`); `@media print`
 * in `styles/globals.css` sets the page. The sheet always uses the light palette (`theme-light`), whatever the app's.
 *
 * **No cost, even for a manager**: the document reads only the customer's fields. Phase J2's PDFs render this route.
 */
export default function QuotationPrintPage() {
  const { id } = useParams();
  const { data: q, isLoading, error, refetch } = useGetQuotationQuery(id);
  const [picked, setPicked] = useState(null);
  const locale = picked ?? (q?.customer?.preferredLocale === 'ne' ? 'ne' : 'en');

  // The browser's print dialog suggests the tab's title as the file name.
  useEffect(() => {
    if (!q) return undefined;
    const before = document.title;
    document.title = `${q.number}${q.version > 1 ? ` v${q.version}` : ''} — ${q.customer?.name ?? 'Quotation'}`;
    return () => { document.title = before; };
  }, [q]);

  if (isLoading) return <div className="mx-auto max-w-[210mm] p-6"><Skeleton className="h-[80vh] w-full" /></div>;
  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-dvh" />;

  return (
    <div className="min-h-dvh bg-muted/50 print:bg-transparent">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/quotations/${q.id}`}><ArrowLeft aria-hidden /> Back to {q.number}</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" size="sm" value={locale} onValueChange={(v) => { if (v) setPicked(v); }} aria-label="Language">
              <ToggleGroupItem value="en">English</ToggleGroupItem>
              <ToggleGroupItem value="ne"><span lang="ne">नेपाली</span></ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" onClick={() => window.print()}><Printer aria-hidden /> Print</Button>
          </div>
        </div>
      </div>
      <main
        className="print-sheet theme-light mx-auto my-4 max-w-[210mm] bg-background p-5 text-foreground shadow-sm sm:my-8 sm:p-[14mm] print:m-0 print:max-w-none print:p-0 print:shadow-none"
        data-testid="print-sheet"
      >
        <QuotationDocument quotation={q} locale={locale} showSymbol print />
      </main>
    </div>
  );
}
