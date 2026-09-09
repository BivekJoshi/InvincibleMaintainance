import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SectionHeading, SectionShell } from '@/components/site';
import { Stagger, StaggerOnView } from '@/three/motion';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { CARD_HOVER, RISE } from '../shared';

export function PackageGrid({ section }) {
  const plans = Array.isArray(section.data) ? section.data : [];
  if (!plans.length) return null;
  return (
    <SectionShell tone="muted">
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
            <Stagger.Item key={plan.id} variants={RISE} className="h-full">
              <Card className={cn('flex h-full flex-col', CARD_HOVER, featured && 'border-primary ring-1 ring-primary/20')}>
                <CardHeader className="space-y-0 p-5 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-[15px] font-semibold leading-snug tracking-tight">{plan.title}</CardTitle>
                    {plan.badge ? (
                      <Badge variant={featured ? 'default' : 'secondary'} className="shrink-0 text-[10px] font-bold uppercase tracking-wide">
                        {plan.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="pt-3">
                    <span className="text-lg font-bold tabular-nums">{formatNpr(plan.priceMin, { compact: true })}</span>
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

                <CardFooter className="mt-auto p-5">
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
