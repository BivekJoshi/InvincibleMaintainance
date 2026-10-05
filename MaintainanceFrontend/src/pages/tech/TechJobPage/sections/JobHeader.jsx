import { ArrowLeft, CloudUpload, Loader2, MapPin, Phone, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { formatTime } from '@/helpers/format';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/** Back, the number and title, the status as it will be once the queue is sent, and what is still waiting. */
export function JobHeader({ job, onBack }) {
  const t = useT(FIELD);
  return (
    <div className="mb-4 flex items-start gap-2">
      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onBack} aria-label={t('job.back')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-muted-foreground">{job.number}</p>
        <h1 className="font-semibold leading-tight">{job.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={job.status} label={t(`status.${job.status}`)} />
          <PriorityBadge priority={job.priority} label={job.priority ? t(`priority.${job.priority}`) : null} />
          {job.scheduledStart ? <span className="text-xs text-muted-foreground">{formatTime(job.scheduledStart, { locale: t.locale })}</span> : null}
          {job.pendingCount ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {t('job.pending')}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Who and where: tap to call, tap for directions, what the job is, how to get in. An inspection opens its survey. */
export function JobContactCard({ job, onOpenSurvey, openingSurvey, readOnly }) {
  const t = useT(FIELD);
  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          {job.customer?.name ? <p className="font-medium">{job.customer.name}</p> : null}
          <div className="grid gap-2">
            {job.customer?.phone ? (
              <Button asChild variant="outline" size="lg" className="justify-start px-3">
                <a href={`tel:${job.customer.phone}`}><Phone aria-hidden />{job.customer.phone}</a>
              </Button>
            ) : null}
            {job.site?.address ? (
              <Button asChild variant="outline" size="lg" className="h-auto min-h-11 justify-start whitespace-normal px-3 py-2 text-left">
                <a href={`https://maps.google.com/?q=${encodeURIComponent(job.site.address)}`} target="_blank" rel="noreferrer">
                  <MapPin aria-hidden />{job.site.address}
                </a>
              </Button>
            ) : null}
          </div>
          {job.description ? <p className="whitespace-pre-wrap text-muted-foreground">{job.description}</p> : null}
          {job.site?.accessNotes ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs">{t('job.accessNote', { notes: job.site.accessNotes })}</p>
          ) : null}
          {job.status === 'ON_HOLD' && job.holdReason ? (
            <p className="surface-warning rounded-md border px-3 py-2 text-xs">{t('job.holdReason', { reason: job.holdReason })}</p>
          ) : null}
        </CardContent>
      </Card>

      {job.type === 'INSPECTION' && !readOnly ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('job.survey.body')}</p>
            <Button size="xl" className="mt-3 w-full" onClick={onOpenSurvey} disabled={openingSurvey}>
              {openingSurvey ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
              {t('job.survey.open')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
