import { useSelector } from 'react-redux';
import { useGetPublicServicesQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
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
  const locale = useSelector(selectLocale);
  const { data: services } = useGetPublicServicesQuery({ locale });
  const { phone, mobile, email, address, mapEmbed } = useSiteSettings();

  useSeo({
    title: 'Tell us what is wrong. We will tell you why.',
    description: 'A certified engineer inspects it, explains the cause, and gives you a written estimate — at no charge.',
  });

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
            <LeadCaptureCard
              title="Request an inspection"
              description="Two-hour response, every working day."
              footnote="We use your number to arrange the visit and nothing else."
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
