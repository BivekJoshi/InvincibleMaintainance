import { ImageIcon, Landmark, MapPin, MessageSquareText, Navigation, Phone, UserRound } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/helpers/utils';
import { siteMapHref } from '@/pages/tech/SurveyFormPage/surveyForm';

function CallButton({ phone, label }) {
  return (
    <a href={`tel:${phone}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 w-full justify-start gap-2 px-4')}>
      <Phone className="h-4 w-4" aria-hidden /> {label} <span className="ml-auto tabular-nums text-muted-foreground">{phone}</span>
    </a>
  );
}

/**
 * Step 1 — before setting off: the site (address, area, landmark, access), who to meet (the customer, and the
 * caretaker named when the visit was booked), what the customer wrote, and the photos they sent with the
 * enquiry. Nothing here has a price (D1); it is all what the customer told us.
 *
 * @param {{ survey: object, words: object }} props  `words` is `fieldCopy().survey`
 */
export function BeforeYouGoStep({ survey, words }) {
  const t = words.before;
  const site = survey.site ?? {};
  const lead = survey.lead ?? {};
  const photos = lead.photos ?? [];
  const mapHref = siteMapHref(site);
  const contactDiffers = site.contactPhone && site.contactPhone !== survey.customer?.phone;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.body}</p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t.site}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {site.address ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{site.address}{site.area ? `, ${site.area}` : ''}</span>
            </p>
          ) : null}
          {site.landmark ? (
            <p className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span><span className="text-muted-foreground">{t.landmark}: </span>{site.landmark}</span>
            </p>
          ) : null}
          {site.accessNotes ? <p className="rounded-md bg-muted px-3 py-2">{site.accessNotes}</p> : null}
          {mapHref ? (
            <a href={mapHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full gap-2')}>
              <Navigation className="h-4 w-4" aria-hidden /> {t.navigate}
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t.contact}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {survey.customer ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">{survey.customer.name}</span>
                <span className="text-muted-foreground">· {t.customer}</span>
              </p>
              {survey.customer.phone ? <CallButton phone={survey.customer.phone} label={t.call(survey.customer.name)} /> : null}
            </div>
          ) : null}
          {site.contactName || contactDiffers ? (
            <div className="space-y-2 border-t pt-2">
              {site.contactName ? (
                <p className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{site.contactName}</span>
                </p>
              ) : null}
              {site.contactPhone ? <CallButton phone={site.contactPhone} label={t.call(site.contactName || site.contactPhone)} /> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" aria-hidden /> {t.message}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lead.message?.trim()
            ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{lead.message}</p>
            : <p className="text-sm text-muted-foreground">{t.noMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" aria-hidden /> {t.photos}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t.photos}>
              {photos.map((p, i) => {
                const media = survey.media?.[p.mediaId];
                const thumb = p.thumb ?? media?.thumb ?? media?.url ?? p.url;
                const full = p.url ?? media?.url ?? thumb;
                return (
                  <li key={p.id} className="overflow-hidden rounded-lg border bg-card">
                    <a href={full ?? undefined} target="_blank" rel="noreferrer" className="block">
                      <div className="aspect-[4/3] bg-muted">
                        {thumb ? (
                          <img src={thumb} alt={p.caption || t.photo(i + 1)} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" aria-hidden /></div>
                        )}
                      </div>
                      {p.caption ? <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{p.caption}</p> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noPhotos}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
