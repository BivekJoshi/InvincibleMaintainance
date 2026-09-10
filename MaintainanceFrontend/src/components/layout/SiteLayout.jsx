import { BackToTop, ScrollProgress } from '@/three/motion/motionKit';
import { useIdlePreload } from '@/hooks/useIdlePreload';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { PageOutlet } from '@/routes/PageOutlet';
import { SiteHeader } from './SiteHeader/SiteHeader';
import { SiteFooter } from './SiteFooter';
import { MobileCallBar } from './MobileCallBar';

/**
 * The public shell, and nothing but the frame.
 *
 * The header, the footer and the phone's call bar are each their own file —
 * they carry a trade panel, a drawer, a search box and a contact block between
 * them, and none of that belongs in a layout whose job is to say what order the
 * page's parts come in. What is left here is exactly that order.
 */
export function SiteLayout() {
  useIdlePreload('public');
  const { mobile } = useSiteSettings();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ScrollProgress />
      <SiteHeader />

      <main className="flex-1"><PageOutlet /></main>

      <SiteFooter />
      <MobileCallBar mobile={mobile} />
      <BackToTop />
    </div>
  );
}
