import { CalendarClock, MapPin, Phone, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { telHref } from '../visitPageState';

/** A call link as a big button: full width on a phone, text allowed to wrap (Nepali runs long). */
function CallButton({ phone, children }) {
  return (
    <Button asChild size="xl" variant="outline" className="mt-3 h-auto min-h-12 w-full whitespace-normal px-4 py-2 sm:w-auto">
      <a href={telHref(phone)}><Phone aria-hidden /> {children}</a>
    </Button>
  );
}

function DetailRow({ icon: Icon, label, children, testId }) {
  return (
    <div className="flex gap-3" data-testid={testId}>
      <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
        <div className="mt-1 break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * When, where and who: the window in Kathmandu time, the address with its area and landmark, and the surveyor
 * with a call button — or, before one is named, a line saying the office will tell them, and the office's phone.
 * Nothing about money (D1).
 *
 * @param {{ when: { day: string, time: string }|null, site?: { label?: string, address?: string, area?: string,
 *   landmark?: string }|null, surveyor?: { name: string, phone?: string }|null, officePhone?: string }} props
 */
export function VisitDetails({ when, site, surveyor, officePhone }) {
  const t = useT(DOCUMENTS);
  return (
    <section aria-label={t('visit.details')} className="mt-6 rounded-lg border bg-muted/30 p-4 sm:p-5">
      <div className="space-y-5">
        {when ? (
          <DetailRow icon={CalendarClock} label={t('visit.when')} testId="visit-when">
            <span className="block text-base font-semibold">{when.day}</span>
            <span className="block text-2xl font-bold tabular-nums">{when.time}</span>
            <span className="block text-xs text-muted-foreground">{t('visit.nepalTime')}</span>
          </DetailRow>
        ) : null}

        {site ? (
          <DetailRow icon={MapPin} label={t('visit.where')} testId="visit-where">
            {site.label ? <span className="block font-semibold">{site.label}</span> : null}
            {site.address ? <span className="block">{site.address}</span> : null}
            {site.area ? <span className="block text-muted-foreground">{site.area}</span> : null}
            {site.landmark ? (
              <span className="mt-1 block text-sm">
                <span className="font-medium">{t('visit.landmark')}:</span> {site.landmark}
              </span>
            ) : null}
          </DetailRow>
        ) : null}

        <DetailRow icon={UserRound} label={t('visit.who')} testId="visit-who">
          {surveyor ? (
            <>
              <span className="block text-base font-semibold">{surveyor.name}</span>
              <span className="block text-sm text-muted-foreground">{t('visit.surveyor')}</span>
              {surveyor.phone ? <CallButton phone={surveyor.phone}>{t('visit.callPerson', { name: surveyor.name })}</CallButton> : null}
            </>
          ) : (
            <>
              <span className="block">{t('visit.noSurveyor')}</span>
              {officePhone ? <CallButton phone={officePhone}>{t('visit.callOffice', { phone: officePhone })}</CallButton> : null}
            </>
          )}
        </DetailRow>
      </div>
    </section>
  );
}
