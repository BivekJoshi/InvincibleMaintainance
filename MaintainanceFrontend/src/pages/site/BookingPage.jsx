import { useParams } from 'react-router-dom';
import { PageHero } from '@/components/site';
import { PageTransition } from '@/components/motion';
import { BookingWizard } from '@/features/booking/BookingWizard';
import { useSeo } from '@/hooks/useSeo';

/**
 * `/book` starts from the catalogue; `/book/:slug` starts with that service
 * already chosen, which is where every "Book" button on a service card lands.
 */
export default function BookingPage() {
  const { slug } = useParams();
  useSeo({
    title: 'Book a free inspection',
    description: 'Pick a service, a day and a time window. A certified engineer inspects free of charge and gives you a written estimate.',
  });

  return (
    <PageTransition>
      <PageHero
        eyebrow="Booking"
        title="Book a visit in four steps"
        description="Free inspection, published rates, and a written estimate before anything starts."
      />
      <div className="container py-10 md:py-14">
        <BookingWizard slug={slug} />
      </div>
    </PageTransition>
  );
}
