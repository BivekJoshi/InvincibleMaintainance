import { useDispatch } from 'react-redux';
import { Check, Copy, ExternalLink, Mail, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateBadge } from '@/components/common/StateBadge';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDateTime } from '@/helpers/format';

const TEMPLATE_WORDS = {
  quotation_sent: 'The quotation link',
  quotation_accepted: 'Thank-you for accepting',
  quotation_changes_received: 'Changes received',
};

/** The customer's link once sent, and whether each SMS and email about it went out. */
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
            </div>
            {q.sentAt ? <p className="text-xs text-muted-foreground">Sent {formatDateTime(q.sentAt)}</p> : null}
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
