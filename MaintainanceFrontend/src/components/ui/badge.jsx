import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { STATUS_STYLES, PRIORITY_STYLES, SLA_STYLES } from '@/lib/constants';
import { titleCase } from '@/lib/format';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
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
