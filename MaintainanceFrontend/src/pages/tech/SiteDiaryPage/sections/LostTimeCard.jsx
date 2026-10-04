import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LOST_TIME_REASONS } from '@/config/constants';
import { cn } from '@/helpers/utils';
import { MAX_LOST_HOURS, stepHours } from '../siteDiary';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { CHIP } from './WeatherCard';

/**
 * Hours the crew could not work, by half hours (0–24), and — once any are lost — why: rain, material late, the
 * customer, a bandh, a festival or something else. The reason is asked for before the day can be saved (the API's rule).
 */
export function LostTimeCard({ hours, reason, onChange, problems = {}, readOnly }) {
  const t = useT(FIELD);
  const value = Number(hours) || 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('diary.lost.title')}</CardTitle>
        <CardDescription>{t('diary.lost.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="flex items-center gap-2">
          <p id="lost-hours-label" className="min-w-0 flex-1 text-sm font-medium">{t('diary.lost.hours')}</p>
          <Button
            type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || value <= 0}
            onClick={() => onChange({ lostHours: stepHours(value, -0.5), ...(stepHours(value, -0.5) === 0 ? { lostReason: null } : {}) })}
            aria-label={t('diary.lost.less')}
          >
            <Minus />
          </Button>
          <output
            aria-labelledby="lost-hours-label"
            aria-live="polite"
            data-testid="lost-hours"
            className={cn('w-16 shrink-0 text-center text-xl font-semibold tabular-nums', problems.lostHours && 'text-destructive')}
          >
            {t('diary.lost.value', { hours: value })}
          </output>
          <Button
            type="button" variant="outline" className="h-12 w-12 shrink-0" disabled={readOnly || value >= MAX_LOST_HOURS}
            onClick={() => onChange({ lostHours: stepHours(value, 0.5) })} aria-label={t('diary.lost.more')}
          >
            <Plus />
          </Button>
        </div>
        {problems.lostHours ? <p className="text-sm font-medium text-destructive">{t(`diary.lost.${problems.lostHours}`)}</p> : null}
        {value > 0 ? (
          <div className="space-y-1.5">
            <p id="lost-reason-label" className="text-sm font-medium">{t('diary.lost.reason')}</p>
            <ToggleGroup
              type="single"
              value={reason ?? ''}
              onValueChange={(v) => onChange({ lostReason: v || null })}
              disabled={readOnly}
              aria-labelledby="lost-reason-label"
              aria-invalid={problems.lostReason ? true : undefined}
              className="grid grid-cols-2 gap-2"
            >
              {LOST_TIME_REASONS.map((r) => (
                <ToggleGroupItem key={r} value={r} variant="outline" className={CHIP}>{t(`diary.lost.reasons.${r}`)}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            {problems.lostReason ? <p className="text-sm font-medium text-destructive" data-testid="lost-reason-error">{t(`diary.lost.${problems.lostReason}`)}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
