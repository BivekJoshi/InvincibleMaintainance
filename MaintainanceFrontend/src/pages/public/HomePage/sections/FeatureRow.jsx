import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { DataIcon } from '@/components/site/DataIcon';
import { Media } from '@/components/site/Media';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * Three different sections arrive here — the promises, the construction offer
 * and the steel-building offer — and they used to render as the same four
 * icon cards each, three times down one page.
 *
 * So the promises now get their own shape: a ledger of numbered entries, set
 * in two columns with the description given room to be read, and no card
 * chrome at all. The trade sections keep the cards, and take their column
 * count from how many items an editor published — six lands as two rows of
 * three, four as one row of four — so a group is never left with a short
 * final row.
 */
const COPY = {
  why_choose: { eyebrow: 'Why us', title: 'Four promises, each one measured' },
  construction: { eyebrow: 'Construction', title: 'Built to a drawing, billed to a line item' },
  pre_engineered: { eyebrow: 'Steel buildings', title: 'Pre-engineered structures' },
};

export function FeatureRow({ section, media, tone }) {
  const items = Array.isArray(section.data) ? section.data : [];
  if (!items.length) return null;

  const heading = COPY[section.key] ?? { title: 'Highlights' };
  if (section.key === 'why_choose') return <PromiseLedger items={items} heading={heading} tone={tone} />;

  return (
    <SectionShell tone={tone}>
      <SectionHeading {...heading} />
      <FeatureCards items={items} media={media} />
    </SectionShell>
  );
}

/** A title an editor typed in capitals is not a title. */
const clean = (title) => (title && title === title.toUpperCase() ? titleCase(title) : title);

/**
 * The promises, as a ruled ledger. Each entry is numbered in outlined gold and
 * separated by a hairline rather than boxed, which is the one place on the page
 * where the copy is worth more than the container around it.
 */
function PromiseLedger({ items, heading, tone }) {
  return (
    <SectionShell tone={tone}>
      <SectionHeading {...heading} description="Written into every job sheet, not into the marketing." />
      <StaggerOnView className="grid border-t sm:grid-cols-2" stagger={0.07}>
        {items.map((f, i) => (
          <Stagger.Item
            key={f.id}
            variants={cardRise}
            className={cn(
              'group relative border-b py-7 sm:py-8',
              // The hairline between the columns, drawn only where there is a
              // column to its left — a border on every cell would rule the
              // page's outer edge as well.
              i % 2 ? 'sm:border-l sm:pl-8 lg:pl-10' : 'sm:pr-8 lg:pr-10',
            )}
          >
            <div className="flex gap-5">
              <span className="numeral shrink-0 text-[2.5rem] font-bold leading-none tracking-tight transition-colors duration-500 group-hover:text-gold/10">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <DataIcon name={f.icon} className="h-4 w-4 shrink-0 text-gold" />
                  <h3 className="text-[15px] font-semibold tracking-tight">{clean(f.title)}</h3>
                </div>
                <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </div>
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </SectionShell>
  );
}

/**
 * Feature cards. A feature with a picture gets one; a feature without keeps the
 * icon plate. Both shapes are the same height, so a group can mix the two while
 * an editor is still working through the uploads.
 */
function FeatureCards({ items, media }) {
  const illustrated = items.some((f) => f.imageId);
  const columns = items.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';

  return (
    <StaggerOnView className={cn('grid gap-4 sm:grid-cols-2', columns)} stagger={0.05}>
      {items.map((f, i) => (
        <Stagger.Item key={f.id} variants={cardRise} className="h-full">
          <Card className={'card-hover sheen group relative flex h-full flex-col overflow-hidden'}>
            {illustrated ? <Media media={media?.[f.imageId]} ratio={16 / 9} icon={f.icon} zoom /> : null}
            <CardContent className="flex flex-1 flex-col p-5">
              {illustrated ? null : (
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/12 text-gold ring-1 ring-inset ring-gold/25 transition-all duration-300 group-hover:bg-gold group-hover:text-gold-foreground group-hover:ring-gold">
                    <DataIcon name={f.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums tracking-[0.14em] text-muted-foreground/50">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </span>
              )}
              <CardTitle className={cn('text-[14px] font-semibold tracking-tight', !illustrated && 'mt-4')}>
                {clean(f.title)}
              </CardTitle>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
            </CardContent>
            <span className="underscore-gold absolute inset-x-0 bottom-0" aria-hidden />
          </Card>
        </Stagger.Item>
      ))}
    </StaggerOnView>
  );
}
