import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LEAD_STATUS_LABELS } from '@/config/constants';
import { nextStatuses } from '@/helpers/leadBoard';

/**
 * "Change status": only the moves the state machine allows from here.
 *
 * @param {{ lead: object, onChange: (to: string) => void, disabled?: boolean, label?: string, size?: string, variant?: string }} props
 */
export function LeadStatusMenu({ lead, onChange, disabled, label = 'Change status', size = 'sm', variant = 'outline' }) {
  const moves = nextStatuses(lead.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled || !moves.length} aria-label={`${label} — now ${LEAD_STATUS_LABELS[lead.status]}`}>
          {label} <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Now: {LEAD_STATUS_LABELS[lead.status]}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {moves.map((to) => (
          <DropdownMenuItem key={to} onSelect={() => onChange(to)} className={to === 'LOST' ? 'text-destructive focus:text-destructive' : undefined}>
            {to === 'LOST' ? 'Mark as lost…' : LEAD_STATUS_LABELS[to]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
