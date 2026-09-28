import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The job's state-driven buttons (`helpers/jobActions`). A disabled one says why beside the bar,
 * so the dispatcher is never left guessing — buttons held for the same reason share one line (the advance
 * gate holds Schedule and Assign at once); cancel and delete sit in the "More" menu.
 *
 * @param {{ actions: import('@/helpers/jobActions').JobAction[], onRun: (action: object) => void }} props
 */
export function JobActionBar({ actions, onRun }) {
  const shown = actions.filter((a) => !a.destructive);
  const more = actions.filter((a) => a.destructive);
  // One line per reason: the advance gate disables several buttons for the same reason (Phase L6).
  const reasons = [...shown.filter((a) => a.disabledReason).reduce((byReason, a) => {
    byReason.set(a.disabledReason, [...(byReason.get(a.disabledReason) ?? []), a.label]);
    return byReason;
  }, new Map())];
  if (!actions.length) return null;

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        {shown.map((a) => (
          <Button
            key={`${a.key}-${a.to ?? ''}`}
            size="sm"
            variant={a.primary ? 'default' : 'outline'}
            disabled={Boolean(a.disabledReason)}
            title={a.disabledReason}
            onClick={() => onRun(a)}
          >
            {a.label}{a.note || ['schedule', 'assign', 'complete', 'publish'].includes(a.key) ? '…' : ''}
          </Button>
        ))}
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="More actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {more.map((a) => (
                <DropdownMenuItem key={`${a.key}-${a.to ?? ''}`} className="text-destructive focus:text-destructive" onSelect={() => onRun(a)}>
                  {a.label}{a.note ? '…' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {reasons.map(([reason, labels]) => (
        <p key={reason} className="text-xs text-muted-foreground">{labels.join(', ')}: {reason.charAt(0).toLowerCase()}{reason.slice(1)}.</p>
      ))}
    </div>
  );
}
