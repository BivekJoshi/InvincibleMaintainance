import { useDispatch } from 'react-redux';
import { Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatBalance, formatDateTime } from '@/helpers/format';
import { whatsappShareHref } from '@/helpers/contact';

/** The WhatsApp message that carries the link, in the customer's language. Customer-facing words, so both live here. */
const SHARE_MESSAGE = {
  en: ({ name, number, due, link }) => `Namaste${name ? ` ${name}` : ''}, here is your invoice ${number}${due ? ` — ${due} due` : ''}: ${link}`,
  ne: ({ name, number, due, link }) => `नमस्ते${name ? ` ${name}` : ''}, तपाईंको बिल ${number}${due ? ` — तिर्न बाँकी ${due}` : ''}: ${link}`,
};

/**
 * A sent invoice's customer link (Phase I): the server's `publicUrl`, with **Copy**, **Open** and a **WhatsApp** share
 * in the customer's language carrying it and the balance the server sends. Nothing for an invoice that has not been
 * sent (it has no link yet).
 *
 * @param {{ invoice: object, compact?: boolean }} props
 */
export function InvoiceLinkCard({ invoice, compact = false }) {
  const dispatch = useDispatch();
  const link = invoice?.publicUrl;
  if (!link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toastSuccess('Link copied'));
    } catch {
      dispatch(toastError('Could not copy the link', link));
    }
  };
  const locale = invoice.customer?.preferredLocale === 'ne' ? 'ne' : 'en';
  const due = invoice.balance > 0 ? formatBalance(invoice.balance) : null;
  const text = SHARE_MESSAGE[locale]({ name: invoice.customer?.name, number: invoice.number, due, link });

  return (
    <div className="space-y-2 text-sm" data-testid="invoice-link">
      {compact ? null : <p className="font-medium">Customer link</p>}
      <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs" data-testid="public-link">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" type="button" onClick={copy}><Copy aria-hidden /> Copy</Button>
        <Button size="sm" variant="outline" asChild>
          <a href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> Open</a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={whatsappShareHref(invoice.customer?.phone, text)} target="_blank" rel="noreferrer" data-testid="share-whatsapp">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>
      {invoice.sentAt ? <p className="text-xs text-muted-foreground">Sent {formatDateTime(invoice.sentAt)}</p> : null}
    </div>
  );
}
