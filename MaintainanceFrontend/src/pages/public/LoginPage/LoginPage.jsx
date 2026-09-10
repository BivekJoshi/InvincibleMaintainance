import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion, useMotionVariants, useReducedMotion } from '@/three/motion/motionKit';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { ThemeModeSwitch } from '@/components/theme/ThemeModeSwitch';
import { LOGIN_RISE } from './loginContent';
import { useLoginFlow } from './useLoginFlow';
import { AccessGranted } from './sections/AccessGranted';
import { DemoAccounts } from './sections/DemoAccounts';
import { LoginForm } from './sections/LoginForm';
import { LoginStage } from './sections/LoginStage';

/**
 * The back-office sign-in.
 *
 * Two halves: a dark stage carrying a WebGL site that erects itself, and a
 * paper panel carrying the form. The stage is decorative — nothing on the left
 * is needed to sign in, so the right half works alone on a phone.
 *
 * This file is the frame and the order; `useLoginFlow` holds what signing in
 * involves, and each half is its own file under `./sections/`.
 */
export default function LoginPage() {
  const flow = useLoginFlow();
  const reduced = useReducedMotion();
  const { name: company } = useSiteSettings();
  // Framer animates in JS, so the global reduced-motion CSS cannot reach it —
  // these variants have to collapse to a plain fade themselves.
  const rise = useMotionVariants(LOGIN_RISE);

  // Someone with a live session who lands here on a cold load is about to be
  // redirected by the flow; without this they would watch the form build itself
  // first, then have it taken away.
  if (!flow.isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background lg:grid lg:grid-cols-[1.04fr_minmax(0,0.96fr)]">
      <LoginStage company={company} />

      <main className="glow-paper relative flex min-h-dvh flex-col">
        <div className="blueprint-fine pointer-events-none absolute inset-0 mask-b opacity-70" aria-hidden />

        <header className="relative z-10 flex items-center justify-between gap-4 p-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Back to website
          </Link>

          {/* All three modes, spelled out: this is the one screen every member
              of staff passes through, and the place they will look for it. */}
          <ThemeModeSwitch className="bg-card/70 shadow-hairline backdrop-blur" />
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.075, delayChildren: 0.15 } } }}
            className="w-full max-w-[26rem]"
          >
            {/* The stage is desktop-only; on a phone the wordmark still has to appear. */}
            <motion.div variants={rise} className="mb-7 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-extrabold text-primary-foreground">
                {company.charAt(0)}
              </span>
              <span>
                <span className="block font-semibold tracking-tight">{company}</span>
                <span className="eyebrow block text-muted-foreground">Back office</span>
              </span>
            </motion.div>

            <LoginForm flow={flow} variants={rise} />

            <DemoAccounts variants={rise} onPick={flow.fillDemo} />

            <motion.p variants={rise} className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Locked out? Ask an administrator to reset your password — for security we do not
              send reset links from this screen.
            </motion.p>
          </motion.div>
        </div>

        <AccessGranted show={flow.isSuccess && !reduced} />
      </main>
    </div>
  );
}
