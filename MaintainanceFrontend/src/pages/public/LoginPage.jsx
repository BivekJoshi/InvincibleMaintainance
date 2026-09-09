import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertCircle, ArrowLeft, ArrowRight, Lock, Mail, Moon, Sun, Monitor, ShieldCheck,
} from 'lucide-react';
import {
  motion, AnimatePresence, useReducedMotion, useMotionVariants, EASE, Spotlight, Magnetic, CountUp,
} from '@/three/motion/motionKit';
import { useLoginMutation } from '@/api/authApi';
import { useGetBootstrapQuery } from '@/api/publicApi';
import { selectTheme, setTheme } from '@/redux/slices/uiSlice';
import { useAuth } from '@/hooks/useAuth';
import { useZodForm, loginSchema, loginDefaults } from '@/form/formKit';
import { IS_DEV } from '@/config/env';
import { FIELD_ROLES } from '@/config/constants';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/helpers/utils';

// three.js is ~120kB gzipped and nothing on this page needs it to sign in, so it
// gets its own chunk and only starts downloading once the form is already usable.
const BlueprintScene = lazy(() =>
  import('@/three/scenes/BlueprintScene').then((m) => ({ default: m.BlueprintScene })));

/** Cycles under the wordmark on the dark panel. Decoration — never the only copy. */
const CREDO = [
  { en: 'Every job answered inside two hours.', ne: 'हरेक काम दुई घण्टाभित्र।' },
  { en: 'Certified engineers. Transparent pricing.', ne: 'प्रमाणित इन्जिनियर। पारदर्शी मूल्य।' },
  { en: 'Warranty tracked from the first visit.', ne: 'पहिलो भ्रमणदेखि वारेन्टी।' },
];

const STATS = [
  { value: 2, suffix: 'h', label: 'Response SLA' },
  { value: 18, suffix: '', label: 'Services' },
  { value: 2016, suffix: '', label: 'Established', plain: true },
];

/** Only rendered by `npm run dev`. The seed gives every account the same password. */
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@gharjatan.com.np' },
  { role: 'Sales', email: 'sales@gharjatan.com.np' },
  { role: 'Dispatch', email: 'dispatch@gharjatan.com.np' },
  { role: 'Accounts', email: 'accounts@gharjatan.com.np' },
  { role: 'Technician', email: 'hari@gharjatan.com.np' },
];

const THEMES = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

