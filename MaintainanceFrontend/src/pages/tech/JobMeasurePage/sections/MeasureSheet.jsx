import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CloudOff, Loader2, Plus, Save } from 'lucide-react';
import { useMeasureMyJobLineMutation } from '@/api/techApi';
import { MeasurementCard } from '@/components/tech/MeasurementCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRefusal, isMeasured } from '@/helpers/closeout';
import { formatQty, groupMeasurementsByArea, readableTotal } from '@/helpers/measurements';
import { selectFieldSync } from '@/redux/slices/fieldSyncSlice';
import { toastSuccess } from '@/redux/slices/uiSlice';
import {
  blankRow, measureBody, measureProblem, phoneTotal, rowsFromLine, sameAsSaved,
} from '../jobMeasure';

const online = () => navigator.onLine !== false;

/**
 * One line's final measurement on a phone (Phase L8) — Phase L5's card pattern: rooms, and in each one card per row
 * (what, nos, L, B, H in feet-inches, a deduction), the room's and the line's totals as a **preview**, and the quantity
 * the office holds once saved (the server's `measuredQty`). **Save** is pinned at the bottom and sends `PUT
 * /tech/jobs/:id/lines/:lineId/measure` — the rows as numbers, never a rate. It needs signal (`/tech/sync` has no kind
 * for it): with none the screen says so and keeps the cards. A refusal is said in the technician's words.
 *
 * @param {{ job: object, line: object, t: object, readOnly: boolean, onRefused?: (code: string) => void }} props
 */
export function MeasureSheet({ job, line, t, readOnly, onRefused }) {
  const dispatch = useDispatch();
  const { online: signal } = useSelector(selectFieldSync);
  const [measure, { isLoading: saving }] = useMeasureMyJobLineMutation();
  const [rows, setRows] = useState(() => rowsFromLine(line));
  const [room, setRoom] = useState('');
  const [problem, setProblem] = useState(null);
  const unit = line.unit ?? '';
  const groups = groupMeasurementsByArea(rows);
  const saved = sameAsSaved(rows, line);

  const change = (next) => {
    setRows(next);
    setProblem(null);
  };
  const addRowIn = (area) => {
    const last = rows.map((r) => String(r.area ?? '').trim()).lastIndexOf(area);
    const at = last < 0 ? rows.length : last + 1;
    change([...rows.slice(0, at), blankRow(area), ...rows.slice(at)]);
  };
  const renameRoom = (from, to) => change(rows.map((r) => (String(r.area ?? '').trim() === from ? { ...r, area: to } : r)));

  const save = async () => {
    const why = measureProblem(rows);
    if (why) {
      setProblem(t[why]);
      return;
    }
    if (!online()) {
      setProblem(t.offline);
      return;
    }
    try {
      const answer = await measure({ id: job.id, lineId: line.id, ...measureBody(rows) }).unwrap();
      dispatch(toastSuccess(t.savedTitle, t.savedBody(formatQty(answer.measuredQty), unit)));
    } catch (err) {
      const refusal = apiRefusal(err);
      if (!refusal?.status || refusal.status === 'FETCH_ERROR') {
        setProblem(t.offline);
        return;
      }
      setProblem(t.refused[refusal.code] ?? refusal.message ?? t.failed);
      if (refusal.code) onRefused?.(refusal.code);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold leading-tight">{[line.number, line.description].filter(Boolean).join(' · ')}</h2>
        <p className="text-sm tabular-nums text-muted-foreground">{t.quoted(formatQty(line.quotedQty), unit)}</p>
      </div>

      {!signal && !readOnly ? (
        <p role="status" className="surface-warning flex items-start gap-2 rounded-lg border p-3 text-sm">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t.offline}
        </p>
      ) : null}

      {groups.length ? groups.map((group) => (
        <Card key={group.rows[0]._key}>
          <CardContent className="space-y-3 p-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`room-${group.rows[0]._key}`} className="text-xs">{t.room}</Label>
                <Input
                  id={`room-${group.rows[0]._key}`}
                  value={group.rows[0].area ?? ''}
                  maxLength={80}
                  onChange={(e) => renameRoom(group.area, e.target.value)}
                  placeholder={t.noRoom}
                  disabled={readOnly}
                  className="h-12 text-base font-semibold"
                />
              </div>
              <p className="shrink-0 pb-3 text-sm font-semibold tabular-nums" data-testid="room-total">
                {t.roomTotal(formatQty(readableTotal(group.rows)), unit)}
              </p>
            </div>
            <ol className="space-y-3">
              {group.rows.map((row) => {
                const index = rows.indexOf(row);
                return (
                  <MeasurementCard
                    key={row._key}
                    row={row}
                    number={index + 1}
                    unit={unit}
                    readOnly={readOnly}
                    t={t}
                    onChange={(patch) => change(rows.map((r) => (r._key === row._key ? { ...r, ...patch } : r)))}
                    onRemove={() => change(rows.filter((r) => r._key !== row._key))}
                  />
                );
              })}
            </ol>
            {!readOnly ? (
              <Button type="button" variant="outline" className="h-12 w-full" onClick={() => addRowIn(group.area)}>
                <Plus className="h-4 w-4" /> {t.addRow(group.area || t.noRoom)}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.empty}</p>
      )}

      {!readOnly ? (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Label htmlFor="new-room">{t.room}</Label>
          <div className="flex gap-2">
            <Input
              id="new-room"
              value={room}
              maxLength={80}
              onChange={(e) => setRoom(e.target.value)}
              placeholder={t.roomPlaceholder}
              className="h-12 min-w-0 text-base"
            />
            <Button
              type="button"
              className="h-12 shrink-0"
              onClick={() => { change([...rows, blankRow(room.trim())]); setRoom(''); }}
            >
              <Plus className="h-4 w-4" /> {t.addRoom}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
        <p className="font-semibold tabular-nums" data-testid="line-total">{t.lineTotal(formatQty(phoneTotal(rows)), unit)}</p>
        <p className="text-xs text-muted-foreground">{t.preview}</p>
        {isMeasured(line) && saved ? (
          <p className="mt-1 font-medium tabular-nums text-success" data-testid="office-qty">{t.saved(formatQty(line.measuredQty), unit)}</p>
        ) : !saved && !readOnly ? (
          <p className="mt-1 text-xs text-warning" data-testid="measure-unsaved">{t.unsaved}</p>
        ) : null}
      </div>

      {problem ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{problem}</p> : null}

      {!readOnly ? (
        <div className="sticky bottom-20 z-10 mt-4 rounded-lg border bg-background/95 p-3 backdrop-blur">
          <Button type="button" size="xl" className="h-14 w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? t.saving : t.save}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
