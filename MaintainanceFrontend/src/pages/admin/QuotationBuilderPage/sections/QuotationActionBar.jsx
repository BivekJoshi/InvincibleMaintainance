import { CircleCheck, Copy, Send, Undo2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ICONS = { submit: Send, approve: CircleCheck, sendBack: Undo2, pullBack: Undo2, send: Send, revise: Copy, convert: Wrench };

/**
 * The buttons a quotation's state and the reader's capabilities allow
 * (`helpers/quotationActions`). A disabled action says why in a line under the bar,
 * not in a tooltip — the self-approval rule has to be readable on a phone too.
 *
 * @param {{ actions: import('@/helpers/quotationActions').QuotationAction[],
 *   onRun: (action: object) => void, busy?: boolean, blockedReason?: string }} props
 *   `blockedReason` disables every action (unsaved edits must be saved first).
 */
export function QuotationActionBar({ actions, onRun, busy, blockedReason }) {
  if (!actions.length) return null;
  const reasons = [...new Set([blockedReason, ...actions.map((a) => a.disabledReason)].filter(Boolean))];
  return (
    <div className="space-y-1.5" data-testid="quotation-actions">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => {
          const Icon = ICONS[a.key];
          const reason = a.disabledReason ?? blockedReason;
          return (
            <Button
              key={a.key}
              size="sm"
              variant={a.primary ? 'default' : 'outline'}
              disabled={busy || Boolean(reason)}
              title={reason}
              onClick={() => onRun(a)}
            >
              {Icon ? <Icon aria-hidden /> : null} {a.label}
            </Button>
          );
        })}
      </div>
      {reasons.map((r) => <p key={r} className="text-xs text-muted-foreground">{r}</p>)}
    </div>
  );
}
