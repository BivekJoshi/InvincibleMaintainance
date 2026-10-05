import { Plus, Ruler, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SURVEY_ITEM_KINDS, UNITS } from '@/config/constants';
import { formatQty } from '@/helpers/measurements';
import { blankItem, isMeasured, lineQty } from '@/pages/tech/SurveyFormPage/surveyForm';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { toLatinDigits } from '@/helpers/format';

/**
 * Step 7 — what the job needs, one card per line: the kind, a material or a work item from the lists (codes,
 * names and units — never a rate), the words, the quantity with its unit and the waste. A line can be
 * **measured** instead ("Measure this line" opens the measurement sheet on it); its quantity is then the sheet's,
 * shown here read only — the server's once synced. Quantities only; the office prices it (D1).
 *
 * @param {{ items: object[], onItems: (items: object[]) => void, onMeasure: (key: string) => void,
 *   serverQty: (item: object) => number|null, materials?: object[], rateCard?: object[], readOnly: boolean }} props
 */
export function LinesStep({ items, onItems, onMeasure, serverQty, materials = [], rateCard = [], readOnly }) {
  const t = useT(FIELD);
  const field = (n, name) => t('survey.lines.lineField', { n, field: t(`survey.lines.${name}`) });
  const set = (key, patch) => onItems(items.map((i) => (i._key === key ? { ...i, ...patch } : i)));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('survey.lines.body')}</p>
      <ol className="space-y-3">
        {items.map((item, i) => {
          const n = i + 1;
          const id = (k) => `line-${item._key}-${k}`;
          const measured = isMeasured(item);
          const office = measured ? serverQty(item) : null;
          return (
            <li key={item._key} role="group" aria-label={t('survey.lines.line', { n })} className="space-y-3 rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={item.kind}
                  onValueChange={(v) => set(item._key, { kind: v, materialId: null, rateCardItemId: null })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-12 w-36" aria-label={field(n, 'kind')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SURVEY_ITEM_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`survey.lines.kinds.${k}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!readOnly ? (
                  <Button
                    type="button" variant="ghost" size="icon" className="ml-auto h-11 w-11"
                    onClick={() => onItems(items.filter((x) => x._key !== item._key))}
                    aria-label={t('survey.lines.remove', { n })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              {item.kind === 'MATERIAL' ? (
                <Select
                  value={item.materialId ?? 'none'}
                  onValueChange={(v) => {
                    const m = materials.find((x) => x.id === v);
                    set(item._key, { materialId: v === 'none' ? null : v, ...(m ? { description: item.description || m.name, unit: m.unit } : {}) });
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-12" aria-label={field(n, 'material')}><SelectValue placeholder={t('survey.lines.pickMaterial')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('survey.lines.notListed')}</SelectItem>
                    {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} · {m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={item.rateCardItemId ?? 'none'}
                  onValueChange={(v) => {
                    const c = rateCard.find((x) => x.id === v);
                    set(item._key, { rateCardItemId: v === 'none' ? null : v, ...(c ? { description: item.description || c.name, unit: c.unit } : {}) });
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-12" aria-label={field(n, 'rateCardItem')}><SelectValue placeholder={t('survey.lines.pickRateCard')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('survey.lines.notListed')}</SelectItem>
                    {rateCard.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Input
                value={item.description}
                maxLength={500}
                onChange={(e) => set(item._key, { description: e.target.value })}
                placeholder={t('survey.lines.description')}
                disabled={readOnly}
                aria-label={field(n, 'description')}
                className="h-12 text-base"
              />

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={id('qty')} className="text-xs">{t('survey.lines.qty')}</Label>
                  <Input
                    id={id('qty')}
                    inputMode="decimal"
                    value={measured ? formatQty(office ?? lineQty(item)) : item.qty}
                    onChange={(e) => set(item._key, { qty: toLatinDigits(e.target.value) })}
                    readOnly={measured}
                    disabled={readOnly}
                    className="h-12 text-base tabular-nums read-only:bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={id('unit')} className="text-xs">{t('survey.lines.unit')}</Label>
                  <Select value={item.unit} onValueChange={(v) => set(item._key, { unit: v })} disabled={readOnly}>
                    <SelectTrigger id={id('unit')} className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={id('waste')} className="text-xs">{t('survey.lines.wastage')}</Label>
                  <Input
                    id={id('waste')}
                    inputMode="decimal"
                    value={item.wastagePct}
                    onChange={(e) => set(item._key, { wastagePct: toLatinDigits(e.target.value) })}
                    disabled={readOnly}
                    className="h-12 text-base tabular-nums"
                  />
                </div>
              </div>

              {measured ? (
                <p className="text-sm font-medium tabular-nums">{t('survey.lines.measured', { qty: formatQty(office ?? lineQty(item)), unit: item.unit })}</p>
              ) : null}
              <Button type="button" variant="outline" className="h-12 w-full gap-2" onClick={() => onMeasure(item._key)}>
                <Ruler className="h-4 w-4" aria-hidden /> {t(measured ? 'survey.lines.editMeasure' : 'survey.lines.measure')}
              </Button>
            </li>
          );
        })}
      </ol>
      {!readOnly ? (
        <Button type="button" variant="outline" className="h-12 w-full" onClick={() => onItems([...items, blankItem()])}>
          <Plus className="h-4 w-4" /> {t('survey.lines.add')}
        </Button>
      ) : null}
    </div>
  );
}
