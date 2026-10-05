import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Lock, LockOpen, Ruler } from 'lucide-react';
import { useCloseJobMeasurementMutation, useReopenJobMeasurementMutation } from '@/api/jobsApi';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/hooks/useConfirm';
import { CONTRACT_TYPE_LABELS } from '@/config/constants';
import { apiRefusal, measurementState } from '@/helpers/closeout';
import { formatDateTime } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

/** What the contract measures, in the office's words. */
const WHAT_IS_MEASURED = {
  ITEM_RATE: 'An item-rate job bills what was measured: every line but an omission is measured, then the measurement is closed.',
  LUMP_SUM: 'A lump-sum job bills its quoted quantities; only a provisional line is measured.',
};

/**
 * The job's **final measurement** (Phase L8), on the BOQ & progress tab: the contract type and what it measures, how
 * many of the lines it measures have the server's quantity, and **Close measurement** / **Reopen measurement**
 * (`jobs:write`). Closing is refused while a line is unmeasured — 422 MEASUREMENT_INCOMPLETE lists them, and each opens
 * its sheet here; reopening is refused once the final bill is raised (422 FINAL_ALREADY_BILLED). Counts, never money.
 *
 * @param {{ job: object, canWrite: boolean, onMeasure: (lineId: string) => void }} props
 */
export function JobMeasurementCard({ job, canWrite, onMeasure }) {
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [close, { isLoading: closing }] = useCloseJobMeasurementMutation();
  const [reopen, { isLoading: reopening }] = useReopenJobMeasurementMutation();
  const [refusal, setRefusal] = useState(null);
  const state = measurementState(job);
  const lines = new Map((job.lines ?? []).map((l) => [l.id, l]));

  const closeIt = async () => {
    const ok = await confirm({
      title: 'Close the final measurement?',
      description: 'The quantities are fixed from here and the final bill is worked out from them. It can be reopened until the final bill is raised.',
      confirmLabel: 'Close measurement',
    });
    if (!ok) return;
    setRefusal(null);
    try {
      await close({ id: job.id }).unwrap();
      dispatch(toastSuccess('Measurement closed', `${job.number} is ready for its final bill.`));
    } catch (err) {
      setRefusal(apiRefusal(err));
    }
  };

  const reopenIt = async () => {
    const ok = await confirm({
      title: 'Reopen the final measurement?',
      description: 'The lines can be measured again from the office and from site. Close it again before the final bill.',
      confirmLabel: 'Reopen measurement',
    });
    if (!ok) return;
    setRefusal(null);
    try {
      await reopen({ id: job.id }).unwrap();
      dispatch(toastSuccess('Measurement reopened', job.number));
    } catch (err) {
      setRefusal(apiRefusal(err));
    }
  };

  return (
    <Card role="region" aria-labelledby="final-measurement" data-testid="final-measurement" data-state={state.closed ? 'closed' : 'open'}>
      <CardHeader className="pb-3">
        <CardTitle id="final-measurement" className="flex flex-wrap items-center gap-2 text-base">
          <Ruler className="h-4 w-4 text-primary" aria-hidden /> Final measurement
          {state.closed ? <StateBadge tone="success">Closed</StateBadge> : <StateBadge tone="warning">Open</StateBadge>}
          {state.contractType ? <StateBadge tone="info">{CONTRACT_TYPE_LABELS[state.contractType]}</StateBadge> : null}
        </CardTitle>
        <CardDescription>{WHAT_IS_MEASURED[state.contractType] ?? 'The lines are measured on site or here; the server works out each quantity.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="measurement-count">
          {state.required
            ? `${state.measured} of ${state.required} ${state.required === 1 ? 'line' : 'lines'} measured.`
            : 'No line on this job needs measuring.'}
        </p>
        {state.closed ? (
          <p className="flex items-center gap-2 text-muted-foreground" data-testid="measurement-closed-by">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Closed {formatDateTime(state.closedAt)}{state.closedBy ? ` by ${state.closedBy}` : ''}.
          </p>
        ) : null}

        {refusal ? (
          <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-3" data-testid="measurement-refusal">
            <p className="font-medium text-destructive">{refusal.message}</p>
            {refusal.code === 'MEASUREMENT_INCOMPLETE' && refusal.details.length ? (
              <ul className="space-y-1">
                {refusal.details.map((d) => (
                  <li key={d.lineId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{[d.number, d.description].filter(Boolean).join(' · ')}</span>
                    {canWrite && lines.has(d.lineId) ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => onMeasure(d.lineId)}>Measure…</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            {state.closed ? (
              <Button type="button" variant="outline" size="sm" onClick={reopenIt} disabled={reopening}>
                <LockOpen aria-hidden /> Reopen measurement
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={closeIt} disabled={closing}>
                <Lock aria-hidden /> Close measurement
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
