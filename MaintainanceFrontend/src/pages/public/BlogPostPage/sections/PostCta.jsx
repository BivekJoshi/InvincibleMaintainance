import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** What to do after reading: have an engineer look, or read another article. */
export function PostCta() {
  return (
    <>
      <Card className="mt-12 bg-muted/40">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold tracking-tight">Seeing this at home?</p>
            <p className="mt-1 text-sm text-muted-foreground">An engineer inspects for free and tells you what it is before quoting.</p>
          </div>
          <Button asChild className="shrink-0"><Link to="/book"><CalendarCheck aria-hidden /> Book a free inspection</Link></Button>
        </CardContent>
      </Card>
      <Button asChild variant="link" className="mt-6 h-auto p-0">
        <Link to="/blog"><ArrowLeft aria-hidden /> All articles</Link>
      </Button>
    </>
  );
}
