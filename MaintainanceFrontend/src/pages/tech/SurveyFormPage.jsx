import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Plus, Trash2, Save, Send, Loader2, MapPin, Phone } from 'lucide-react';
import {
  useGetMySurveyQuery,
  useSaveSurveyDraftMutation,
  useSubmitSurveyMutation,
  useGetTechRateCardQuery,
  useGetTechMaterialsQuery,
} from '@/features/technician/techApi';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/components/motion';
import { toastError, toastSuccess } from '@/features/ui/uiSlice';
import { SURVEY_ITEM_KINDS, SURVEY_METRICS, PRIORITIES, UNITS } from '@/lib/constants';
import { enqueue } from '@/lib/offlineQueue';
import { titleCase } from '@/lib/format';

const EDITABLE = ['DRAFT', 'RETURNED'];
const blankReading = () => ({ label: '', metric: 'moisture', value: '', unit: '', textValue: '' });
const blankItem = () => ({ kind: 'MATERIAL', description: '', unit: 'nos', qty: '', wastagePct: 0, materialId: null, rateCardItemId: null });

/**
 * What the surveyor fills in on site.
 *
 * There is no price anywhere on this screen, by design: the reference lists the
 * app downloads carry codes, names and units only. The surveyor reports what and
 * how much; the office decides what it costs.
 */
