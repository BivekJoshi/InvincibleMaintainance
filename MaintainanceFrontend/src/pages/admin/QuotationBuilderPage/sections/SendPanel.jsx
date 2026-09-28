import { useDispatch } from 'react-redux';
import {
  Check, Copy, ExternalLink, Eye, EyeOff, Mail, MessageCircle, MessageSquare, Phone, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateBadge } from '@/components/common/StateBadge';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDateTime } from '@/helpers/format';
import { viberShareHref, whatsappShareHref } from '@/helpers/contact';

const TEMPLATE_WORDS = {
  quotation_sent: 'The quotation link',
  quotation_accepted: 'Thank-you for accepting',
  quotation_changes_received: 'Changes received',
};

/**
 * The message a WhatsApp or Viber share carries, in the customer's language (Phase L4). Customer-facing words, so
 * both languages live here together.
 */
const SHARE_MESSAGE = {
  en: ({ name, number, link }) => `Namaste${name ? ` ${name}` : ''}, here is your quotation ${number}. You can accept it, ask for changes or decline it here: ${link}`,
  ne: ({ name, number, link }) => `नमस्ते${name ? ` ${name}` : ''}, तपाईंको दरभाउपत्र ${number} यहाँ छ। यहीँबाट स्वीकार गर्न, परिवर्तन माग्न वा अस्वीकार गर्न सक्नुहुन्छ: ${link}`,
};

/**
 * The customer's link once sent: Copy, Open, **WhatsApp** and **Viber** shares that carry it (Phase L4), whether the
 * customer has **opened** it — "Opened 2×" and when first, in Kathmandu time (`viewCount`, `firstViewedAt`, stamped
 * by the public page's GET) — and whether each SMS and email about it went out.
 */
export function SendPanel({ quotation: q }) {
  const dispatch = useDispatch();
  const link = q.publicToken ? new URL(`/quotation/${q.publicToken}`, window.location.origin).href : null;
  const messages = q.messages ?? [];
  if (!link && !messages.length) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toastSuccess('Link copied'));
    } catch {
      dispatch(toastError('Could not copy the link', link));
    }
  };

  const locale = q.customer?.preferredLocale === 'ne' ? 'ne' : 'en';
  const shareText = link ? SHARE_MESSAGE[locale]({ name: q.customer?.name, number: q.number, link }) : '';
  const views = q.viewCount ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Customer link</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {link ? (
          <div className="space-y-2">
            <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs" data-testid="public-link">{link}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}><Copy aria-hidden /> Copy</Button>
              <Button size="sm" variant="outline" asChild>
                <a href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> Open</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={whatsappShareHref(q.customer?.phone, shareText)} target="_blank" rel="noreferrer" data-testid="share-whatsapp">
                  <MessageCircle aria-hidden /> WhatsApp
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={viberShareHref(shareText)} data-testid="share-viber"><Phone aria-hidden /> Viber</a>
              </Button>
            </div>
            {q.sentAt ? <p className="text-xs text-muted-foreground">Sent {formatDateTime(q.sentAt)}</p> : null}
            <div className="flex items-start gap-2" data-testid="link-views">
              {views > 0 ? <Eye className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0">
                <p className="font-medium">{views > 0 ? `Opened ${views}×` : 'Not opened yet'}</p>
                {views > 0 && q.firstViewedAt ? (
                  <p className="text-xs text-muted-foreground">First opened {formatDateTime(q.firstViewedAt)}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {messages.length ? (
          <ul className="space-y-2">
            {messages.map((m) => {
              const Icon = m.channel === 'sms' ? MessageSquare : Mail;
              return (
                <li key={m.id} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{TEMPLATE_WORDS[m.templateKey] ?? m.templateKey} · {m.channel === 'sms' ? 'SMS' : 'Email'}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.toAddress} · {formatDateTime(m.createdAt)}</p>
                    {m.error ? <p className="text-xs text-destructive">{m.error}</p> : null}
                  </div>
                  <StateBadge tone={m.status === 'sent' ? 'success' : m.status === 'failed' ? 'warning' : 'muted'}>
                    {m.status === 'sent' ? <Check className="mr-1 h-3 w-3" aria-hidden /> : m.status === 'failed' ? <X className="mr-1 h-3 w-3" aria-hidden /> : null}
                    {m.status === 'sent' ? 'Sent' : m.status === 'failed' ? 'Failed' : 'Queued'}
                  </StateBadge>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
