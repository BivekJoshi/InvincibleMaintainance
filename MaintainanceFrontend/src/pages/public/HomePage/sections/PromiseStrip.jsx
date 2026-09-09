import { DataIcon } from '@/components/site/siteBlocks';
import { Marquee } from '@/three/motion/motionKit';

/** The promises the company makes, scrolling on a phone and split in three above it. */
export function PromiseStrip({ section }) {
  const badges = Array.isArray(section.data) ? section.data : [];
  if (!badges.length) return null;
  return (
    <div className="border-b bg-card">
      <Marquee className="mask-x py-3 sm:hidden" duration={24}>
        {badges.map((b, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap px-5 text-[13px] font-medium">
            <DataIcon name={b.icon} className="h-4 w-4 text-primary" /> {b.label}
            <span className="ml-5 h-1 w-1 rounded-full bg-border" aria-hidden />
          </span>
        ))}
      </Marquee>
      <div className="container hidden grid-cols-3 divide-x sm:grid">
        {badges.map((b, i) => (
          <div key={i} className="group flex items-center justify-center gap-3 py-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/8 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <DataIcon name={b.icon} className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-medium">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
