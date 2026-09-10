import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';

/**
 * The trades that need a line each rather than a card each — nine of them, so
 * a row of pills turns into tag soup. Ruled rows in three columns read as what
 * this is: the rest of the rate card.
 */
export function ChipList({ section, tone }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;

  return (
    <SectionShell tone={tone}>
      <SectionHeading
        eyebrow="Also on the books"
        title="Other civil work"
        description="Carried out by our own crews, measured and billed against a published rate."
      />
      <StaggerOnView className="grid border-t sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3" stagger={0.03}>
        {items.map((item, i) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}
            className="border-b"
          >
            <Link
              to={`/services/${item.slug}`}
              className="group flex items-center justify-between gap-3 py-4"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/40">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[14px] font-medium tracking-tight transition-colors duration-300 group-hover:text-primary">
                  {item.name}
                </span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold"
                aria-hidden
              />
            </Link>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
