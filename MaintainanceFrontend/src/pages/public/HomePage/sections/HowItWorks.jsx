import { Check } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Eyebrow } from '@/components/site/Eyebrow';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SectionShell } from '@/components/site/SectionShell';
import { AnimatePresence, DrawLine, ScrollStage, motion, useStageStep } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The five steps, pinned.
 *
 * This is the page's one theatrical moment: the section holds still while the
 * reader scrolls two screens, and the steps hand over to each other one at a
 * time. The step being explained is spelled out in full on the left; the list
 * on the right is the table of contents, ticking off behind it as the rail
 * fills. Under `prefers-reduced-motion` — and on a phone, where a pinned
 * sequence has nowhere to play — <ScrollStage> drops the pin and `progress`
 * arrives as null, which renders the plain grid at the bottom of this file.
 */
export function HowItWorks({ section, tone }) {
  const steps = Array.isArray(section.data) ? section.data : [];
  if (!steps.length) return null;

  return (
    <ScrollStage pages={1.6} className={cn(tone === 'muted' && 'border-y bg-muted/40')}>
      {(progress) => (progress
        ? <PinnedSteps steps={steps} progress={progress} />
        : <PlainSteps steps={steps} tone={tone} />)}
    </ScrollStage>
  );
}

const pad = (n) => String(n).padStart(2, '0');

function PinnedSteps({ steps, progress }) {
  const active = useStageStep(progress, steps.length);
  const step = steps[active];

  return (
    <div className="container grid items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
      {/* ── the step being explained ── */}
      <div>
        <span className="flex items-center gap-2.5">
          <span className="h-px w-6 shrink-0 bg-gold/70" aria-hidden />
          <Eyebrow>How it works</Eyebrow>
        </span>
        <h2 className="mt-3 text-[1.6rem] font-bold leading-[1.15] tracking-tight md:text-[2rem]">
          Booking to warranty, in five steps
        </h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Every job runs the same way, whether it is one damp wall or a whole floor.
        </p>

        {/* One step at a time, swapped rather than cross-faded — two paragraphs
            of different lengths dissolving through each other is unreadable. */}
        <div className="relative mt-10 min-h-[12rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="numeral block text-[4.5rem] font-bold leading-none tracking-tight">
                {pad(step.stepNo)}
              </span>
              <h3 className="mt-4 text-[1.35rem] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{step.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* The rail. Its fill is the scroll position itself, so the bar and the
            list can never disagree about where the reader is. */}
        <div className="mt-10 flex items-center gap-4">
          <div className="relative h-px flex-1 bg-border" aria-hidden>
            <motion.span className="absolute inset-y-0 left-0 block w-full origin-left bg-gold" style={{ scaleX: progress }} />
          </div>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {pad(active + 1)} / {pad(steps.length)}
          </span>
        </div>
      </div>

      {/* ── the contents, ticking off behind it ── */}
      <ol className="relative grid gap-1.5">
        {/* The rail the markers are threaded on. It runs marker-centre to
            marker-centre and fills with the same scroll value the bar does;
            the card of the current step paints over its own stretch of it. */}
        <span className="pointer-events-none absolute bottom-9 left-[2.125rem] top-9 w-px bg-border" aria-hidden>
          <motion.span
            className="absolute inset-0 block origin-top bg-gold/70"
            style={{ scaleY: progress }}
          />
        </span>

        {steps.map((s, i) => {
          const state = i === active ? 'current' : i < active ? 'done' : 'todo';
          return (
            <motion.li
              key={s.id}
              animate={{ opacity: state === 'todo' ? 0.45 : 1, x: state === 'current' ? 0 : -4 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={cn(
                  'flex items-center gap-4 rounded-xl border border-transparent px-4 py-5 transition-colors duration-300',
                  state === 'current' && 'border-border bg-card shadow-card',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[13px] font-bold tabular-nums transition-colors duration-300',
                    state === 'todo' && 'border-border text-muted-foreground',
                    state === 'current' && 'border-primary bg-primary text-primary-foreground',
                    state === 'done' && 'border-gold/40 bg-gold/15 text-gold',
                  )}
                >
                  {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : s.stepNo}
                </span>
                <span className={cn('text-base tracking-tight', state === 'current' ? 'font-semibold' : 'font-medium')}>
                  {s.title}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/** The same five steps with no pin — reduced motion, phones, and the print view. */
function PlainSteps({ steps, tone }) {
  return (
    <SectionShell tone={tone}>
      <SectionHeading eyebrow="How it works" title="Booking to warranty, in five steps" />
      <div className="relative">
        <div className="absolute inset-x-0 top-[1.375rem] hidden md:block" aria-hidden>
          <div className="mx-[10%] h-px bg-border"><DrawLine className="h-px" /></div>
        </div>
        <ol className="relative grid gap-4 md:grid-cols-5 md:gap-3">
          {steps.map((step) => (
            <li key={step.id} className="flex h-full gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-primary/15 bg-card text-sm font-bold text-primary shadow-sm md:mb-4">
                {step.stepNo}
              </span>
              <Card className="sheen h-full md:w-full">
                <CardContent className="p-4">
                  <CardTitle className="text-[14px] font-semibold leading-snug tracking-tight">{step.title}</CardTitle>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
