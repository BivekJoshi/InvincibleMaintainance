import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useGetWarrantyClaimRatesQuery } from '@/api/aftercareApi';
import { useAuth } from '@/hooks/useAuth';
import { addDaysTo, ktmDay } from '@/helpers/dispatchBoard';
import { claimRateFor, claimService } from '@/helpers/aftercare';

/** The window the rate is read over: a year of Kathmandu days, so one month's handful of claims does not decide it. */
const RATE_WINDOW_DAYS = 365;

/**
 * How often work like this claim's comes back (`GET /admin/reports/warranty-claims`, `reports:ops`): the claim
 * rate for its job's service when the report names it, else for its job type, beside the overall rate. Shown
 * only to a holder of `reports:ops`; a refusal or a failure shows nothing — it is context, not the decision.
 *
 * @param {{ claim: object }} props
 */
export function ClaimRatePanel({ claim }) {
  const { can } = useAuth();
  const readable = can('reports:ops');
  const range = useMemo(() => {
    const to = ktmDay();
    return { from: addDaysTo(to, -RATE_WINDOW_DAYS), to };
  }, []);
  const { data: report, error } = useGetWarrantyClaimRatesQuery(range, { skip: !readable });
  if (!readable || error || !report) return null;

  const rate = claimRateFor(report, { service: claimService(claim), type: claim?.warranty?.job?.type });
  return (
    <section aria-label="Claim rate" className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Claim rate, last 12 months
      </p>
      <p className="mt-1">
        <span className="text-lg font-semibold tabular-nums">{rate.claimRate}%</span>{' '}
        <span className="text-muted-foreground">
          for {rate.scope === 'all' ? 'all warranted work' : rate.label} — {rate.claims} claim{rate.claims === 1 ? '' : 's'} on {rate.warranties} warrant{rate.warranties === 1 ? 'y' : 'ies'}
        </span>
      </p>
      {rate.scope !== 'all' ? (
        <p className="text-xs text-muted-foreground">All warranted work: {report.claimRate}% ({report.totalClaims} of {report.totalWarranties}).</p>
      ) : null}
    </section>
  );
}
