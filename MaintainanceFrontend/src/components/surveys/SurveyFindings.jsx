import { Gauge, MapPin, ShieldAlert, DoorOpen, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, imageUrl, titleCase } from '@/helpers/format';

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

/**
 * What the surveyor found on site. Readings keep their numeric and text forms
 * apart so a moisture percentage stays comparable while an observation stays
 * readable.
 */
export function SurveyFindings({ survey }) {
  const photos = survey.job?.photos ?? [];

  return (
    <div className="space-y-4">
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
            {survey.site?.address ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden />{survey.site.address}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {survey.readings?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" aria-hidden /> Readings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Where</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Taken</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survey.readings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-muted-foreground">{titleCase(r.metric)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.value != null
                        ? <span className="font-medium">{r.value}{r.unit ? <span className="text-muted-foreground"> {r.unit}</span> : null}</span>
                        : <span className="text-sm">{r.textValue}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.takenAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {photos.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" aria-hidden /> Site photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-md border">
                  <img
                    src={imageUrl(survey.media?.[p.mediaId], 400) ?? ''}
                    alt={p.caption ?? `Site photo (${p.kind.toLowerCase()})`}
                    className="aspect-4/3 w-full object-cover"
                    loading="lazy"
                  />
                  <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                    {p.caption ?? titleCase(p.kind)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
