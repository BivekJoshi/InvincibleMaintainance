import { Check } from 'lucide-react';
import { Eyebrow } from '@/components/site/Eyebrow';
import { Stagger, StaggerOnView, Tilt } from '@/three/motion/motionKit';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * The packages, priced as bands.
 *
 * One plan is marked "Popular" by the CMS and is the only one rendered on ink:
 * a recommendation nobody can pick out of four identical cards is not a
 * recommendation. Everything else about the cards is the same, so the
 * difference reads as emphasis rather than as a different product.
 */
export function PackagePlans({ plans }) {
  if (!plans?.length) return null;

  return (
    <section>
      <Eyebrow>Packages</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">Popular packages</h2>

      <StaggerOnView className="mt-6 grid gap-5 sm:grid-cols-2" stagger={0.07}>
        {plans.map((plan) => {
          const featured = plan.badge === 'Popular';
          return (
            <Stagger.Item key={plan.id} className="h-full">
              <Tilt max={4} scale={1.008} className="group h-full rounded-lg">
                <div className={cn(
                  'flex h-full flex-col rounded-lg border p-6',
                  featured ? 'ink-panel border-ink shadow-lift' : 'bg-card',
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">{plan.title}</h3>
                    {plan.badge ? (
                      <span className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
                        featured ? 'bg-gold text-gold-foreground' : 'border text-muted-foreground',
                      )}>
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <p className={cn('mt-2 text-sm', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                    {plan.description}
                  </p>

                  <p className="mt-5">
                    <span className="text-2xl font-semibold tabular-nums tracking-tight">
                      {formatNpr(plan.priceMin, { compact: true })}
                    </span>
                    <span className={cn('text-sm', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                      {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                    </span>
                  </p>

                  {plan.inclusions?.length ? (
                    <ul className={cn('mt-5 space-y-2.5 border-t pt-5 text-sm', featured && 'border-ink-foreground/15')}>
                      {plan.inclusions.map((inclusion, i) => (
                        <li key={i} className={cn('flex gap-2.5', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inclusion}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Tilt>
            </Stagger.Item>
          );
        })}
      </StaggerOnView>
    </section>
  );
}
