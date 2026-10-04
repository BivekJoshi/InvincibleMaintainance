import { useState } from 'react';
import { Clock, Navigation, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { HOLDABLE, NEXT_STATUS } from '@/helpers/fieldJob';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

const ICONS = { EN_ROUTE: Navigation, IN_PROGRESS: Clock };

/** The one next step, pinned above the tab bar — "On my way", "Start work", "Resume work" — and Hold beside it. */
export function NextStepBar({ job, onAdvance, onHold }) {
  const t = useT(FIELD);
  const next = NEXT_STATUS[job.status];
  if (!next) return null;
  const label = t(job.status === 'ON_HOLD' ? 'actions.resume' : `actions.${next}`);
  const Icon = ICONS[next];

  return (
    <div
      className="sticky bottom-20 z-20 mt-4 flex gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Button size="xl" className="flex-1 px-4" onClick={() => onAdvance(next, label)}>
        <Icon className="h-5 w-5" /> {label}
      </Button>
      {HOLDABLE.includes(job.status) ? (
        <Button size="xl" variant="outline" className="shrink-0 px-4" onClick={onHold}>
          <Pause /> {t('job.hold.button')}
        </Button>
      ) : null}
    </div>
  );
}

/** "Why is the work stopping?" — the API refuses ON_HOLD without a reason, so the sheet asks first. */
export function HoldSheet({ open, onOpenChange, onConfirm }) {
  const t = useT(FIELD);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const change = (next) => {
    if (!next) {
      setReason('');
      setError(false);
    }
    onOpenChange(next);
  };

  const confirm = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError(true);
      return;
    }
    await onConfirm(reason.trim());
    change(false);
  };

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" closeLabel={t('close')}>
        <form onSubmit={confirm} className="space-y-4" noValidate>
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>{t('job.hold.title')}</SheetTitle>
            <SheetDescription className="sr-only">{t('job.hold.reason')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-1.5">
            <Label htmlFor="hold-reason">{t('job.hold.reason')}</Label>
            <Textarea
              id="hold-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              placeholder={t('job.hold.placeholder')}
              aria-invalid={error ? 'true' : undefined}
              className="text-base"
            />
            {error ? <p className="text-sm text-destructive">{t('job.hold.required')}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="xl" onClick={() => change(false)}>{t('job.hold.cancel')}</Button>
            <Button type="submit" size="xl">{t('job.hold.confirm')}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
