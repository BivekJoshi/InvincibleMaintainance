import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StateBadge } from '@/components/common/StateBadge';
import { useAuth } from '@/hooks/useAuth';
import { formatNpr } from '@/helpers/format';

function Row({ label, to, children, soon }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{children}</span>
      </span>
      {to ? (
        <Button asChild size="sm" variant="outline"><Link to={to}>Open</Link></Button>
      ) : soon ? <StateBadge title="This record’s page is not built yet">Soon</StateBadge> : null}
    </li>
  );
}

/**
 * What a convert made, with links: the customer (new or existing), the site, and the
 * quotation, visit and survey when there were any.
 *
 * @param {{ result: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function ConvertResult({ result, onOpenChange }) {
  const { can } = useAuth();
  const open = Boolean(result);
  const r = result ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> Converted
          </DialogTitle>
          <DialogDescription>
            {r.customerCreated ? 'A new customer was created.' : 'The lead is linked to an existing customer.'}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {r.customer ? (
            <Row label={r.customerCreated ? 'New customer' : 'Customer'} to={`/admin/customers/${r.customer.id}`}>
              {r.customer.name} · {r.customer.phone}
            </Row>
          ) : null}
          {r.site ? <Row label={r.site.isPrimary ? 'Primary site' : 'Site'}>{r.site.label} · {r.site.address}</Row> : null}
          {r.quotation ? (
            <Row label="Draft quotation" to={can('quotations:read') ? `/admin/quotations/${r.quotation.id}` : undefined}>
              {r.quotation.number} · {formatNpr(r.quotation.total)}
            </Row>
          ) : null}
          {r.job ? <Row label="Inspection visit" soon>{r.job.number}</Row> : null}
          {r.survey ? <Row label="Site survey" to={`/admin/surveys/${r.survey.id}`}>{r.survey.number}</Row> : null}
        </ul>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
