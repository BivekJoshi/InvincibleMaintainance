import { Link } from 'react-router-dom';
import { Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/** The way into the final measurement (Phase L8) — on a BOQ job: its lines, measured room by room. Quantities only. */
export function MeasureLinkCard({ job }) {
  const t = useT(FIELD);
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{t(job.measurementClosedAt ? 'job.measure.closed' : 'job.measure.body')}</p>
        <Button asChild size="xl" variant="outline" className="mt-3 w-full">
          <Link to={`/tech/jobs/${job.id}/measure`}><Ruler aria-hidden /> {t('job.measure.open')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