const RISE = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/** Registration crosshair — the mark a drawing is aligned by. Purely graphic. */
function Crosshair({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('h-5 w-5', className)} fill="none">
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

/**
 * The back-office sign-in.
 *
 * Two halves: a dark stage carrying a WebGL site that erects itself, and a paper
 * panel carrying the form. The stage is entirely decorative — `aria-hidden`, no
 * pointer events, mounted only above `lg`, and if WebGL is missing the CSS
 * blueprint underneath stands in for it. Nothing on the left is needed to sign
 * in, so the right half works alone on a phone.
 */
export default function LoginPage() {
  const [login, { isLoading, isSuccess, error }] = useLoginMutation();
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const reduced = useReducedMotion();
  // Framer animates in JS, so the global reduced-motion CSS cannot reach it —
  // these variants have to collapse to a plain fade themselves.
  const rise = useMotionVariants(RISE);

  const { data: bootstrap } = useGetBootstrapQuery('en');
  const company = bootstrap?.settings?.['contact.companyName'] ?? 'Ghar Jatan';

  const [wideEnough, setWideEnough] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focused, setFocused] = useState(null);
  const [credo, setCredo] = useState(0);
  const shake = useRef(0);

  const {
    register, handleSubmit, setValue, setFocus, watch, formState: { errors },
  } = useZodForm(loginSchema, { mode: 'onTouched', defaultValues: loginDefaults });

  // Drives the two-segment progress rail under the form. Cheap to compute and
  // it only ever reflects what is already on screen, so it leaks nothing.
  const values = watch();
  const ready = [loginSchema.shape.email.safeParse(values.email).success, values.password.length > 0];

  // The API answers every failure with one message, so this never reveals
  // whether the address exists.
  const serverError = error?.data?.error?.message
    ?? (error ? 'Could not reach the server. Check your connection and try again.' : null);

  // A new error must restart the shake even when the message is identical, so
  // the animation is keyed on a counter rather than on the text.
  useEffect(() => { if (error) shake.current += 1; }, [error]);

  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setCredo((i) => (i + 1) % CREDO.length), 5600);
    return () => clearInterval(id);
  }, [reduced]);

  // Matches the `lg` breakpoint the stage is revealed at. CSS alone would hide
  // the panel on a phone but React would still mount it and fetch three.js.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWideEnough(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const destination = useMemo(() => {
    // Keep the query string: a deep link into a filtered list is worth returning to.
    const from = location.state?.from;
    if (from) return `${from.pathname}${from.search ?? ''}`;
    return FIELD_ROLES.includes(role) ? '/tech' : '/admin';
  }, [location.state, role]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    // Let the confirmation read before the route changes — but only when motion
    // is welcome, and never long enough to feel like latency.
    if (reduced) {
      navigate(destination, { replace: true });
      return undefined;
    }
    const id = setTimeout(() => navigate(destination, { replace: true }), 700);
    return () => clearTimeout(id);
  }, [isAuthenticated, destination, navigate, reduced]);

  const onSubmit = (v) => { login(v); };

  const fillDemo = (email) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123', { shouldValidate: true });
    setFocus('password');
  };

  const onPasswordKey = (e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background lg:grid lg:grid-cols-[1.04fr_minmax(0,0.96fr)]">
      {/* ── left: the stage ───────────────────────────────────────────────── */}
      <motion.aside
        initial={reduced ? false : { clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 1, ease: EASE }}
        className="ink-panel relative isolate hidden overflow-hidden lg:block"
      >
        {/* Fallback texture, and a faint weave over the WebGL site either way. */}
        <div className="blueprint pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        {wideEnough ? (
          <Suspense fallback={null}>
            <BlueprintScene className="absolute inset-0" reduced={Boolean(reduced)} />
          </Suspense>
        ) : null}
        <div className="glow-ink pointer-events-none absolute inset-0" aria-hidden />
        {/* Keeps the copy legible wherever the frame happens to be standing. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink via-ink/75 to-transparent" aria-hidden />
        <Spotlight size={640} />

        {/* Registration marks — the panel reads as a sheet, not a photograph. */}
        <div className="pointer-events-none absolute inset-6 text-gold/40" aria-hidden>
          <Crosshair className="absolute -left-2.5 -top-2.5" />
          <Crosshair className="absolute -right-2.5 -top-2.5" />
          <Crosshair className="absolute -bottom-2.5 -left-2.5" />
          <Crosshair className="absolute -bottom-2.5 -right-2.5" />
        </div>

        {/* Scale rule down the left margin: minor ticks every 16px, a longer
            brass tick every fifth. Two gradients, no elements to lay out. */}
        <div className="pointer-events-none absolute bottom-24 left-10 top-24 w-4 border-l border-ink-foreground/15" aria-hidden>
          <div className="absolute inset-y-0 left-0 w-2 bg-[repeating-linear-gradient(to_bottom,hsl(var(--ink-foreground)/0.25)_0_1px,transparent_1px_16px)]" />
          <div className="absolute inset-y-0 left-0 w-4 bg-[repeating-linear-gradient(to_bottom,hsl(var(--gold)/0.55)_0_1px,transparent_1px_80px)]" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <motion.div initial="hidden" animate="show" variants={rise}>
            <Link to="/" className="group inline-flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/40 bg-gold/10 font-extrabold text-gold transition-colors group-hover:bg-gold/20">
                {company.charAt(0)}
              </span>
              <span>
                <span className="block text-lg font-semibold tracking-tight">{company}</span>
                <span className="eyebrow block text-ink-muted">Back office</span>
              </span>
            </Link>
          </motion.div>

          <div className="max-w-md">
            <motion.p
              initial="hidden" animate="show" variants={rise} transition={{ delay: 0.2 }}
              className="eyebrow text-gold"
            >
              Kathmandu · Nepal
            </motion.p>

            {/* Fixed height: the credo rotates, and the block must not reflow. */}
            <div className="mt-4 min-h-[7rem]">
              <AnimatePresence mode="wait">
                {/* Orchestration lives on the wrapper. Both lines are variant
                    children of it, so they share one show/exit state — a child
                    with its own object animation gets stranded here. */}
                <motion.div
                  key={credo}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.05 } },
                    exit: { opacity: 0, y: -10, transition: { duration: 0.28 } },
                  }}
                >
                  <motion.p
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
                    className="text-balance text-3xl font-semibold leading-tight tracking-tight xl:text-[2.15rem]"
                  >
                    {/* Split on spaces only — never per character, or Devanagari
                        clusters break apart. */}
                    {reduced
                      ? CREDO[credo].en
                      : CREDO[credo].en.split(' ').map((word, i) => (
                        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                          <motion.span
                            className="inline-block"
                            variants={{
                              hidden: { y: '110%', opacity: 0 },
                              show: { y: '0%', opacity: 1, transition: { duration: 0.7, ease: EASE } },
                            }}
                          >
                            {word}&nbsp;
                          </motion.span>
                        </span>
                      ))}
                  </motion.p>
                  <motion.p
                    lang="ne"
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
                    }}
                    className="mt-3 text-base text-ink-muted"
                  >
                    {CREDO[credo].ne}
                  </motion.p>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.dl
              initial="hidden" animate="show" variants={rise} transition={{ delay: 0.4 }}
              className="mt-10 flex items-end gap-10 border-t border-ink-foreground/10 pt-6"
            >
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums text-gold">
                    {stat.plain ? stat.value : <CountUp value={stat.value} />}
                    {stat.suffix}
                  </dd>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-muted">{stat.label}</p>
                </div>
              ))}
            </motion.dl>
          </div>
        </div>
      </motion.aside>

      {/* ── right: the form ──────────────────────────────────────────────── */}
      <main className="glow-paper relative flex min-h-dvh flex-col">
        <div className="blueprint-fine pointer-events-none absolute inset-0 mask-b opacity-70" aria-hidden />

        <header className="relative z-10 flex items-center justify-between gap-4 p-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to website
          </Link>

          <div
            role="group"
            aria-label="Colour theme"
            className="flex items-center gap-0.5 rounded-full border bg-card/70 p-0.5 shadow-sm backdrop-blur"
          >
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => dispatch(setTheme(value))}
                aria-pressed={theme === value}
                title={label}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'relative h-7 w-7 rounded-full hover:bg-transparent',
                  theme === value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {theme === value ? (
                  <motion.span
                    layoutId="theme-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
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

            <motion.div variants={rise} className="relative">
              {/* A brass hairline that brightens around the card while a field is
                  focused. Behind an opaque card it reads as a lit edge. */}
              <motion.div
                aria-hidden
                animate={{ opacity: focused ? 1 : 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-b from-gold/60 via-gold/10 to-transparent"
              />

              <Card className="sheen relative border-border/70 bg-card/95 shadow-card backdrop-blur-sm">
                <CardContent className="p-7 sm:p-8">
                  <p className="eyebrow flex items-center gap-2 text-gold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Staff access
                  </p>
                  <h1 className="mt-3 text-[2rem] font-semibold tracking-tight">Sign in</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the account issued to you. Sessions end automatically after 30 days.
                  </p>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
                    <Field id="email" label="Email" icon={Mail} error={errors.email?.message} active={focused === 'email'}>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        autoFocus
                        placeholder="you@gharjatan.com.np"
                        className="h-11 bg-background/60 pl-10"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        {...register('email', { onBlur: () => setFocused((f) => (f === 'email' ? null : f)) })}
                        onFocus={() => setFocused('email')}
                      />
                    </Field>

                    <Field id="password" label="Password" icon={Lock} error={errors.password?.message} active={focused === 'password'}>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 bg-background/60 pl-10 pr-16"
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        {...register('password', {
                          onBlur: () => {
                            setFocused((f) => (f === 'password' ? null : f));
                            setCapsLock(false);
                          },
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
                    </Field>

                    <AnimatePresence>
                      {capsLock ? (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden text-xs text-sla-warn"
                        >
                          Caps Lock is on.
                        </motion.p>
                      ) : null}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                      {serverError && !isSuccess ? (
                        <motion.div
                          key={shake.current}
                          initial={{ opacity: 0, y: -6 }}
                          animate={reduced
                            ? { opacity: 1, y: 0 }
                            : { opacity: 1, y: 0, x: [0, -9, 8, -5, 3, 0] }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.42, ease: EASE }}
                          role="alert"
                          className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{serverError}</span>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {/* Two segments that fill as the form becomes submittable.
                        Decoration over the validation that already exists — the
                        button stays enabled so a submit still reports why it failed. */}
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
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
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

            {IS_DEV ? (
              <motion.div variants={rise} className="mt-7">
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="eyebrow shrink-0 text-muted-foreground">Demo accounts</span>
                  <Separator className="flex-1" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fillDemo(account.email)}
                      className="h-7 rounded-full bg-card/70 px-3 font-normal text-muted-foreground hover:border-gold/50 hover:text-foreground"
                    >
                      {account.role}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Development build only. Seeded password: <code>Password123</code>
                </p>
              </motion.div>
            ) : null}

            <motion.p variants={rise} className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Locked out? Ask an administrator to reset your password — for security we do not
              send reset links from this screen.
            </motion.p>
          </motion.div>
        </div>

        {/* The confirmation wipe. Cosmetic: the redirect happens either way. */}
        <AnimatePresence>
          {isSuccess && !reduced ? (
            <motion.div
              key="granted"
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 0.5, ease: EASE }}
              className="ink-panel pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3"
              aria-hidden
            >
              {/* The tick draws itself rather than appearing — it reads as a
                  mark being made, which suits the drawing language. */}
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" fill="none">
                <motion.path
                  d="M4 12.5 10 18 20 6"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.25, ease: EASE }}
                />
              </svg>
              <span className="eyebrow text-gold">Access granted</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

/**
 * One labelled field. The brass rail on the left is the only focus signal beyond
 * the ring, and it animates between fields via a shared layoutId so it reads as
 * one rail moving rather than two rails blinking.
 */
function Field({ id, label, icon: Icon, error, active, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} required>{label}</Label>
        <AnimatePresence>
          {error ? (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              id={`${id}-error`}
              className="text-right text-xs text-destructive"
            >
              {error}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative">
        <AnimatePresence>
          {active ? (
            <motion.span
              layoutId="field-rail"
              className="absolute -left-3 top-1 z-10 h-9 w-0.5 rounded-full bg-gold"
              transition={{ type: 'spring', stiffness: 480, damping: 38 }}
            />
          ) : null}
        </AnimatePresence>

        <Icon
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors',
            error ? 'text-destructive' : active ? 'text-gold' : 'text-muted-foreground',
          )}
        />
        {children}
      </div>
    </div>
  );
}
