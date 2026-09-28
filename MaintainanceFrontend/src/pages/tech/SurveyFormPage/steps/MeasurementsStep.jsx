import { useState } from 'react';
import { Minus, Plus, Ruler, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UNITS } from '@/config/constants';
import { formatQty, parseLength } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';
import {
  blankItem, blankMeasurement, groupByArea, isReadableMeasurement, lineQty, roomTotal, rowValue,
} from '@/pages/tech/SurveyFormPage/surveyForm';

/** A size as typed — feet-inches (`12'6"`) or a number — with what it reads as under it. */
function LengthInput({ id, label, value, onChange, readOnly, words }) {
  const t = words.measure;
  const parsed = parseLength(value);
  const feetInches = /['"’”′″]|ft|in/i.test(String(value ?? ''));
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={'12\'6"'}
        aria-invalid={Number.isNaN(parsed) || undefined}
        className="h-12 text-base tabular-nums"
      />
      {Number.isNaN(parsed) ? (
        <p className="text-xs text-destructive">{t.unreadable}</p>
      ) : feetInches && parsed !== undefined ? (
        <p className="text-xs tabular-nums text-muted-foreground">{t.reads(formatQty(parsed))}</p>
      ) : null}
    </div>
  );
}

/**
 * One measurement row as a card — on a phone, one card per row: what it is, nos, L, B, H (feet-inches), the
 * deduction switch and the row's value as a preview.
 */
function MeasurementCard({ row, number, unit, onChange, onRemove, readOnly, words }) {
  const t = words.measure;
  const id = (k) => `m-${row._key}-${k}`;
  const value = rowValue(row);
  const readable = isReadableMeasurement(row);
  const name = `${t.row(number)}${row.area ? ` — ${row.area}` : ''}`;

  return (
    <li
      role="group"
      aria-label={name}
      data-testid="measurement-card"
      className={cn('space-y-3 rounded-lg border bg-card p-3', row.deduct ? 'border-dashed' : '')}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t.row(number)}</p>
        {!readOnly ? (
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={onRemove} aria-label={t.removeRow(number)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={id('description')} className="text-xs">{t.description}</Label>
        <Input
          id={id('description')}
          value={row.description}
          maxLength={200}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t.descriptionPlaceholder}
          disabled={readOnly}
          className="h-12 text-base"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={id('nos')} className="text-xs">{t.nos}</Label>
          <Input
            id={id('nos')}
            inputMode="decimal"
            value={row.nos}
            onChange={(e) => onChange({ nos: e.target.value })}
            disabled={readOnly}
            placeholder="1"
            aria-invalid={Number.isNaN(parseLength(row.nos)) || undefined}
            className="h-12 text-base tabular-nums"
          />
        </div>
        <LengthInput id={id('l')} label={t.l} value={row.l} onChange={(v) => onChange({ l: v })} readOnly={readOnly} words={words} />
        <LengthInput id={id('b')} label={t.b} value={row.b} onChange={(v) => onChange({ b: v })} readOnly={readOnly} words={words} />
        <LengthInput id={id('h')} label={t.h} value={row.h} onChange={(v) => onChange({ h: v })} readOnly={readOnly} words={words} />
      </div>
      <label htmlFor={id('deduct')} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border px-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Minus className="h-4 w-4 text-muted-foreground" aria-hidden /> {t.deduct}
        </span>
        <Switch
          id={id('deduct')}
          checked={Boolean(row.deduct)}
          onCheckedChange={(v) => onChange({ deduct: v })}
          disabled={readOnly}
          className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
        />
      </label>
      {readable ? (
        value !== null ? (
          <p className={cn('text-right text-sm font-semibold tabular-nums', value < 0 ? 'text-destructive' : '')} data-testid="row-value">
            = {value < 0 ? '−' : ''}{t.value(formatQty(Math.abs(value)), unit)}
          </p>
        ) : null
      ) : (
        <p className="text-xs text-destructive">{t.notSaved}</p>
      )}
    </li>
  );
}

/** The inline "What are you measuring?" form — a new line that starts measured. */
function NewLineForm({ onCreate, onCancel, words }) {
  const t = words.measure;
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('sq.ft');
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <Label htmlFor="new-measured-line">{t.newLineTitle}</Label>
        <Input
          id="new-measured-line"
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.newLinePlaceholder}
          className="h-12 text-base"
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-measured-unit">{t.unit}</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger id="new-measured-unit" className="h-12"><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel}>{t.cancel}</Button>
        <Button type="button" className="h-12" disabled={!description.trim()} onClick={() => onCreate(description.trim(), unit)}>{t.create}</Button>
      </div>
    </div>
  );
}

