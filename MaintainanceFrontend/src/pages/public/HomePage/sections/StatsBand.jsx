import { CountUp, DriftField, Spotlight, Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/** The numbers, on the dark band — the page's one full-bleed interruption. */
export function StatsBand({ section }) {
  const stats = Array.isArray(section.data) ? section.data : [];
  if (!stats.length) return null;
  return (
    <section className="ink-panel relative isolate overflow-hidden">
      <div className="glow-ink absolute inset-0 -z-10" aria-hidden />
      <div className="blueprint absolute inset-0 -z-10 opacity-60" aria-hidden />
      <Spotlight />
      <DriftField count={10} />
      {/* Gold trim top and bottom, so the band reads as inlaid into the page
          rather than as a hole cut out of it. */}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" aria-hidden />
      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" aria-hidden />
      <StaggerOnView className="container relative grid grid-cols-2 gap-y-10 py-14 md:py-16 lg:grid-cols-4" stagger={0.1}>
        {stats.map((s, i) => (
          <Stagger.Item
            key={i}
            className={cn(
              'px-4 text-center lg:px-8',
              i % 2 ? 'border-l border-ink-foreground/12' : null,
              i > 0 ? 'lg:border-l lg:border-ink-foreground/12' : 'lg:border-l-0',
            )}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <p className="text-[2.25rem] font-bold leading-none tracking-tight text-gold md:text-[2.75rem]">
              <CountUp value={s.value} />
            </p>
            <span className="mx-auto mt-4 block h-px w-8 bg-ink-foreground/20" aria-hidden />
            <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{s.label}</p>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </section>
  );
}
