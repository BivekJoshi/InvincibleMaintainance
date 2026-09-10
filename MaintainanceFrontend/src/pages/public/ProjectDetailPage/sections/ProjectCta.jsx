import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The foot of a case study: the caveat about cost bands, then the two things
 * a convinced reader might want — this trade's inspection, or more work like it.
 */
export function ProjectCta({ service }) {
  return (
    <section className="border-t py-8">
      <p className="text-sm text-muted-foreground">
        Costs shown are a band for this job. Yours depends on what our surveyor measures — the visit is free.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={service ? `/book/${service.slug}` : '/book'}>
            Book a free consultation <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={service ? `/projects?service=${service.slug}` : '/projects'}>More work like this</Link>
        </Button>
      </div>
    </section>
  );
}
