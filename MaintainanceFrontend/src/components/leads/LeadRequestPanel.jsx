import { CalendarCheck, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadPhotoGallery } from '@/components/leads/LeadPhotoGallery';
import { LEAD_SOURCE_LABELS, PREFERRED_LOCALE_OPTIONS } from '@/config/constants';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/helpers/format';
import { describeEstimate } from '@/helpers/leadDisplay';

const SLOT_WORDS = { morning: 'Morning (8:00 – 12:00)', afternoon: 'Afternoon (12:00 – 16:00)', evening: 'Evening (16:00 – 19:00)' };

function Fact({ label, children }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Contact details and what the customer asked for: slot, estimate, message, where they came from. */
export function LeadRequestPanel({ lead }) {
  const estimate = describeEstimate(lead.estimatePayload);
  const language = PREFERRED_LOCALE_OPTIONS.find((o) => o.value === lead.preferredLocale)?.label ?? 'English';
  const utm = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <a href={`tel:${lead.phone}`} className="flex items-center gap-2 hover:text-primary">
            <Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {lead.phone}
          </a>
          {lead.altPhone ? (
            <a href={`tel:${lead.altPhone}`} className="flex items-center gap-2 hover:text-primary">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {lead.altPhone}
            </a>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 break-all hover:text-primary">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> {lead.email}
            </a>
          ) : null}
          {lead.address || lead.area ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {[lead.address, lead.area].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
            Preferred language: <span lang={lead.preferredLocale} className="font-medium">{language}</span>
          </p>
          <dl className="space-y-1.5 border-t pt-3">
            <Fact label="Came from">{LEAD_SOURCE_LABELS[lead.source] ?? titleCase(lead.source)}</Fact>
            <Fact label="Page">{lead.sourcePage}</Fact>
            <Fact label="Campaign">{utm}</Fact>
            <Fact label="Received">{formatDateTime(lead.createdAt)}</Fact>
            <Fact label="Owner">{lead.assignedTo?.name ?? 'Unassigned'}</Fact>
            {lead.status === 'LOST' ? <Fact label="Lost because">{lead.lostReason}</Fact> : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">What they asked for</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {lead.preferredAt ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
              Visit requested for {formatDate(lead.preferredAt, { weekday: 'short' })}
              {lead.preferredSlot ? ` · ${SLOT_WORDS[lead.preferredSlot] ?? lead.preferredSlot}` : ''}
            </p>
          ) : null}
          <p className="text-muted-foreground">{lead.service?.name ?? 'General enquiry'}</p>
          {lead.message ? <p className="whitespace-pre-wrap leading-relaxed">{lead.message}</p> : <p className="text-muted-foreground">No message.</p>}
          {lead.estimatedAmount || estimate.length ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 font-medium">
                Website estimate{lead.estimatedAmount ? `: up to ${formatNpr(lead.estimatedAmount)}` : ''}
              </p>
              <dl className="space-y-1">
                {estimate.map(([label, value]) => <Fact key={label} label={label}>{value}</Fact>)}
              </dl>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Whatever they photographed, across the full width — it is the best look at the site. */}
      {lead.photos?.length ? (
        <div className="xl:col-span-2">
          <LeadPhotoGallery photos={lead.photos} leadName={lead.name} />
        </div>
      ) : null}
    </div>
  );
}
