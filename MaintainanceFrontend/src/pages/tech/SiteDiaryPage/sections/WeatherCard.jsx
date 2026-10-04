import { Cloud, CloudRain, CloudRainWind, Snowflake, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WEATHER } from '@/config/constants';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

const ICONS = { SUNNY: Sun, CLOUDY: Cloud, RAIN: CloudRain, HEAVY_RAIN: CloudRainWind, COLD: Snowflake };
export const CHIP = 'h-12 gap-1.5 border px-3 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

/** The day's weather — one tap; a second tap on the same chip clears it. */
export function WeatherCard({ value, onChange, readOnly }) {
  const t = useT(FIELD);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle id="diary-weather" className="text-base">{t('diary.weather.title')}</CardTitle></CardHeader>
      <CardContent className="pb-4">
        <ToggleGroup
          type="single"
          value={value ?? ''}
          onValueChange={(v) => onChange(v || null)}
          disabled={readOnly}
          aria-labelledby="diary-weather"
          className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3"
        >
          {WEATHER.map((w) => {
            const Icon = ICONS[w];
            return (
              <ToggleGroupItem key={w} value={w} variant="outline" className={CHIP}>
                <Icon className="h-4 w-4" aria-hidden /> {t(`diary.weather.${w}`)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
