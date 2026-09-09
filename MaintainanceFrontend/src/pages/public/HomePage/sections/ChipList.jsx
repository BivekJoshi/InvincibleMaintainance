import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading, SectionShell } from '@/components/site/siteBlocks';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';

/** The trades that need a line each rather than a card each. */
export function ChipList({ section }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Also on the books"
        title="Other civil work"
        description="Carried out by our own crews, measured and billed against a published rate."
      />
      <StaggerOnView className="flex flex-wrap gap-2" stagger={0.03}>
        {items.map((item) => (
          <Stagger.Item
            key={item.id}
            variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.35 } } }}
          >
            <Button asChild variant="outline" size="sm" className="group h-auto rounded-full py-2 text-[13px] font-medium hover:border-primary/40 hover:text-primary">
              <Link to={`/services/${item.slug}`}>
                {item.name}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </Button>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}
