import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading, SectionShell } from '@/components/site';
import { DrawLine, ScrollStage, motion, useStageStep } from '@/three/motion';
import { cn } from '@/helpers/utils';

/**
 * The five steps, pinned.
 *
 * This is the page's one theatrical moment: the section holds still while the
 * reader scrolls two screens, and the steps hand over to each other one at a
 * time — the current one lit, the finished ones ticked, the rail filling as it
 * goes. Under `prefers-reduced-motion` <ScrollStage> drops the pin entirely and
 * `progress` arrives as null, which renders the plain grid below instead.
 */
export function HowItWorks({ section }) {
  const steps = Array.isArray(section.data) ? section.data : [];
  if (!steps.length) return null;

  return (
    <ScrollStage pages={1.6} className="bg-muted/50">
      {(progress) => (progress ? <PinnedSteps steps={steps} progress={progress} /> : <PlainSteps steps={steps} />)}
    </ScrollStage>
  );
}

function PinnedSteps({ steps, progress }) {
  const active = useStageStep(progress, steps.length);

  return (
    <div className="container py-12">
      <SectionHeading eyebrow="How it works" title="Booking to warranty, in five steps" />

      {/* The rail. Its fill is the scroll position itself, so the bar and the
          cards can never disagree about where the reader is. */}
      <div className="relative mb-8 h-px w-full bg-border" aria-hidden>
        <motion.span className="absolute inset-y-0 left-0 block w-full origin-left bg-gold" style={{ scaleX: progress }} />
      </div>

      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((step, i) => {
          const state = i === active ? 'current' : i < active ? 'done' : 'todo';
          return (
            <motion.li
              key={step.id}
              animate={{
                opacity: state === 'todo' ? 0.42 : 1,
                y: state === 'current' ? -6 : 0,
                scale: state === 'current' ? 1.015 : 1,
              }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className={cn(
                'sheen h-full transition-colors duration-300',
                state === 'current' && 'border-primary/40 shadow-card',
              )}>
                <CardHeader className="items-center space-y-0 pb-3 text-center">
                  <span className={cn(
                    'grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-300',
                    state === 'todo' && 'border-border bg-card text-muted-foreground',
                    state === 'current' && 'border-primary bg-primary text-primary-foreground',
                    state === 'done' && 'border-gold/40 bg-gold/15 text-gold',
                  )}>
                    {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : step.stepNo}
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-5 text-center">
                  <CardTitle className="text-[14px] font-semibold leading-snug tracking-tight">{step.title}</CardTitle>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </motion.li>
          );
        })}
      </ol>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Step {active + 1} of {steps.length} · keep scrolling
      </p>
    </div>
  );
}

/** The same five steps with no pin — reduced motion, and the print view. */
function PlainSteps({ steps }) {
  return (
    <SectionShell tone="muted">
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
