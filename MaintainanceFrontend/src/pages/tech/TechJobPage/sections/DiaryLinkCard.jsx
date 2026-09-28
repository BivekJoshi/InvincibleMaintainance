import { Link } from 'react-router-dom';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** The way into the job's site diary (Phase L7): one page a day — weather, crew, progress, deliveries, lost time. */
export function DiaryLinkCard({ job, copy }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{copy.job.diary.body}</p>
        <Button asChild size="xl" variant="outline" className="mt-3 w-full">
          <Link to={`/tech/jobs/${job.id}/diary`}><NotebookPen aria-hidden /> {copy.job.diary.open}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
