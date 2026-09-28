import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QUOTATION_STATUS_LABELS } from '@/config/constants';
import { formatDateTime } from '@/helpers/format';

/** The right rail's Trail: who moved it and when — the short version of the History tab. */
export function TrailCard({ quotation: q }) {
  const rows = [
    ['Prepared', q.createdBy?.name, q.createdAt],
    q.submittedAt && ['Submitted', q.submittedBy?.name, q.submittedAt],
    q.approvedAt && ['Approved', q.autoApproved ? 'Automatically' : q.approvedBy?.name, q.approvedAt],
    q.sentAt && ['Sent', null, q.sentAt],
    q.decidedAt && ['Customer answered', QUOTATION_STATUS_LABELS[q.status], q.decidedAt],
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Trail</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {rows.map(([what, who, at]) => (
            <li key={what} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{what}</span>
              <span className="text-right">{who ? `${who} · ` : ''}{formatDateTime(at)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
