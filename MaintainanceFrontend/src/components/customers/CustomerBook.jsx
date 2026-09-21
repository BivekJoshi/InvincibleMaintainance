import { Briefcase, Building2, Sparkles, Users, Wallet } from 'lucide-react';
import { AnimatedNumber } from '@/three/motion/motionKit';
import { formatNprShort } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * One figure in the customer book. With `onClick` it is also the list's filter for what it
 * counts, pressed while that filter is on — its accessible name is the filter's `label`.
 */
function BookTile({ label, value, hint, icon: Icon, tone, onClick, pressed }) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors',
          pressed ? 'bg-[hsl(var(--tone))] text-primary-foreground' : 'bg-[hsl(var(--tone)/0.12)] text-[hsl(var(--tone))]',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xl font-bold leading-none tabular-nums">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </span>
        <span className="mt-1 block truncate text-xs font-medium">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </>
  );
  const shell = cn(
    'relative flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-[var(--elevation-1)]',
    pressed && 'border-[hsl(var(--tone)/0.6)] bg-[hsl(var(--tone)/0.06)]',
  );
  const style = { '--tone': `var(${tone})` };
  return onClick ? (
    <button
      type="button" onClick={onClick} aria-pressed={pressed} aria-label={label} style={style}
      className={cn(shell, 'transition-[box-shadow,border-color] hover:border-[hsl(var(--tone)/0.45)] hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none')}
    >
      {body}
    </button>
  ) : <div style={style} className={shell}>{body}</div>;
}

/**
 * The customer list's header: the size of the book and the three questions the office asks
 * of it most — companies, who has work on, who owes us — each a one-click filter.
 * `summary` is `GET /admin/customers/summary` (undefined while it loads, or if it fails:
 * the filters still work). `owed` is present only for a caller who may read invoices.
 *
 * @param {{ summary?: object, params: object, onToggle: (key: string, value: string) => void, withBalance: boolean }} props
 */
export function CustomerBook({ summary, params, onToggle, withBalance }) {
  const n = (key) => summary?.[key] ?? '…';
  return (
    <section aria-label="Customer book" className={cn('mb-4 grid grid-cols-2 gap-3', withBalance ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
      <BookTile label="Customers" value={n('total')} hint="On the books" icon={Users} tone="--primary" />
      <BookTile
        label="Companies" value={n('companies')} hint="Offices, builders, landlords" icon={Building2} tone="--chart-1"
        onClick={() => onToggle('type', 'company')} pressed={params.type === 'company'}
      />
      <BookTile
        label="Open jobs" value={n('withOpenJobs')} hint="Customers with work on now" icon={Briefcase} tone="--gold"
        onClick={() => onToggle('hasOpenJobs', 'true')} pressed={params.hasOpenJobs === 'true'}
      />
      {withBalance ? (
        <BookTile
          label="Owes money" value={n('owingCount')}
          hint={summary?.owed != null ? `${formatNprShort(summary.owed)} outstanding` : 'Unpaid invoices'}
          icon={Wallet} tone="--destructive"
          onClick={() => onToggle('owing', 'true')} pressed={params.owing === 'true'}
        />
      ) : null}
      <BookTile label="New" value={n('newLast30Days')} hint="Joined in the last 30 days" icon={Sparkles} tone="--success" />
    </section>
  );
}
