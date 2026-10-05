import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadForm } from '@/components/public/LeadForm';
import { Eyebrow } from '@/components/site/Eyebrow';
import { SectionShell } from '@/components/site/SectionShell';
import { DriftField, Reveal, Spotlight } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** The four reasons under the headline, in order — each worded as `home.closing.points.<key>`. */
const POINTS = ['noCharge', 'response', 'estimate', 'warranty'];

/** The last thing on the page: book a slot, ring us, or hand over the details here. */
export function ClosingCta({ section, settings }) {
  const t = useT(SITE);
  const phone = settings?.['contact.phonePrimary'];
  const mobile = settings?.['contact.phoneSecondary'];
  return (
    <SectionShell tone="ink" id="contact" className="isolate overflow-hidden">
      {/* Full-bleed decoration from inside a centred container. */}
      <div className="glow-ink absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2" aria-hidden />
      <div className="blueprint mask-t absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 opacity-70" aria-hidden />
      <Spotlight />
      <DriftField count={12} />
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
        <Reveal>
          <Eyebrow className="text-gold">{t('home.closing.eyebrow')}</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">{t('home.closing.title')}</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">{t('home.closing.body')}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg"><Link to="/book"><CalendarCheck className="h-4 w-4" /> {t('home.closing.slot')}</Link></Button>
            {mobile ? (
              <Button asChild variant="onInk" size="lg"><a href={`tel:${mobile}`}><Phone className="h-4 w-4" /> {mobile}</a></Button>
            ) : null}
          </div>

          <ul className="mt-7 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
            {POINTS.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold" aria-hidden /> {t(`home.closing.points.${key}`)}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {settings?.['contact.address']} · {phone}
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="overflow-hidden shadow-lift">
            <CardHeader className="space-y-0 border-b bg-muted/50 px-6 py-4">
              <CardTitle className="text-[15px] font-semibold tracking-tight">{t('home.closing.formTitle')}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('home.closing.formNote')}</p>
            </CardHeader>
            <CardContent className="p-6">
              <LeadForm services={section.data?.services ?? []} sourcePage="/#contact" />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </SectionShell>
  );
}
