import { useState } from 'react';
import { PackageOpen, PackagePlus, PenLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaterialsSheet } from '@/components/tech/MaterialsSheet';
import { cn } from '@/helpers/utils';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { toLatinDigits } from '@/helpers/format';
import { blankDelivery, qtyText } from '../siteDiary';

function Field({ id, label, error, children }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Materials received on site today, each with its challan number: picked from the job's material list (the field
 * app's cached `/tech/materials` — `MaterialsSheet`, quantity in the material's unit) or written in for something not
 * on the list. **A delivery here does not move stock** — the store counts it through purchase lists and issues.
 */
export function ReceivedCard({ rows, onChange, problems = {}, readOnly }) {
  const t = useT(FIELD);
  const [picking, setPicking] = useState(false);
  const set = (key, patch) => onChange(rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  const remove = (key) => onChange(rows.filter((r) => r._key !== key));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('diary.received.title')}</CardTitle>
        <CardDescription>{t('diary.received.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {!rows.length ? <p className="text-sm text-muted-foreground">{t('diary.received.none')}</p> : (
          <ul className="space-y-3">
            {rows.map((row, i) => {
              const issue = problems[row._key] ?? {};
              const id = `delivery-${row._key}`;
              return (
                <li key={row._key} role="group" aria-label={t('diary.received.delivery', { n: i + 1 })} className={cn('space-y-3 rounded-lg border p-3', Object.keys(issue).length && 'border-destructive')}>
                  <div className="flex items-start gap-2">
                    <PackageOpen className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {row.materialId ? (
                      <p className="min-w-0 flex-1 font-medium leading-snug">{row.description}</p>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <Field id={`${id}-what`} label={t('diary.received.what')} error={issue.description ? t(`diary.received.${issue.description}`) : null}>
                          <Input
                            id={`${id}-what`}
                            value={row.description}
                            maxLength={200}
                            onChange={(e) => set(row._key, { description: e.target.value })}
                            placeholder={t('diary.received.whatPlaceholder')}
                            disabled={readOnly}
                            aria-invalid={issue.description ? true : undefined}
                            className="h-12 text-base"
                          />
                        </Field>
                      </div>
                    )}
                    {!readOnly ? (
                      <Button
                        type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-destructive"
                        onClick={() => remove(row._key)} aria-label={t('diary.received.remove', { n: i + 1 })}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      id={`${id}-qty`}
                      label={row.materialId && row.unit ? t('diary.received.qtyIn', { unit: row.unit }) : t('diary.received.qty')}
                      error={issue.qty ? t(`diary.received.${issue.qty}`) : null}
                    >
                      <Input
                        id={`${id}-qty`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={row.qty}
                        onChange={(e) => set(row._key, { qty: toLatinDigits(e.target.value) })}
                        disabled={readOnly}
                        aria-invalid={issue.qty ? true : undefined}
                        className="h-12 text-lg tabular-nums"
                      />
                    </Field>
                    {row.materialId ? (
                      <Field id={`${id}-challan`} label={t('diary.received.challan')}>
                        <Input
                          id={`${id}-challan`}
                          value={row.challanNo}
                          maxLength={60}
                          onChange={(e) => set(row._key, { challanNo: e.target.value })}
                          placeholder={t('diary.received.challanPlaceholder')}
                          disabled={readOnly}
                          className="h-12 text-base"
                        />
                      </Field>
                    ) : (
                      <Field id={`${id}-unit`} label={t('diary.received.unit')}>
                        <Input
                          id={`${id}-unit`}
                          value={row.unit}
                          maxLength={20}
                          onChange={(e) => set(row._key, { unit: e.target.value })}
                          disabled={readOnly}
                          className="h-12 text-base"
                        />
                      </Field>
                    )}
                  </div>
                  {!row.materialId ? (
                    <Field id={`${id}-challan`} label={t('diary.received.challan')}>
                      <Input
                        id={`${id}-challan`}
                        value={row.challanNo}
                        maxLength={60}
                        onChange={(e) => set(row._key, { challanNo: e.target.value })}
                        placeholder={t('diary.received.challanPlaceholder')}
                        disabled={readOnly}
                        className="h-12 text-base"
                      />
                    </Field>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!readOnly ? (
          <div className="grid gap-2">
            <Button type="button" variant="outline" size="xl" className="w-full" onClick={() => setPicking(true)}>
              <PackagePlus aria-hidden /> {t('diary.received.add')}
            </Button>
            <Button type="button" variant="ghost" size="lg" className="w-full" onClick={() => onChange([...rows, blankDelivery()])}>
              <PenLine aria-hidden /> {t('diary.received.notListed')}
            </Button>
            <MaterialsSheet
              open={picking}
              onOpenChange={setPicking}
              section="diary.received"
              onLog={({ material, qty }) => onChange([...rows, blankDelivery({
                materialId: material.id, description: material.name, qty: qtyText(qty), unit: material.unit ?? '',
              })])}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
