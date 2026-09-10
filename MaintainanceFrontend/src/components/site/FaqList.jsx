import { Stagger, StaggerOnView } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

const ROW = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * Questions and answers as a definition list, which is what they are — a
 * heading and a paragraph would say the same thing to a sighted reader and
 * nothing at all to a screen reader.
 *
 * Deliberately not an accordion: these answers are short, and hiding a price
 * question behind a click is how a catalogue loses the search that found it.
 *
 * @param {{ faqs: Array<{ id: string, question: string, answer: string }>, className?: string }} props
 */
export function FaqList({ faqs, className }) {
  if (!faqs?.length) return null;

  return (
    <StaggerOnView className={cn('divide-y border-y', className)} stagger={0.06} as="dl">
      {faqs.map((faq) => (
        <Stagger.Item key={faq.id} className="py-5" variants={ROW}>
          <dt className="text-lg font-semibold tracking-tight">{faq.question}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
        </Stagger.Item>
      ))}
    </StaggerOnView>
  );
}
