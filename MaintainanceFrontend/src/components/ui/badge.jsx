import { cva } from 'class-variance-authority';
import { cn } from '@/helpers/utils';
import { STATUS_STYLES, PRIORITY_STYLES, SLA_STYLES } from '@/config/constants';
import { titleCase } from '@/helpers/format';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        // Marketing accents, matching the button's — gold is the public
        // site's single emphasis colour, ink is its dark counterpart.
        gold: 'border-transparent bg-gold text-gold-foreground',
        goldSoft: 'border-gold/25 bg-gold/12 text-gold',
        ink: 'border-transparent bg-ink text-ink-foreground',
        onInk: 'border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Renders any lead/job/quotation/invoice status with its own colour. */
function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT, className)}>
      {titleCase(status)}
    </span>
  );
}

function PriorityBadge({ priority, className }) {
  if (!priority || priority === 'NORMAL') return null;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', PRIORITY_STYLES[priority], className)}>
      {priority}
    </span>
  );
}

export { Badge, StatusBadge, PriorityBadge, badgeVariants, SLA_STYLES };
