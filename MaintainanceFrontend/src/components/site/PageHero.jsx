import { cn } from '@/helpers/utils';
import { Eyebrow } from './Eyebrow';

/** The masthead an interior page opens with — light, so it reads as a shop. */
export function PageHero({ eyebrow, title, description, children, className }) {
  return (
    <section className={cn('border-b bg-muted/40', className)}>
      <div className="container py-10 md:py-14">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={cn('max-w-3xl text-[1.9rem] font-bold leading-[1.15] tracking-tight md:text-4xl', eyebrow && 'mt-2')}>
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </section>
  );
}
