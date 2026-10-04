import { Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatQty, isReadableMeasurement, parseLength, readableRowValue } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/* The card's words are `FIELD.sheet` (Phase J1), in the technician's language — the same for the survey's Measure step
   (Phase L5) and the final measurement (Phase L8). */

/**
 * A size as typed — feet-inches (`12'6"`, or `१२'६"` on a Nepali keyboard) or a number — with what it reads as under it.
 * @param {{ id: string, label: string, value: string, onChange: (v: string) => void, readOnly?: boolean }} props
 */
export function LengthInput({ id, label, value, onChange, readOnly }) {
  const t = useT(FIELD);
  const parsed = parseLength(value);
  const feetInches = /['"’”′″]|ft|in/i.test(String(value ?? ''));
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        value={value ?? ''}
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
        <p className="text-xs text-destructive">{t('sheet.unreadable')}</p>
      ) : feetInches && parsed !== undefined ? (
        <p className="text-xs tabular-nums text-muted-foreground">{t('sheet.reads', { qty: formatQty(parsed) })}</p>
      ) : null}
    </div>
  );
}

/**
 * One measurement row as a card — on a phone, one card per row (Phase L5's survey stepper; Phase L8's final measurement
 * reuses it): what it is, nos, L, B, H (feet-inches), the deduction switch and the row's value as a **preview**. Every
 * control is at least 44 px. Quantities only — a card never carries a rate.
 *
 * @param {{ row: object, number: number, unit?: string, onChange: (patch: object) => void, onRemove: () => void,
 *   readOnly?: boolean }} props
 */
export function MeasurementCard({ row, number, unit, onChange, onRemove, readOnly }) {
  const t = useT(FIELD);
  const id = (k) => `m-${row._key}-${k}`;
  const value = readableRowValue(row);
  const readable = isReadableMeasurement(row);
  const name = row.area ? t('sheet.rowIn', { n: number, room: row.area }) : t('sheet.row', { n: number });

  return (
    <li
      role="group"
      aria-label={name}
      data-testid="measurement-card"
      className={cn('space-y-3 rounded-lg border bg-card p-3', row.deduct ? 'border-dashed' : '')}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('sheet.row', { n: number })}</p>
        {!readOnly ? (
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={onRemove} aria-label={t('sheet.removeRow', { n: number })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={id('description')} className="text-xs">{t('sheet.description')}</Label>
        <Input
          id={id('description')}
          value={row.description ?? ''}
          maxLength={200}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t('sheet.descriptionPlaceholder')}
          disabled={readOnly}
          className="h-12 text-base"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={id('nos')} className="text-xs">{t('sheet.nos')}</Label>
          <Input
            id={id('nos')}
            inputMode="decimal"
            value={row.nos ?? ''}
            onChange={(e) => onChange({ nos: e.target.value })}
            disabled={readOnly}
            placeholder="1"
            aria-invalid={Number.isNaN(parseLength(row.nos)) || undefined}
            className="h-12 text-base tabular-nums"
          />
        </div>
        <LengthInput id={id('l')} label={t('sheet.l')} value={row.l} onChange={(v) => onChange({ l: v })} readOnly={readOnly} />
        <LengthInput id={id('b')} label={t('sheet.b')} value={row.b} onChange={(v) => onChange({ b: v })} readOnly={readOnly} />
        <LengthInput id={id('h')} label={t('sheet.h')} value={row.h} onChange={(v) => onChange({ h: v })} readOnly={readOnly} />
      </div>
      <label htmlFor={id('deduct')} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border px-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Minus className="h-4 w-4 text-muted-foreground" aria-hidden /> {t('sheet.deduct')}
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
            = {value < 0 ? '−' : ''}{t('sheet.value', { qty: formatQty(Math.abs(value)), unit: unit ?? '' })}
          </p>
        ) : null
      ) : (
        <p className="text-xs text-destructive">{t('sheet.notSaved')}</p>
      )}
    </li>
  );
}
