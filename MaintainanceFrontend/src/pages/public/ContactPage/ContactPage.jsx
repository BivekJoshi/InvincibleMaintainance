import { useGetPublicServicesQuery } from '@/api/publicApi';
import { SITE } from '@/config/i18n/site';
import { useSeo } from '@/hooks/useSeo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useT } from '@/hooks/useT';
import { LeadCaptureCard } from '@/components/public/LeadCaptureCard';
import { LeadForm } from '@/components/public/LeadForm';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { PageTransition, Reveal } from '@/three/motion/motionKit';
import { ContactChannels } from './sections/ContactChannels';
import { ContactMap } from './sections/ContactMap';

/**
 * Two ways to start the same conversation: the form, and the phone number of
 * someone who will answer it. Neither is the secondary one.
 */
export default function ContactPage() {
  const t = useT(SITE);
  const { data: services } = useGetPublicServicesQuery({ locale: t.locale });
  const { phone, mobile, email, address, mapEmbed } = useSiteSettings();

  useSeo({ title: t('contact.title'), description: t('contact.seoDescription') });

  return (
    <PageTransition>
      <PageHero eyebrow={t('contact.eyebrow')} title={t('contact.title')} description={t('contact.description')} />

      <SectionShell>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          <Reveal>
            <LeadCaptureCard
              title={t('contact.card.title')}
              description={t('contact.card.description')}
              footnote={t('contact.card.footnote')}
            >
              <LeadForm services={services?.items ?? []} sourcePage="/contact" />
            </LeadCaptureCard>
          </Reveal>

          <div>
            <ContactChannels phone={phone} mobile={mobile} email={email} address={address} />
            <ContactMap src={mapEmbed} />
          </div>
        </div>
      </SectionShell>
    </PageTransition>
  );
}
