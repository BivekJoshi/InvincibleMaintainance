import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AlarmClock, CalendarClock, CalendarPlus, Check, CircleDashed, PhoneCall } from 'lucide-react';
import { useSetLeadNextActionMutation } from '@/api/leadsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { StageAgeChip } from '@/components/leads/StageAgeChip';
import { nextActionSchema } from '@/form/schemas/lead.schema';
import { nextActionFormFields } from '@/config/admin/crmForms';
import { formatDateTime } from '@/helpers/format';
import { lateBy, nextActionState } from '@/helpers/leadFollowUp';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/** Each state's surface: overdue is the loud one, and says so in words as well as colour. */
const LOOK = {
  overdue: { box: 'border-destructive/40 bg-destructive/5', icon: AlarmClock, iconClass: 'text-destructive' },
  today: { box: 'surface-warning', icon: CalendarClock, iconClass: '' },
  later: { box: 'surface-info', icon: CalendarClock, iconClass: '' },
  none: { box: 'surface-warning border-dashed', icon: CircleDashed, iconClass: '' },
};

/**
 * What happens next on a lead (Phase L1): the action, when (Kathmandu time), and whether it is late —
 * an overdue one is set apart and labelled "Overdue". **Done** clears it (`PATCH …/next-action` with
 * `at: null`); **Reschedule** sets a new time, type and note. An open lead with nothing next says so and
 * offers to set one. A won or lost lead has nothing next, so the card is not shown.
 *
 * @param {{ lead: object, canWrite?: boolean, now?: number }} props
 */
export function NextActionCard({ lead, canWrite = false, now }) {
  const dispatch = useDispatch();
  const [setNextAction, { isLoading }] = useSetLeadNextActionMutation();
  const [editing, setEditing] = useState(false);
  const next = nextActionState(lead, now);
  if (!next) return null;

  const look = LOOK[next.state];
  const Icon = look.icon;
  const titleId = `next-action-${lead.id}`;
  const attempts = lead.contactAttempts ?? 0;

  const done = async () => {
    try {
      await setNextAction({ id: lead.id, at: null }).unwrap();
      dispatch(toastSuccess('Next action done', 'Log what came of it, and set the next one.'));
    } catch (err) {
      dispatch(toastError('Could not clear the next action', err?.data?.error?.message));
    }
  };

  return (
    <section aria-labelledby={titleId} className={cn('rounded-xl border px-4 py-3', look.box)}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background/70 ring-1 ring-border">
          <Icon className={cn('h-4 w-4', look.iconClass)} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next action
            {next.state === 'overdue' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-destructive-foreground">
                <AlarmClock className="h-3 w-3" aria-hidden /> Overdue
              </span>
            ) : null}
            {next.state === 'today' ? (
              <span className="rounded-full border border-warning-border bg-background/60 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-warning-foreground">Due today</span>
            ) : null}
          </h2>
          {next.state === 'none' ? (
            <p className="text-sm font-medium text-foreground">Nothing is next — every open lead needs a next action or to be closed.</p>
          ) : (
            <>
              <p className="text-base font-semibold text-foreground">
                {next.label}
                <span className="font-normal text-muted-foreground"> · </span>
                <time dateTime={next.at} title={`${formatDateTime(next.at)} (Nepal time)`}>{next.when}</time>
                {next.state === 'overdue' ? <span className="text-sm font-medium text-destructive"> · {lateBy(next.lateMinutes)} late</span> : null}
              </p>
              {next.note ? <p className="whitespace-pre-wrap break-words text-sm text-foreground/80">{next.note}</p> : null}
            </>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PhoneCall className="h-3 w-3" aria-hidden />
              {attempts === 1 ? '1 contact attempt' : `${attempts} contact attempts`}
            </span>
            <StageAgeChip lead={lead} now={now} />
          </p>
        </div>
        {canWrite ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {next.state === 'none' ? (
              <Button size="sm" onClick={() => setEditing(true)}><CalendarPlus /> Set next action</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={done} loading={isLoading}><Check /> Done</Button>
                <Button size="sm" variant={next.state === 'overdue' ? 'default' : 'outline'} onClick={() => setEditing(true)}>
                  <CalendarClock /> Reschedule
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title={next.state === 'none' ? `Next action for ${lead.name}` : `Reschedule — ${lead.name}`}
        description="Nepal time. The owner is reminded when it falls due."
        schema={nextActionSchema}
        fields={nextActionFormFields}
        defaultValues={{
          at: next.state === 'none' || next.state === 'overdue' ? undefined : next.at,
          type: next.type ?? 'CALL',
          note: next.note ?? '',
        }}
        submitLabel={next.state === 'none' ? 'Set next action' : 'Reschedule'}
        onSubmit={async (body) => {
          await setNextAction({ id: lead.id, ...body }).unwrap();
          dispatch(toastSuccess('Next action set', body.at ? formatDateTime(body.at) : undefined));
        }}
      />
    </section>
  );
}

