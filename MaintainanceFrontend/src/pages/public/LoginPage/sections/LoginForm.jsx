import { useState } from 'react';
import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { AnimatePresence, EASE, Magnetic, motion, useReducedMotion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoginField } from './LoginField';

/**
 * The card that actually signs you in.
 *
 * Everything it needs comes from `useLoginFlow` through one prop, so this file
 * is markup and focus behaviour and nothing else. The brass hairline around the
 * card lights while any field has focus; behind an opaque card it reads as a
 * lit edge rather than as an outline.
 */
export function LoginForm({ flow, variants }) {
  const reduced = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);

  const {
    form: { register, formState: { errors } },
    ready, isLoading, isSuccess, serverError, shakeKey, capsLock,
    focused, setFocused, onSubmit, onPasswordKey, clearCapsLock,
  } = flow;

  const blur = (field) => () => setFocused((f) => (f === field ? null : f));

  return (
    <motion.div variants={variants} className="relative">
      <motion.div
        aria-hidden
        animate={{ opacity: focused ? 1 : 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-b from-gold/60 via-gold/10 to-transparent"
      />

      <Card className="sheen relative border-border/70 bg-card/95 shadow-card backdrop-blur-sm">
        <CardContent className="p-7 sm:p-8">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Staff access
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the account issued to you. Sessions end automatically after 30 days.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <LoginField id="email" label="Email" icon={Mail} error={errors.email?.message} active={focused === 'email'}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="you@gharjatan.com.np"
                className="h-11 bg-background/60 pl-10"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email', { onBlur: blur('email') })}
                onFocus={() => setFocused('email')}
              />
            </LoginField>

            <LoginField id="password" label="Password" icon={Lock} error={errors.password?.message} active={focused === 'password'}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 bg-background/60 pl-10 pr-16"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password', {
                  onBlur: () => { blur('password')(); clearCapsLock(); },
                })}
                onFocus={() => setFocused('password')}
                onKeyUp={onPasswordKey}
                onKeyDown={onPasswordKey}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? 'Hide' : 'Show'}
                <span className="sr-only"> password</span>
              </button>
            </LoginField>

            <AnimatePresence>
              {capsLock ? (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden text-xs text-warning"
                >
                  Caps Lock is on.
                </motion.p>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {serverError && !isSuccess ? (
                <motion.div
                  key={shakeKey}
                  initial={{ opacity: 0, y: -6 }}
                  animate={reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -9, 8, -5, 3, 0] }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.42, ease: EASE }}
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{serverError}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Two segments that fill as the form becomes submittable.
                Decoration over the validation that already exists — the button
                stays enabled so a submit still reports why it failed. */}
            <div aria-hidden className="flex items-center gap-3">
              <div className="flex flex-1 gap-1.5">
                {ready.map((done, i) => (
                  <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                    <motion.span
                      className="block h-full bg-gold"
                      initial={false}
                      animate={{ scaleX: done ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    />
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
                {ready.filter(Boolean).length}/2 ready
              </span>
            </div>

            <Magnetic strength={0.18} radius={110} className="block">
              <Button
                type="submit"
                variant="ink"
                size="xl"
                loading={isLoading}
                disabled={isSuccess}
                className="group relative w-full overflow-hidden"
              >
                {/* A brass sweep crosses the button on hover — light on a surface. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-gold/25 transition-[left] duration-700 ease-out group-hover:left-[150%]"
                />
                <span className="relative flex items-center gap-2">
                  {isSuccess ? 'Signed in' : 'Sign in'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Button>
            </Magnetic>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
