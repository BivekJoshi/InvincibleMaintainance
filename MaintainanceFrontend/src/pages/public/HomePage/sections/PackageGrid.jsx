import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

export function PackageGrid({ section, tone }) {
  const plans = Array.isArray(section.data) ? section.data : [];
  if (!plans.length) return null;
  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow="Packages"
        title="Fixed-scope packages"
        description="Everything in the list is included at the published rate. The exact figure is confirmed after the free inspection."
        action={<Button asChild variant="outline"><Link to="/pricing">Full rate card <ArrowRight className="h-4 w-4" /></Link></Button>}
      />
      <StaggerOnView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
        {plans.map((plan) => {
          const featured = plan.badge === 'Popular';
          return (
            <Stagger.Item key={plan.id} variants={cardRise} className="h-full">
              <Card
                className={cn(
                  'relative flex h-full flex-col overflow-hidden',
                  'card-hover',
                  // The recommended package is lifted and ruled in gold rather
                  // than merely outlined — at four across, a 1px ring is not a
                  // recommendation anybody notices.
                  featured && 'border-primary/40 shadow-card ring-1 ring-primary/20 lg:-translate-y-2',
                )}
              >
                {featured ? <span className="absolute inset-x-0 top-0 h-[3px] bg-gold" aria-hidden /> : null}
                <CardHeader className="space-y-0 p-5 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-[15px] font-semibold leading-snug tracking-tight">{plan.title}</CardTitle>
                    {plan.badge ? (
                      <Badge
                        variant={featured ? 'gold' : 'secondary'}
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wide"
                      >
                        {plan.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="flex items-baseline gap-1.5 pt-4">
                    <span className="text-[1.35rem] font-bold leading-none tabular-nums">
                      {formatNpr(plan.priceMin, { compact: true })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                    </span>
                  </p>
                </CardHeader>

                {plan.inclusions?.length ? (
                  <CardContent className="p-5 pb-0 pt-4">
                    <Separator className="mb-4" />
                    <ul className="space-y-1.5 text-[13px]">
                      {plan.inclusions.slice(0, 5).map((inc, k) => (
                        <li key={k} className="flex gap-2 text-muted-foreground">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inc}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}

                <CardFooter className="mt-auto p-5 pt-6">
                  <Button asChild size="sm" variant={featured ? 'default' : 'outline'} className="w-full">
                    <Link to="/book">Book this package</Link>
                  </Button>
                </CardFooter>
              </Card>
            </Stagger.Item>
          );
        })}
      </StaggerOnView>
    </SectionShell>
  );
}
