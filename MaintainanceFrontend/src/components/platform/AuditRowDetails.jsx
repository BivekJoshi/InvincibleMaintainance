import { Link } from 'react-router-dom';
import { ExternalLink, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuditDiff } from '@/components/platform/AuditDiff';
import { recordHref } from '@/helpers/recordLinks';

/**
 * An audit row opened up: the before/after diff, and where the step came from — request
 * id (with a jump to everything that request did), ip and user agent.
 *
 * @param {{ row: object, onRequest?: (requestId: string) => void }} props
 */
export function AuditRowDetails({ row, onRequest }) {
  const href = recordHref(row);
  const facts = [
    ['Record', row.recordId ? `${row.model} · ${row.recordId}` : row.model],
    ['Request id', row.requestId],
    ['IP address', row.ip],
    ['Browser', row.userAgent],
  ];
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <AuditDiff before={row.before} after={row.after} changes={row.changes} />
      <div className="space-y-3 text-xs">
        <dl className="space-y-1.5">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all font-mono">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {row.requestId && onRequest ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onRequest(row.requestId)}>
              <ListFilter aria-hidden /> Show everything from this request
            </Button>
          ) : null}
          {href ? (
            <Button asChild size="sm" variant="outline">
              <Link to={href}><ExternalLink aria-hidden /> Open the record</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
