import { useSelector } from 'react-redux';
import { Phone, Mail, MapPin, Clock, ArrowUpRight } from 'lucide-react';
import { useGetBootstrapQuery, useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { LeadForm } from '@/components/public/LeadForm';
import { Card } from '@/components/ui/card';
import { PageHero, SectionShell, Eyebrow } from '@/components/site';
import { PageTransition, Reveal, StaggerOnView, Stagger } from '@/three/motion';

export default function ContactPage() {
  const locale = useSelector(selectLocale);
  const { data: boot } = useGetBootstrapQuery(locale);
  const { data: services } = useGetPublicServicesQuery({ locale });
  const s = boot?.settings ?? {};

  const details = [
    { icon: Phone, label: 'Phone', value: s['contact.phonePrimary'], href: `tel:${s['contact.phonePrimary']}` },
    { icon: Phone, label: 'Mobile', value: s['contact.phoneSecondary'], href: `tel:${s['contact.phoneSecondary']}` },
    { icon: Mail, label: 'Email', value: s['contact.email'], href: `mailto:${s['contact.email']}` },
    { icon: MapPin, label: 'Address', value: s['contact.address'] },
    { icon: Clock, label: 'Response time', value: 'We call back within two hours' },
  ].filter((d) => d.value);

  return (
    <PageTransition>
      <PageHero
        eyebrow="Free consultation"
        title="Tell us what is wrong. We will tell you why."
        description="A certified engineer inspects it, explains the cause, and gives you a written estimate — at no charge, whether or not you go ahead."
      />

      <SectionShell>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          <Reveal>
            <div className="overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="border-b bg-muted/50 px-7 py-5">
                <h2 className="text-lg font-semibold tracking-tight">Request an inspection</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Two-hour response, every working day.
                </p>
              </div>
              <div className="p-7">
                <LeadForm services={services?.items ?? []} sourcePage="/contact" />
              </div>
            </div>
          </Reveal>

          <div>
            <Eyebrow>Direct lines</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Reach us without a form</h2>
            <StaggerOnView className="mt-8 divide-y border-y" stagger={0.06}>
              {details.map((d) => (
                <Stagger.Item
                  key={d.label}
                  variants={{
                    hidden: { opacity: 0, x: -14 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                  }}
                >
                  <ContactRow {...d} />
                </Stagger.Item>
              ))}
            </StaggerOnView>

            {s['contact.mapEmbed'] ? (
              <Reveal delay={0.1}>
                <Card className="mt-8 overflow-hidden">
                  <iframe
                    src={s['contact.mapEmbed']}
                    title="Our location"
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </Card>
              </Reveal>
            ) : null}
          </div>
        </div>
      </SectionShell>
    </PageTransition>
  );
}

function ContactRow({ icon: Icon, label, value, href }) {
  const body = (
    <>
      <span className="flex items-center gap-4">
        <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className="mt-0.5 block text-lg tracking-tight">{value}</span>
        </span>
      </span>
      {href ? (
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      ) : null}
    </>
  );

  const className = 'group flex items-center justify-between gap-4 py-5 transition-colors';
  return href
    ? <a href={href} className={`${className} hover:text-primary`}>{body}</a>
    : <div className={className}>{body}</div>;
}
