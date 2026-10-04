import { Eyebrow } from '@/components/site/Eyebrow';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** One stage of the story, skipped when it was never filled in. */
function Chapter({ eyebrow, title, children }) {
  if (!children) return null;
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}

/**
 * Problem → work → result, in that order.
 *
 * The order is the argument: a customer reading this is checking whether we
 * understood a problem like theirs before they care what we did about it. A
 * chapter the editor left empty disappears rather than printing a heading over
 * nothing.
 */
export function ProjectStory({ project }) {
  const t = useT(SITE);
  const chapter = (key) => ({ eyebrow: t(`project.story.${key}.eyebrow`), title: t(`project.story.${key}.title`) });
  return (
    <>
      <Chapter {...chapter('problem')}>{project.problem}</Chapter>
      <Chapter {...chapter('work')}>{project.solution}</Chapter>
      <Chapter {...chapter('result')}>{project.outcome}</Chapter>
      <Chapter {...chapter('detail')}>{project.body}</Chapter>
    </>
  );
}
