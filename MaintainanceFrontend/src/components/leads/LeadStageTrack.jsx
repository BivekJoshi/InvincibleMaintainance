import { Check, X } from 'lucide-react';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { toneStyle } from '@/helpers/leadBoard';
import { cn } from '@/helpers/utils';

/** The road a lead travels when it goes well. LOST can happen from anywhere, so it is not a step. */
const STAGE_ROAD = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON'];

/** What each step means to the person working the lead. */
const STAGE_HINTS = {
  NEW: 'Came in',
  CONTACTED: 'First reply logged',
  INSPECTION_SCHEDULED: 'Visit on the calendar',
  QUOTED: 'Price with the customer',
  WON: 'Work agreed',
};

/**
 * Where a lead is on the road from enquiry to work: the steps behind it filled in its stage's
 * colour, the current one lit, the rest ahead. A lost lead greys the road and says why.
 * Skipping the visit (Contacted → Quoted) leaves that step hollow rather than ticked.
 *
 * @param {{ lead: { status: string, lostReason?: string, jobs?: object[] } }} props
 */
export function LeadStageTrack({ lead }) {
  const lost = lead.status === 'LOST';
  const at = STAGE_ROAD.indexOf(lead.status);
  const visited = (step, i) => i < at && !(step === 'INSPECTION_SCHEDULED' && !(lead.jobs ?? []).some((j) => j.type === 'INSPECTION'));

  return (
    <div style={toneStyle(lead.status)} className="px-5 py-4">
      <ol aria-label="Where this lead is" className="grid grid-cols-5 gap-1">
        {STAGE_ROAD.map((step, i) => {
          const current = i === at;
          const done = visited(step, i);
          const skipped = i < at && !done;
          return (
            <li key={step} aria-current={current ? 'step' : undefined} className="min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors',
                    current && !lost && 'border-[hsl(var(--tone))] bg-[hsl(var(--tone))] text-primary-foreground shadow-[0_0_0_4px_hsl(var(--tone)/0.18)]',
                    done && !lost && 'border-[hsl(var(--tone))] bg-[hsl(var(--tone)/0.15)] text-[hsl(var(--tone))]',
                    (skipped || (!current && !done) || lost) && 'border-border bg-card text-muted-foreground',
                    skipped && 'border-dashed',
                  )}
                >
                  {done && !lost ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                </span>
                {i < STAGE_ROAD.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn('h-0.5 flex-1 rounded-full', i < at && !lost ? 'bg-[hsl(var(--tone)/0.6)]' : 'bg-border')}
                  />
                ) : null}
              </div>
              <p className={cn('mt-1.5 truncate text-xs font-semibold', !current && 'text-muted-foreground', lost && 'text-muted-foreground')}>
                {LEAD_STATUS_LABELS[step]}
              </p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {skipped ? 'Skipped' : STAGE_HINTS[step]}
              </p>
            </li>
          );
        })}
      </ol>
      {lost ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span><span className="font-semibold">Lost</span>{lead.lostReason ? ` — ${lead.lostReason}` : ' — no reason given'}</span>
        </p>
      ) : null}
    </div>
  );
}
