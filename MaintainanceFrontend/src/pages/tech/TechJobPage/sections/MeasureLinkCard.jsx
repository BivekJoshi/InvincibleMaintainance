import { Link } from 'react-router-dom';
import { Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** The way into the final measurement (Phase L8) — on a BOQ job: its lines, measured room by room. Quantities only. */
export function MeasureLinkCard({ job, copy }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{job.measurementClosedAt ? copy.job.measure.closed : copy.job.measure.body}</p>
        <Button asChild size="xl" variant="outline" className="mt-3 w-full">
          <Link to={`/tech/jobs/${job.id}/measure`}><Ruler aria-hidden /> {copy.job.measure.open}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
