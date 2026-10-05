import { useState } from 'react';
import { Crosshair, Loader2, MapPin, MapPinCheck, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/helpers/utils';
import { WEAK_FIX_M, currentFix } from '@/pages/tech/SurveyFormPage/surveyForm';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

const mapHref = (pin) => `https://www.google.com/maps?q=${pin.lat},${pin.lng}`;

/**
 * Step 2 — arrived: the phone's GPS becomes the site's pin (`sitePin` in the survey's next save, which moves
 * CustomerSite lat/lng). When the site already has a pin — saved by the office, or taken a moment ago — the
 * surveyor confirms before it is replaced. The accuracy the phone reports is shown, and a weak fix says so.
 *
 * @param {{ site: object, pin: { lat: number, lng: number, accuracy?: number }|null,
 *   onPin: (pin: { lat: number, lng: number, accuracy?: number }) => void, readOnly: boolean }} props
 */
export function ArrivedStep({ site, pin, onPin, readOnly }) {
  const t = useT(FIELD);
  const [state, setState] = useState({ status: 'idle', reason: null });
  const [confirm, confirmDialog] = useConfirm();
  const saved = site?.lat != null && site?.lng != null ? { lat: site.lat, lng: site.lng } : null;
  const shown = pin ?? saved;

  const locate = async () => {
    setState({ status: 'locating', reason: null });
    let fix;
    try {
      fix = await currentFix();
    } catch (err) {
      setState({ status: 'error', reason: err.reason ?? 'unavailable' });
      return;
    }
    setState({ status: 'idle', reason: null });
    if (shown) {
      const ok = await confirm({
        title: t('survey.arrived.confirmTitle'),
        description: t('survey.arrived.confirmBody'),
        confirmLabel: t('survey.arrived.replace'),
        cancelLabel: t('survey.arrived.keep'),
      });
      if (!ok) return;
    }
    onPin(fix);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('survey.arrived.body')}</p>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          {shown ? (
            <div className="space-y-1" data-testid="site-pin">
              <p className="flex items-center gap-2 font-medium">
                <MapPinCheck className="h-4 w-4 text-success" aria-hidden /> {t(pin ? 'survey.arrived.pinned' : 'survey.arrived.saved')}
              </p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">{shown.lat}, {shown.lng}</p>
              {pin?.accuracy != null ? (
                <p className={cn('text-xs', pin.accuracy > WEAK_FIX_M ? 'text-warning' : 'text-muted-foreground')}>
                  {t(pin.accuracy > WEAK_FIX_M ? 'survey.arrived.accuracyWeak' : 'survey.arrived.accuracy', { m: pin.accuracy })}
                </p>
              ) : null}
              <a href={mapHref(shown)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline">
                <Navigation className="h-4 w-4" aria-hidden /> {t('survey.arrived.openMap')}
              </a>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden /> {t('survey.arrived.none')}</p>
          )}

          {!readOnly ? (
            <Button
              type="button"
              size="xl"
              className="h-14 w-full gap-2 text-base"
              variant={shown ? 'outline' : 'default'}
              onClick={locate}
              disabled={state.status === 'locating'}
            >
              {state.status === 'locating' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Crosshair className="h-5 w-5" aria-hidden />}
              {t(state.status === 'locating' ? 'survey.arrived.locating' : shown ? 'survey.arrived.repin' : 'survey.arrived.pin')}
            </Button>
          ) : null}

          {state.status === 'error' ? (
            <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-destructive">
              {t(t.has(`survey.arrived.errors.${state.reason}`) ? `survey.arrived.errors.${state.reason}` : 'survey.arrived.errors.unavailable')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {confirmDialog}
    </div>
  );
}