/**
 * Step 4 — the measurement sheet, by room: pick the line (or start a new measured one), then add rooms and,
 * in each, one card per row. Lengths take feet-inches (`helpers/measurements#parseLength`); each row's value
 * and each room's total are worked out on the phone as a preview, and the line's quantity the server derived
 * is shown once the sheet has synced (`serverQty`). Only quantities — never a rate (D1).
 *
 * @param {{ items: object[], lineKey: string|null, onPickLine: (key: string) => void,
 *   onItems: (items: object[]) => void, serverQty: (item: object) => number|null, readOnly: boolean, words: object }} props
 */
export function MeasurementsStep({ items, lineKey, onPickLine, onItems, serverQty, readOnly, words }) {
  const t = words.measure;
  const [adding, setAdding] = useState(false);
  const [room, setRoom] = useState('');
  const selected = items.find((i) => i._key === lineKey) ?? items.find((i) => i.measurements?.length) ?? items[0] ?? null;

  const setRows = (rows) => onItems(items.map((i) => (i._key === selected._key ? { ...i, measurements: rows } : i)));
  const rows = selected?.measurements ?? [];
  const groups = groupByArea(rows);

  const addRowIn = (area) => {
    const last = rows.map((r) => (r.area ?? '').trim()).lastIndexOf(area);
    const at = last < 0 ? rows.length : last + 1;
    setRows([...rows.slice(0, at), blankMeasurement(area), ...rows.slice(at)]);
  };
  const renameRoom = (from, to) => setRows(rows.map((r) => ((r.area ?? '').trim() === from ? { ...r, area: to } : r)));

  const create = (description, unit) => {
    const item = blankItem({ kind: 'SERVICE', description, unit, measurements: [] });
    onItems([...items, item]);
    onPickLine(item._key);
    setAdding(false);
  };

  const office = selected ? serverQty(selected) : null;
  const total = selected ? lineQty(selected) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.body}</p>

      <div className="space-y-2">
        <p className="text-sm font-medium" id="measure-line-label">{t.line}</p>
        {items.length ? (
          <ToggleGroup
            type="single"
            value={selected?._key ?? ''}
            onValueChange={(v) => v && onPickLine(v)}
            aria-labelledby="measure-line-label"
            className="flex flex-wrap justify-start gap-2"
          >
            {items.map((item, i) => (
              <ToggleGroupItem
                key={item._key}
                value={item._key}
                variant="outline"
                className="h-12 max-w-full border px-3 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Ruler className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.description?.trim() || words.lines.line(i + 1)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noLines}</p>
        )}
        {!readOnly ? (
          adding
            ? <NewLineForm onCreate={create} onCancel={() => setAdding(false)} words={words} />
            : (
              <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> {t.newLine}
              </Button>
            )
        ) : null}
      </div>

      {selected ? (
        <section aria-label={selected.description || t.title} className="space-y-4">
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
                    {t.roomTotal(formatQty(roomTotal(group.rows)), selected.unit)}
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
                        unit={selected.unit}
                        readOnly={readOnly}
                        words={words}
                        onChange={(patch) => setRows(rows.map((r) => (r._key === row._key ? { ...r, ...patch } : r)))}
                        onRemove={() => setRows(rows.filter((r) => r._key !== row._key))}
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
                  className="h-12 text-base"
                />
                <Button
                  type="button"
                  className="h-12 shrink-0"
                  onClick={() => { setRows([...rows, blankMeasurement(room.trim())]); setRoom(''); }}
                >
                  <Plus className="h-4 w-4" /> {t.addRoom}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
            <p className="font-semibold tabular-nums" data-testid="line-total">{t.lineTotal(formatQty(total), selected.unit)}</p>
            <p className="text-xs text-muted-foreground">{t.preview}</p>
            {office !== null ? (
              <p className="mt-1 font-medium tabular-nums text-success" data-testid="office-qty">{t.office(formatQty(office), selected.unit)}</p>
            ) : rows.length ? (
              <p className="mt-1 text-xs text-muted-foreground">{t.waiting}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
