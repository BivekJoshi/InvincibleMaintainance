import {
  AlertTriangle, Camera, DoorOpen, Gauge, MapPin, MessageSquareQuote, Phone, Ruler, ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LeadPhotoGallery } from '@/components/leads/LeadPhotoGallery';
import { JOB_PHOTO_KIND_LABELS } from '@/config/constants';
import { formatDate, imageUrl, titleCase } from '@/helpers/format';
import { formatQty, measurementRowValue } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/** One labelled block, rendered only when the surveyor filled it in. */
function Finding({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/** A quantity with a real minus sign: a deduction reads −24.5, not -24.5. */
const signedQty = (n) => (n < 0 ? `−${formatQty(-n)}` : formatQty(n));

/** Where to open the site's pin. */
const pinHref = (site) => (site?.lat != null && site?.lng != null ? `https://www.google.com/maps?q=${site.lat},${site.lng}` : null);

/** The customer's own words and photos from the enquiry — what the office knew before anyone went (Phase L5). */
function FromTheCustomer({ lead, customerName }) {
  const message = lead?.message?.trim();
  const photos = (lead?.photos ?? [])
    .filter((p) => p.url || p.thumb)
    .map((p) => ({ ...p, url: p.url ?? p.thumb, caption: p.caption ?? undefined }));
  if (!message && !photos.length) return null;
  return (
    <>
      {message ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareQuote className="h-4 w-4" aria-hidden /> What the customer wrote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="whitespace-pre-wrap border-l-2 pl-3 text-sm leading-relaxed">{message}</blockquote>
          </CardContent>
        </Card>
      ) : null}
      <LeadPhotoGallery photos={photos} leadName={lead?.name ?? customerName ?? 'the customer'} />
    </>
  );
}

/** The site: address, landmark, who opens the door (tap to call) and the pin the surveyor dropped, with a map link. */
function SiteFacts({ site }) {
  if (!site) return null;
  const pin = pinHref(site);
  const address = [site.address, site.area].filter((v) => !blank(v)).join(', ');
  return (
    <dl className="grid gap-x-6 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
      {address ? (
        <div>
          <dt className="text-xs text-muted-foreground">Address</dt>
          <dd className="flex items-start gap-1"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{address}</dd>
        </div>
      ) : null}
      {site.landmark ? (
        <div>
          <dt className="text-xs text-muted-foreground">Landmark</dt>
          <dd>{site.landmark}</dd>
        </div>
      ) : null}
      {site.contactName || site.contactPhone ? (
        <div>
          <dt className="text-xs text-muted-foreground">Site contact</dt>
          <dd className="flex flex-wrap items-center gap-x-2">
            {site.contactName ? <span>{site.contactName}</span> : null}
            {site.contactPhone ? (
              <a href={`tel:${site.contactPhone}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {site.contactPhone}
              </a>
            ) : null}
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-muted-foreground">Pin</dt>
        <dd>
          {pin ? (
            <a href={pin} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
              Open the pin in Maps
              <span className="ml-1 text-xs font-normal tabular-nums text-muted-foreground">
                ({Number(site.lat).toFixed(5)}, {Number(site.lng).toFixed(5)})
              </span>
            </a>
          ) : <span className="text-muted-foreground">No pin yet</span>}
        </dd>
      </div>
    </dl>
  );
}

/** Why a flagged answer is flagged, from its question: "above 20 %", "yes". */
function flagReason(question) {
  const flag = question?.flag;
  if (!flag) return '';
  const unit = question.unit ? ` ${question.unit}` : '';
  if (question.type === 'NUMBER') {
    const parts = [];
    if (flag.above != null) parts.push(`above ${flag.above}${unit}`);
    if (flag.below != null) parts.push(`below ${flag.below}${unit}`);
    return parts.join(' or ');
  }
  if (question.type === 'YES_NO' && flag.equals) return `answered ${flag.equals}`;
  return '';
}

function answerOf(reading, question) {
  if (reading.value != null) {
    const unit = reading.unit ?? question?.unit;
    return (
      <span className="font-medium tabular-nums">
        {formatQty(reading.value)}{unit ? <span className="text-muted-foreground"> {unit}</span> : null}
      </span>
    );
  }
  if (blank(reading.textValue)) return <span className="text-muted-foreground">—</span>;
  const text = question?.type === 'YES_NO' ? titleCase(String(reading.textValue).trim()) : reading.textValue;
  return <span className="text-sm">{text}</span>;
}

/**
 * The readings, **flagged first**: a flagged one sits on the warning surface and says "Flagged" (and why), so it is not
 * told by colour alone. A reading that answers a checklist question is named by that question (`questionKey`); a
 * photo on the answer shows as a thumbnail.
 */
function Readings({ survey }) {
  const readings = survey.readings ?? [];
  if (!readings.length) return null;
  const questions = new Map((survey.template?.questions ?? []).map((q) => [q.key, q]));
  const ordered = [...readings.filter((r) => r.flagged), ...readings.filter((r) => !r.flagged)];
  const flagged = readings.filter((r) => r.flagged).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Gauge className="h-4 w-4" aria-hidden /> Readings
          {flagged ? (
            <span className="surface-warning inline-flex items-center gap-1 rounded-full border px-2 text-xs font-semibold leading-5">
              <AlertTriangle className="h-3 w-3" aria-hidden /> {flagged} flagged
            </span>
          ) : null}
        </CardTitle>
        {survey.template ? <p className="text-xs text-muted-foreground">Checklist: {survey.template.name}</p> : null}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table aria-label="Readings">
          <TableHeader>
            <TableRow>
              <TableHead>What</TableHead>
              <TableHead className="text-right">Answer</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Taken</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((r) => {
              const question = r.questionKey ? questions.get(r.questionKey) : null;
              const label = question?.label ?? r.label;
              const media = r.mediaId ? survey.media?.[r.mediaId] : null;
              const why = r.flagged ? flagReason(question) : '';
              return (
                <TableRow key={r.id} data-flagged={r.flagged ? 'true' : undefined} className={cn(r.flagged && 'surface-warning')}>
                  <TableCell className="min-w-[12rem]">
                    <p className="font-medium">{label}</p>
                    {question?.labelNe ? <p lang="ne" className="text-xs opacity-80">{question.labelNe}</p> : null}
                    {question && r.label && r.label !== label ? <p className="text-xs opacity-80">{r.label}</p> : null}
                    <p className="text-xs opacity-80">{[titleCase(r.metric ?? ''), r.location].filter(Boolean).join(' · ')}</p>
                    {r.flagged ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Flagged{why ? ` — ${why}` : ''}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{answerOf(r, question)}</TableCell>
                  <TableCell>
                    {media ? (
                      <a href={media.url ?? imageUrl(media, 800) ?? undefined} target="_blank" rel="noreferrer" className="inline-block">
                        <img src={imageUrl(media, 400) ?? ''} alt={`Photo for ${label}`} className="h-10 w-14 rounded object-cover" loading="lazy" />
                      </a>
                    ) : r.mediaId ? <span className="text-xs">Photo attached</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs opacity-80">{formatDate(r.takenAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const lengthCell = (v) => (blank(v) ? '' : formatQty(v));

/**
 * Each measured line's sheet (Phase L5): the rows by area, a deduction marked in words, each row's value as a preview
 * (`helpers/measurements#measurementRowValue`) — and the line's quantity, which is the server's, worked out from them.
 */
function Measurements({ items }) {
  const measured = (items ?? []).filter((item) => item.measurements?.length);
  if (!measured.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="h-4 w-4" aria-hidden /> Measurements
        </CardTitle>
        <p className="text-xs text-muted-foreground">Row values are a preview; each quantity is the server’s, worked out from its rows.</p>
      </CardHeader>
      <CardContent className="space-y-5 px-0">
        {measured.map((item) => (
          <section key={item.id} aria-label={`Measurements for ${item.description}`} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6">
              <h4 className="text-sm font-semibold">{item.description}</h4>
              <p className="text-sm">
                <span className="text-muted-foreground">Quantity </span>
                <span className="font-semibold tabular-nums" data-testid={`measured-qty-${item.id}`}>{formatQty(item.qty)} {item.unit}</span>
              </p>
            </div>
            <Table aria-label={`Measurement sheet for ${item.description}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Nos</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">B</TableHead>
                  <TableHead className="text-right">H</TableHead>
                  <TableHead>Deduct</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.measurements.map((m, i) => {
                  const value = measurementRowValue(m);
                  return (
                    // Measurement rows have no id; the sheet is read-only, so its order is its identity.
                    <TableRow key={i}>
                      <TableCell>{m.area}</TableCell>
                      <TableCell>{m.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{lengthCell(m.nos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{lengthCell(m.l)}</TableCell>
                      <TableCell className="text-right tabular-nums">{lengthCell(m.b)}</TableCell>
                      <TableCell className="text-right tabular-nums">{lengthCell(m.h)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-medium">{m.deduct ? '− deduction' : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{value == null ? '—' : signedQty(value)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/** The survey's photos by the part of the site they show, in the order the surveyor took them; "No area" last. */
function photosByArea(photos = []) {
  const groups = new Map();
  let unplaced = null;
  for (const photo of photos) {
    const area = blank(photo.area) ? null : String(photo.area).trim();
    if (!area) {
      unplaced ??= { area: null, photos: [] };
      unplaced.photos.push(photo);
    } else {
      const key = area.toLowerCase();
      if (!groups.has(key)) groups.set(key, { area, photos: [] });
      groups.get(key).photos.push(photo);
    }
  }
  return [...groups.values(), ...(unplaced ? [unplaced] : [])];
}

function SitePhotos({ photos, media }) {
  if (!photos.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-4 w-4" aria-hidden /> Site photos
          <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums leading-5 text-muted-foreground">{photos.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {photosByArea(photos).map((group) => (
          <section key={group.area ?? '(none)'} aria-label={group.area ?? 'No area'}>
            <h4 className="mb-2 text-sm font-semibold">
              {group.area ?? 'No area'} <span className="text-xs font-normal text-muted-foreground">· {group.photos.length}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.photos.map((p) => {
                const kind = JOB_PHOTO_KIND_LABELS[p.kind] ?? titleCase(p.kind ?? '');
                const image = media?.[p.mediaId];
                return (
                  <figure key={p.id} className="overflow-hidden rounded-md border">
                    <a href={image?.url ?? undefined} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={imageUrl(image, 400) ?? ''}
                        alt={p.caption ?? `${kind} photo${group.area ? ` — ${group.area}` : ''}`}
                        className="aspect-4/3 w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                    <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{kind}</span>
                      {p.caption ? ` · ${p.caption}` : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * What the surveyor found on site, and what the office had before (Phase L5): the customer's message and photos, the
 * findings with the site (landmark, site contact, the pin), the readings with flagged ones first, each measured line's
 * sheet, and the site photos grouped by area. Readings keep their numeric and text forms apart so a moisture
 * percentage stays comparable while an observation stays readable. No money here.
 */
export function SurveyFindings({ survey }) {
  return (
    <div className="space-y-4">
      <FromTheCustomer lead={survey.lead} customerName={survey.customer?.name} />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Findings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Finding label="What the customer reported">{survey.problemSummary}</Finding>
          <Finding label="Diagnosis">{survey.diagnosis}</Finding>
          <Finding label="Recommendation">{survey.recommendation}</Finding>
          <Finding icon={DoorOpen} label="Access">{survey.accessNotes}</Finding>
          <Finding icon={ShieldAlert} label="Risks">{survey.riskNotes}</Finding>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
            {survey.areaValue != null ? (
              <span><span className="text-muted-foreground">Area measured: </span>
                <span className="font-medium">{survey.areaValue} {survey.areaUnit}</span>
              </span>
            ) : null}
            {survey.estimatedDays != null ? (
              <span><span className="text-muted-foreground">Estimated: </span>
                <span className="font-medium">{survey.estimatedDays} day{survey.estimatedDays === 1 ? '' : 's'}</span>
              </span>
            ) : null}
            <span><span className="text-muted-foreground">Urgency: </span>
              <span className="font-medium">{titleCase(survey.urgency ?? 'NORMAL')}</span>
            </span>
          </div>

          <SiteFacts site={survey.site} />
        </CardContent>
      </Card>

      <Readings survey={survey} />
      <Measurements items={survey.items} />
      <SitePhotos photos={survey.job?.photos ?? []} media={survey.media} />
    </div>
  );
}
