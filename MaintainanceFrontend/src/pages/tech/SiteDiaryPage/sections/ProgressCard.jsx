import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/helpers/utils';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { linesBySection, qtyText, stepPct } from '../siteDiary';

/**
 * Progress per line of the job's bill of quantities, by section: how far each line has got **in all** (not today's
 * share), in steps of 5 % with big − and +, and Done. A line starts where the job stands (`progressPct`, set by the
 * latest diary day that mentions it); only a line marked on this day is saved with it. Quantities only — a line is
 * its number, words and quoted quantity; no rate reaches this screen.
 */
export function ProgressCard({ lines, progress, onChange, readOnly }) {
  const t = useT(FIELD);
  const groups = linesBySection(lines, t('diary.progress.noSection'));
  const set = (lineId, pct) => onChange({ ...progress, [lineId]: pct });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('diary.progress.title')}</CardTitle>
        <CardDescription>{t('diary.progress.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        {!lines.length ? <p className="text-sm text-muted-foreground">{t('diary.progress.none')}</p> : groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
            <ul className="space-y-2">
              {group.lines.map((line) => {
                const marked = Object.hasOwn(progress, line.id);
                const pct = marked ? Number(progress[line.id]) : Number(line.progressPct) || 0;
                const changed = marked && pct !== (Number(line.progressPct) || 0);
                const name = `${line.number ? `${line.number} ` : ''}${line.description}`;
                return (
                  <li
                    key={line.id}
                    data-testid={`progress-line-${line.id}`}
                    className={cn('space-y-2 rounded-lg border p-3', changed && 'border-primary')}
                  >
                    <div className="flex items-start gap-2">
                      {line.number ? <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{line.number}</span> : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.quotedQty != null ? t('diary.progress.of', { qty: qtyText(line.quotedQty), unit: line.unit ?? '' }) : null}
                          {changed ? <span className="ml-2 font-medium text-primary">{t('diary.progress.changed')}</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-semibold tabular-nums" data-testid={`progress-pct-${line.id}`}>{pct}%</span>
                    </div>
                    <Progress value={pct} aria-label={name} />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || pct <= 0}
                        onClick={() => set(line.id, stepPct(pct, -5))} aria-label={t('diary.progress.less', { line: name })}
                      >
                        <Minus />
                      </Button>
                      <Button
                        type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || pct >= 100}
                        onClick={() => set(line.id, stepPct(pct, 5))} aria-label={t('diary.progress.more', { line: name })}
                      >
                        <Plus />
                      </Button>
                      <Button
                        type="button" variant={pct >= 100 ? 'default' : 'outline'} className="h-12 shrink-0 px-3" disabled={readOnly || pct >= 100}
                        onClick={() => set(line.id, 100)} aria-label={t('diary.progress.markDone', { line: name })}
                      >
                        <Check aria-hidden /> {t('diary.progress.done')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
