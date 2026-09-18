import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';

/**
 * The kebab menu at the end of a row. The menu is portalled, but React still
 * bubbles its clicks through the row, so both ends stop propagation — choosing
 * "Delete" must not also open the record.
 *
 * @param {object} props
 * @param {object} props.row
 * @param {{ label?: string, icon?: import('react').ElementType, onSelect?: (row: object) => void,
 *   destructive?: boolean, disabled?: boolean, separator?: boolean }[]} props.actions
 * @param {string} [props.label] accessible name for the trigger
 */
export function CustomTableRowActions({ row, actions, label = 'Row actions' }) {
  if (!actions?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button" variant="ghost" size="icon" className="h-8 w-8"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {actions.map((action, i) => {
          if (action.separator) return <DropdownMenuSeparator key={`separator-${i}`} />;
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              onSelect={() => action.onSelect?.(row)}
              className={cn(action.destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive')}
            >
              {Icon ? <Icon aria-hidden /> : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
