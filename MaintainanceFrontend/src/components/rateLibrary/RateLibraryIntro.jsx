import { AlertTriangle } from 'lucide-react';
import { StateBadge } from '@/components/common/StateBadge';
import { RATE_MODE_LABELS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

/**
 * Above a saved rate's form: how its rate is set and, when a price behind its recipe has moved, that it is
 * out of date and what the recipe gives today — for everyone who reads the library, since both are selling
 * rates. A rate changes only by a deliberate reprice or a save, never by itself.
 *
 * @param {{ record: object }} props
 */
export function RateLibraryIntro({ record }) {
  const derived = record.rateMode === 'DERIVED';
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StateBadge tone={derived ? 'info' : 'muted'}>{RATE_MODE_LABELS[record.rateMode] ?? 'Manual'}</StateBadge>
        {derived
          ? 'The rate comes from the recipe: its cost at the time it was set, plus overhead and profit, rounded up.'
          : 'The rate is typed by hand. A recipe, if it has one, only works out what the work costs.'}
      </p>
      {record.outOfDate ? (
        <div role="status" className="flex gap-2 rounded-lg border surface-warning p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Out of date.</span> At today’s prices the recipe gives{' '}
            <span className="font-semibold tabular-nums">{formatNpr(record.derivedRate)}</span> a {record.unit}; the rate is{' '}
            <span className="tabular-nums">{formatNpr(record.rate)}</span>. It changes only when someone updates it — on the
            list, select it and choose <span className="font-medium">Update to derived rate</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
