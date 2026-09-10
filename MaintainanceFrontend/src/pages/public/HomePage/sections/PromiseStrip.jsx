import { DataIcon } from '@/components/site/DataIcon';
import { Marquee } from '@/three/motion/motionKit';

/**
 * The promises the company makes, as a ribbon rather than a section.
 *
 * The same three promises are argued properly further down the page, in "Four
 * promises, each one measured" — so this rail states them and gets out of the
 * way: one line high, gold marks, a diamond between each. On a phone the three
 * do not fit on a line, so they scroll instead.
 */
export function PromiseStrip({ section }) {
  const badges = Array.isArray(section.data) ? section.data : [];
  if (!badges.length) return null;

  return (
    <div className="relative border-y bg-card">
      {/* A gold hairline along the top edge, faded at both ends, so the rail
          reads as trim between two bands rather than as a band of its own. */}
      <span
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
        aria-hidden
      />

      <Marquee className="mask-x py-3.5 sm:hidden" duration={26}>
        {badges.map((b, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap px-5 text-[13px] font-medium">
            <DataIcon name={b.icon} className="h-4 w-4 text-gold" /> {b.label}
            <span className="ml-5 h-1 w-1 rotate-45 bg-gold/40" aria-hidden />
          </span>
        ))}
      </Marquee>

      <div className="container hidden py-3.5 sm:block">
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {badges.map((b, i) => (
            <li key={i} className="flex items-center gap-3">
              {i > 0 ? <span className="h-1 w-1 rotate-45 bg-gold/40" aria-hidden /> : null}
              <span className="group flex items-center gap-2.5 px-2">
                <DataIcon
                  name={b.icon}
                  className="h-4 w-4 text-gold transition-transform duration-300 group-hover:-translate-y-0.5"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                  {b.label}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
