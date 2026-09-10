import { Link } from 'react-router-dom';
import { CalendarCheck, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Booking and calling, one tap away, for the whole small-screen visit.
 *
 * Most traffic is a Kathmandu phone, and the two things that visit is for are
 * both here. It renders a spacer of its own height below the page so the bar
 * never covers the last line of the footer.
 */
export function MobileCallBar({ mobile }) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 px-3 py-2.5 backdrop-blur md:hidden">
        <Button asChild className="flex-1">
          <Link to="/book"><CalendarCheck className="h-4 w-4" /> Book a visit</Link>
        </Button>
        <Button asChild variant="outline" size="icon" className="h-9 w-11">
          <a href={`tel:${mobile}`} aria-label="Call"><Phone className="h-4 w-4" /></a>
        </Button>
        <Button asChild variant="outline" size="icon" className="h-9 w-11">
          <a href={`viber://chat?number=%2B977${mobile}`} aria-label="Viber"><MessageCircle className="h-4 w-4" /></a>
        </Button>
      </div>
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
