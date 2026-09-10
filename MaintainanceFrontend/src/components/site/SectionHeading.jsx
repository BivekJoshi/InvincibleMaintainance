import { Reveal } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';
import { Eyebrow } from './Eyebrow';

/** Section heading with an optional "see all" action on the same optical line. */
export function SectionHeading({ eyebrow, title, description, action, tone = 'paper', className }) {
  return (
    <Reveal
      from="none"
      blur={false}
      className={cn('mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <span className="flex items-center gap-2.5">
            <span className={cn('h-px w-6 shrink-0', tone === 'ink' ? 'bg-gold' : 'bg-gold/70')} aria-hidden />
            <Eyebrow className={tone === 'ink' ? 'text-gold' : undefined}>{eyebrow}</Eyebrow>
          </span>
        ) : null}
        <h2 className={cn('text-[1.6rem] font-bold leading-[1.15] tracking-tight md:text-[2rem]', eyebrow && 'mt-3')}>{title}</h2>
        {description ? (
          <p className={cn('mt-2.5 text-[15px] leading-relaxed', tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Reveal>
  );
}