export default function SurveyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { data: survey, isLoading, error, refetch } = useGetMySurveyQuery(id);
  const { data: rateCard } = useGetTechRateCardQuery();
  const { data: materials } = useGetTechMaterialsQuery();
  const [saveDraft, { isLoading: saving }] = useSaveSurveyDraftMutation();
  const [submit, { isLoading: submitting }] = useSubmitSurveyMutation();

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!survey || form) return;
    setForm({
      problemSummary: survey.problemSummary ?? '',
      diagnosis: survey.diagnosis ?? '',
      recommendation: survey.recommendation ?? '',
      accessNotes: survey.accessNotes ?? '',
      riskNotes: survey.riskNotes ?? '',
      areaValue: survey.areaValue ?? '',
      areaUnit: survey.areaUnit ?? 'sq.ft',
      estimatedDays: survey.estimatedDays ?? '',
      urgency: survey.urgency ?? 'NORMAL',
      readings: survey.readings?.length
        ? survey.readings.map((r) => ({ ...r, value: r.value ?? '', unit: r.unit ?? '', textValue: r.textValue ?? '' }))
        : [blankReading()],
      items: survey.items?.length
        ? survey.items.map((i) => ({ ...i, wastagePct: i.wastagePct ?? 0 }))
        : [blankItem()],
    });
  }, [survey, form]);

  if (isLoading || !form) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const editable = EDITABLE.includes(survey.status);

  /** Strips empty rows and coerces the numeric fields the API expects. */
  const payload = () => ({
    problemSummary: form.problemSummary || undefined,
    diagnosis: form.diagnosis || undefined,
    recommendation: form.recommendation || undefined,
    accessNotes: form.accessNotes || undefined,
    riskNotes: form.riskNotes || undefined,
    areaValue: form.areaValue === '' ? undefined : Number(form.areaValue),
    areaUnit: form.areaUnit || undefined,
    estimatedDays: form.estimatedDays === '' ? undefined : Number(form.estimatedDays),
    urgency: form.urgency,
    readings: form.readings
      .filter((r) => r.label.trim() && (r.value !== '' || r.textValue.trim()))
      .map((r, i) => ({
        label: r.label, metric: r.metric || 'observation',
        value: r.value === '' ? undefined : Number(r.value),
        unit: r.unit || undefined,
        textValue: r.textValue || undefined,
        sortOrder: i,
      })),
    items: form.items
      .filter((it) => it.description.trim() && Number(it.qty) > 0)
      .map((it, i) => ({
        kind: it.kind,
        materialId: it.materialId || undefined,
        rateCardItemId: it.rateCardItemId || undefined,
        description: it.description,
        unit: it.unit,
        qty: Number(it.qty),
        wastagePct: Number(it.wastagePct || 0),
        isOptional: Boolean(it.isOptional),
        note: it.note || undefined,
        sortOrder: i,
      })),
  });

  /** A request that never reached the server has no `data` — that is the offline case. */
  const isOffline = (err) => !navigator.onLine || err?.status === 'FETCH_ERROR' || !err?.data;

  const onSave = async () => {
    const body = payload();
    try {
      await saveDraft({ id, ...body }).unwrap();
      dispatch(toastSuccess('Saved'));
    } catch (err) {
      if (isOffline(err)) {
        await enqueue({ kind: 'survey_draft', surveyId: id, payload: body });
        dispatch(toastSuccess('Saved on this phone', 'It will reach the office when you have signal.'));
        return;
      }
      dispatch(toastError(err?.data?.error?.message ?? 'Could not save'));
    }
  };

  const onSubmit = async () => {
    const body = payload();
    try {
      await submit({ id, ...body }).unwrap();
      dispatch(toastSuccess('Survey submitted', 'The office will price it and send the quotation.'));
      navigate('/tech/surveys');
    } catch (err) {
      if (isOffline(err)) {
        // Draft first, then submit — /tech/sync replays them in this order.
        await enqueue({ kind: 'survey_draft', surveyId: id, payload: body });
        await enqueue({ kind: 'survey_submit', surveyId: id, payload: { note: 'Submitted offline' } });
        dispatch(toastSuccess('Queued on this phone', 'It will be submitted as soon as you have signal.'));
        navigate('/tech/surveys');
        return;
      }
      dispatch(toastError(err?.data?.error?.message ?? 'Could not submit the survey'));
    }
  };

  const set = (patch) => setForm({ ...form, ...patch });
  const setRow = (key, i, patch) =>
    set({ [key]: form[key].map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const addRow = (key, blank) => set({ [key]: [...form[key], blank()] });
  const removeRow = (key, i) => set({ [key]: form[key].filter((_, idx) => idx !== i) });

  return (
    <PageTransition>
      <div className="mb-4 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tech/surveys')} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{survey.number}</span>
            <StatusBadge status={survey.status} />
          </div>
          <p className="truncate font-semibold">{survey.customer?.name}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {survey.customer?.phone ? (
              <a href={`tel:${survey.customer.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                <Phone className="h-3.5 w-3.5" aria-hidden />{survey.customer.phone}
              </a>
            ) : null}
            {survey.site?.address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(survey.site.address)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />{survey.site.address}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {survey.returnedReason ? (
        <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          Sent back: {survey.returnedReason}
        </p>
      ) : null}

      {!editable ? (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This survey is with the office and can no longer be edited.
        </p>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">What you found</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="What the customer reports" id="problem">
              <Textarea id="problem" rows={2} value={form.problemSummary} onChange={(e) => set({ problemSummary: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="Diagnosis — the cause, not the symptom" id="diagnosis">
              <Textarea id="diagnosis" rows={3} value={form.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="What you recommend" id="recommendation">
              <Textarea id="recommendation" rows={3} value={form.recommendation} onChange={(e) => set({ recommendation: e.target.value })} disabled={!editable} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area measured" id="areaValue">
                <div className="flex gap-2">
                  <Input id="areaValue" type="number" inputMode="decimal" value={form.areaValue} onChange={(e) => set({ areaValue: e.target.value })} disabled={!editable} />
                  <Select value={form.areaUnit} onValueChange={(v) => set({ areaUnit: v })} disabled={!editable}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Days of work" id="days">
                <Input id="days" type="number" inputMode="decimal" value={form.estimatedDays} onChange={(e) => set({ estimatedDays: e.target.value })} disabled={!editable} />
              </Field>
            </div>
            <Field label="Urgency" id="urgency">
              <Select value={form.urgency} onValueChange={(v) => set({ urgency: v })} disabled={!editable}>
                <SelectTrigger id="urgency"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Access notes" id="access">
              <Textarea id="access" rows={2} value={form.accessNotes} onChange={(e) => set({ accessNotes: e.target.value })} placeholder="Scaffolding, parking, water point, stairs…" disabled={!editable} />
            </Field>
            <Field label="Risks" id="risks">
              <Textarea id="risks" rows={2} value={form.riskNotes} onChange={(e) => set({ riskNotes: e.target.value })} disabled={!editable} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Readings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {form.readings.map((r, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input
                    value={r.label} onChange={(e) => setRow('readings', i, { label: e.target.value })}
                    placeholder="Where — e.g. north wall, 300mm up" disabled={!editable}
                    aria-label={`Reading ${i + 1} location`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeRow('readings', i)} disabled={!editable || form.readings.length === 1} aria-label={`Remove reading ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={r.metric} onValueChange={(v) => setRow('readings', i, { metric: v })} disabled={!editable}>
                    <SelectTrigger aria-label={`Reading ${i + 1} metric`}><SelectValue /></SelectTrigger>
                    <SelectContent>{SURVEY_METRICS.map((m) => <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    type="number" inputMode="decimal" value={r.value}
                    onChange={(e) => setRow('readings', i, { value: e.target.value })}
                    placeholder="Value" disabled={!editable} aria-label={`Reading ${i + 1} value`}
                  />
                  <Input
                    value={r.unit} onChange={(e) => setRow('readings', i, { unit: e.target.value })}
                    placeholder="%, mm…" disabled={!editable} aria-label={`Reading ${i + 1} unit`}
                  />
                </div>
                <Input
                  value={r.textValue} onChange={(e) => setRow('readings', i, { textValue: e.target.value })}
                  placeholder="Or an observation — e.g. no DPC visible" disabled={!editable}
                  aria-label={`Reading ${i + 1} observation`}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addRow('readings', blankReading)} disabled={!editable}>
              <Plus className="h-4 w-4" /> Add reading
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What the job needs</CardTitle>
            <p className="text-xs text-muted-foreground">Quantities only — the office prices it.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.items.map((it, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Select value={it.kind} onValueChange={(v) => setRow('items', i, { kind: v, materialId: null, rateCardItemId: null })} disabled={!editable}>
                    <SelectTrigger className="w-32" aria-label={`Line ${i + 1} kind`}><SelectValue /></SelectTrigger>
                    <SelectContent>{SURVEY_ITEM_KINDS.map((k) => <SelectItem key={k} value={k}>{titleCase(k)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => removeRow('items', i)} disabled={!editable || form.items.length === 1} aria-label={`Remove line ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {it.kind === 'MATERIAL' ? (
                  <Select
                    value={it.materialId ?? 'none'}
                    onValueChange={(v) => {
                      const m = materials?.find((x) => x.id === v);
                      setRow('items', i, { materialId: v === 'none' ? null : v, ...(m ? { description: it.description || m.name, unit: m.unit } : {}) });
                    }}
                    disabled={!editable}
                  >
                    <SelectTrigger aria-label={`Line ${i + 1} material`}><SelectValue placeholder="Pick a material" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not in the list</SelectItem>
                      {(materials ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.code} · {m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={it.rateCardItemId ?? 'none'}
                    onValueChange={(v) => {
                      const c = rateCard?.find((x) => x.id === v);
                      setRow('items', i, { rateCardItemId: v === 'none' ? null : v, ...(c ? { description: it.description || c.name, unit: c.unit } : {}) });
                    }}
                    disabled={!editable}
                  >
                    <SelectTrigger aria-label={`Line ${i + 1} rate card item`}><SelectValue placeholder="Pick from the rate card" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not in the list</SelectItem>
                      {(rateCard ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <Input
                  value={it.description} onChange={(e) => setRow('items', i, { description: e.target.value })}
                  placeholder="Describe the line" disabled={!editable} aria-label={`Line ${i + 1} description`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number" inputMode="decimal" value={it.qty}
                    onChange={(e) => setRow('items', i, { qty: e.target.value })}
                    placeholder="Qty" disabled={!editable} aria-label={`Line ${i + 1} quantity`}
                  />
                  <Select value={it.unit} onValueChange={(v) => setRow('items', i, { unit: v })} disabled={!editable}>
                    <SelectTrigger aria-label={`Line ${i + 1} unit`}><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    type="number" inputMode="decimal" min="0" max="100" value={it.wastagePct}
                    onChange={(e) => setRow('items', i, { wastagePct: e.target.value })}
                    placeholder="Waste %" disabled={!editable} aria-label={`Line ${i + 1} wastage percent`}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addRow('items', blankItem)} disabled={!editable}>
              <Plus className="h-4 w-4" /> Add line
            </Button>
          </CardContent>
        </Card>
      </div>

      {editable ? (
        <div
          className="sticky bottom-20 mt-4 flex gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Button variant="outline" className="flex-1" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
          <Button className="flex-1" onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
          </Button>
        </div>
      ) : null}
    </PageTransition>
  );
}

function Field({ label, id, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
