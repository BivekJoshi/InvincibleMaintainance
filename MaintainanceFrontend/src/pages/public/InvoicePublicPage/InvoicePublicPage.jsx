import { useParams } from 'react-router-dom';
import { useGetInvoiceByTokenQuery } from '@/api/publicApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { InvoiceDocument } from '@/components/documents/InvoiceDocument';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceActions } from './sections/InvoiceActions';

/**
 * The customer's view of an invoice, opened from the SMS or email link that `invoice.service.js` sends. Read-only:
 * payment is settled offline, so this shows what is owed and how to pay, and nothing it could get wrong. The document
 * is `components/documents/InvoiceDocument` — the same one the office's invoice page and print render (Phase I),
 * with the dates in AD and BS.
 */
export default function InvoicePublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetInvoiceByTokenQuery(token);
  const { phone } = useSiteSettings();

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-3xl py-14"><Skeleton className="h-96 w-full rounded-xl" /></div>;

  return (
    <DocumentShell>
      {/* What is owed is the server's `balance` (Phase I) — the page works nothing out. */}
      <InvoiceDocument invoice={data} />
      <InvoiceActions number={data.number} phone={phone} />
    </DocumentShell>
  );
}
