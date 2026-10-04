import { Minus, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { toLatinDigits } from '@/helpers/format';
import { MAX_HEADCOUNT, headcountTotal, stepCount } from '../siteDiary';

/**
 * Who was on site, per trade — daily-wage workers are not app users, so the diary counts them. Big − and + for gloved
 * thumbs, and the count can be typed for a big crew — in Latin or Nepali digits. The total is a count of people,
 * nothing else.
 */
export function HeadcountCard({ trades, headcount, onChange, readOnly }) {
  const t = useT(FIELD);
  const total = headcountTotal(headcount);
  const set = (tradeId, count) => onChange({ ...headcount, [tradeId]: count });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{t('diary.headcount.title')}</CardTitle>
          <CardDescription>{t('diary.headcount.body')}</CardDescription>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums" data-testid="headcount-total">
          <Users className="h-3.5 w-3.5" aria-hidden /> {t('diary.headcount.total', { count: total })}
        </span>
      </CardHeader>
      <CardContent className="pb-4">
        {!trades.length ? <p className="text-sm text-muted-foreground">{t('diary.headcount.none')}</p> : (
          <ul className="divide-y rounded-lg border">
            {trades.map((trade) => {
              const count = Number(headcount[trade.id]) || 0;
              return (
                <li key={trade.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{trade.name}</span>
                    {trade.code ? <span className="block font-mono text-xs text-muted-foreground">{trade.code}</span> : null}
                  </span>
                  <Button
                    type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || count <= 0}
                    onClick={() => set(trade.id, stepCount(count, -1))} aria-label={t('diary.headcount.less', { trade: trade.name })}
                  >
                    <Minus />
                  </Button>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    value={count ? String(count) : ''}
                    placeholder="0"
                    onChange={(e) => set(trade.id, stepCount(Math.floor(Number(toLatinDigits(e.target.value)) || 0), 0))}
                    disabled={readOnly}
                    aria-label={t('diary.headcount.count', { trade: trade.name })}
                    className="h-12 w-14 shrink-0 px-1 text-center text-lg font-semibold tabular-nums"
                  />
                  <Button
                    type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || count >= MAX_HEADCOUNT}
                    onClick={() => set(trade.id, stepCount(count, 1))} aria-label={t('diary.headcount.more', { trade: trade.name })}
                  >
                    <Plus />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
