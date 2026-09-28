import { Link } from 'react-router-dom';
import { FileDiff } from 'lucide-react';

/**
 * A variation order's banner (Phase L7): the job it changes, and what accepting it does — its rows join the job's bill
 * of quantities as VARIATION lines, with their requirements; no new job, no advance, the lead untouched. An omission is
 * a negative quantity. The job links for those who read jobs.
 *
 * @param {{ quotation: { status: string, job?: { id: string, number: string, title?: string }|null, jobId?: string|null },
 *   can: (capability: string) => boolean }} props
 */
export function VariationBanner({ quotation: q, can }) {
  const job = q.job ?? (q.jobId ? { id: q.jobId, number: 'its job' } : null);
  const applied = q.status === 'CONVERTED';
  return (
    <div role="note" data-testid="variation-banner" className="surface-info mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm">
      <FileDiff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">
          Variation to{' '}
          {job && can('jobs:read') && q.job ? (
            <Link to={`/admin/jobs/${job.id}?tab=variations`} className="font-mono underline underline-offset-2">{job.number}</Link>
          ) : <span className="font-mono">{job?.number ?? 'a job'}</span>}
          {q.job?.title ? <span className="font-normal text-muted-foreground"> · {q.job.title}</span> : null}
        </p>
        <p className="opacity-90">
          {applied
            ? 'Accepted — its rows are on the job’s bill of quantities as variation lines.'
            : 'Once the customer accepts, its rows join the job’s bill of quantities — no new job and no advance. An omission is a negative quantity. It has no payment schedule of its own: the job’s bills carry it.'}
        </p>
      </div>
    </div>
  );
}
