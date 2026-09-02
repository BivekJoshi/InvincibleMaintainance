import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Check } from 'lucide-react';
import { useGetPublicPricingQuery } from '@/features/public/publicApi';
import { selectLocale } from '@/features/ui/uiSlice';
import { Estimator } from '@/features/public/Estimator';
import { LeadForm } from '@/features/public/LeadForm';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero, SectionShell, Eyebrow } from '@/components/site';
import { PageTransition, Reveal, StaggerOnView, Stagger, Tilt } from '@/components/motion';
import { formatNpr } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicPricingQuery(locale);
  const [estimate, setEstimate] = useState(null);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) {
    return <div className="container py-14"><Skeleton className="h-96 w-full rounded-lg" /></div>;
  }

  return (
    <PageTransition>
      <PageHero
        eyebrow="Transparent pricing"
        title="Our rates, published before you call"
        description="The estimator gives you a range instantly. The exact figure is confirmed after a free inspection — never after the work."
      />

      <SectionShell>
      <div className="grid gap-10 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className="space-y-6 lg:sticky lg:top-24">
          <Estimator services={data.services} onEstimate={setEstimate} />
          {estimate ? (
            <Reveal>
              <Card className="border-gold/40">
                <CardContent className="p-6">
                  <h2 className="font-display text-lg font-semibold tracking-tight">Get this quoted exactly</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We will bring your estimate to the free inspection.
                  </p>
                  <div className="mt-5">
                    <LeadForm
                      services={data.services}
                      defaultServiceId={estimate.serviceId}
                      estimate={estimate}
                      sourcePage="/pricing"
                    />
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ) : null}
        </div>

        <div className="space-y-10">
          <section>
            <Eyebrow>Packages</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Popular packages</h2>
            <StaggerOnView className="mt-6 grid gap-5 sm:grid-cols-2" stagger={0.07}>
              {data.plans.map((plan) => {
                const featured = plan.badge === 'Popular';
                return (
                  <Stagger.Item key={plan.id} className="h-full">
                    <Tilt max={4} scale={1.008} className="group h-full rounded-lg">
                      <div className={cn(
                        'flex h-full flex-col rounded-lg border p-6',
                        featured ? 'ink-panel border-ink shadow-lift' : 'bg-card',
                      )}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-lg font-semibold tracking-tight">{plan.title}</h3>
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
                          <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
                            {formatNpr(plan.priceMin, { compact: true })}
                          </span>
                          <span className={cn('text-sm', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                            {' – '}{formatNpr(plan.priceMax, { compact: true, symbol: false })} {plan.unit}
                          </span>
                        </p>
                        {plan.inclusions?.length ? (
                          <ul className={cn('mt-5 space-y-2.5 border-t pt-5 text-sm', featured && 'border-ink-foreground/15')}>
                            {plan.inclusions.map((inc, i) => (
                              <li key={i} className={cn('flex gap-2.5', featured ? 'text-ink-muted' : 'text-muted-foreground')}>
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {inc}
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

          <section>
            <Eyebrow>No hidden lines</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Full rate card</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The same rates our quotations are built from.
            </p>
            <Card className="mt-6 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rateCard.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {item.rate ? formatNpr(item.rate) : 'Free'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">
              Rates exclude 13% VAT unless stated. Final pricing is confirmed after inspection.
            </p>
          </section>
        </div>
      </div>
      </SectionShell>
    </PageTransition>
  );
}
