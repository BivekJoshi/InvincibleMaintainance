import { Link } from 'react-router-dom';
import { LeadCaptureCard } from '@/components/public/LeadCaptureCard';
import { LeadForm } from '@/components/public/LeadForm';
import { PromiseList } from '@/components/site/PromiseList';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/**
 * The ask, held beside the copy the whole way down the page.
 *
 * Sticky on desktop and simply the last thing on a phone: someone who has read
 * far enough to be convinced should not have to scroll back up to act on it.
 */
export function InspectionPanel({ service, slug }) {
  const t = useT(SITE);
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <LeadCaptureCard
        title={t('service.inspection.title')}
        description={
          <>
            {t.rich('service.inspection.prefer', {}, {
              link: (words) => <Link to={`/book/${slug}`} className="font-medium text-primary hover:underline">{words}</Link>,
            })}
            <PromiseList variant="stack" className="mt-3" />
          </>
        }
      >
        <LeadForm defaultServiceId={service.id} sourcePage={`/services/${slug}`} />
      </LeadCaptureCard>
    </aside>
  );
}
