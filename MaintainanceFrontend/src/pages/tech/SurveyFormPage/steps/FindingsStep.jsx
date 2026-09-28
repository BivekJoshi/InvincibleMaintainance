import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES, UNITS } from '@/config/constants';

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Step 6 — what the surveyor found: the customer's complaint, the diagnosis (the cause, not the symptom), the
 * recommendation, the area measured, the days of work, the urgency, access and risks.
 *
 * @param {{ form: object, onChange: (patch: object) => void, readOnly: boolean, words: object }} props
 */
export function FindingsStep({ form, onChange, readOnly, words }) {
  const t = words.findings;
  const text = (key, label, rows = 3, placeholder) => (
    <Field id={`finding-${key}`} label={label}>
      <Textarea
        id={`finding-${key}`}
        rows={rows}
        value={form[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        disabled={readOnly}
        className="text-base"
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      {text('problemSummary', t.problem, 2)}
      {text('diagnosis', t.diagnosis)}
      {text('recommendation', t.recommendation)}
      <div className="grid grid-cols-2 gap-3">
        <Field id="finding-areaValue" label={t.areaValue}>
          <div className="flex gap-2">
            <Input
              id="finding-areaValue"
              inputMode="decimal"
              value={form.areaValue}
              onChange={(e) => onChange({ areaValue: e.target.value })}
              disabled={readOnly}
              className="h-12 min-w-0 text-base"
            />
            <Select value={form.areaUnit} onValueChange={(v) => onChange({ areaUnit: v })} disabled={readOnly}>
              <SelectTrigger className="h-12 w-24 shrink-0" aria-label={`${t.areaValue} — ${words.lines.unit}`}><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Field>
        <Field id="finding-days" label={t.days}>
          <Input
            id="finding-days"
            inputMode="decimal"
            value={form.estimatedDays}
            onChange={(e) => onChange({ estimatedDays: e.target.value })}
            disabled={readOnly}
            className="h-12 text-base"
          />
        </Field>
      </div>
      <Field id="finding-urgency" label={t.urgency}>
        <Select value={form.urgency} onValueChange={(v) => onChange({ urgency: v })} disabled={readOnly}>
          <SelectTrigger id="finding-urgency" className="h-12"><SelectValue /></SelectTrigger>
          <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t.urgencies[p]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      {text('accessNotes', t.access, 2, t.accessPlaceholder)}
      {text('riskNotes', t.risks, 2)}
    </div>
  );
}
