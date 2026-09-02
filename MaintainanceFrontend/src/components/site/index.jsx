import {
  BadgeCheck, CalendarCheck, ChefHat, Clock, Coins, Compass, Droplets, Expand, FileCheck,
  FileText, Flame, Gift, Hammer, HardHat, Home, LayoutGrid, Phone, Plug, Receipt, Recycle,
  Recycle as Loop, Ruler, Search, Shield, ShieldCheck, Sofa, TestTube, Timer, Umbrella,
  Wrench, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Reveal, WordReveal, WordRevealOnView, Spotlight, DriftField, motion } from '@/components/motion';
import { formatNpr } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Shared vocabulary for the marketing site. Sections on the home page, the
 * services page and the pricing page are all built from these three pieces, so
 * the rhythm — rule, eyebrow, display heading, body — never drifts between them.
 */

/**
 * CMS rows carry a kebab-case lucide name in `icon`. Mapping them explicitly
 * (rather than `import * as Icons`) keeps the marketing bundle to the icons we
 * actually ship, and makes an unknown name fail visibly at review time.
 */
const ICONS = {
  'badge-check': BadgeCheck, 'calendar-check': CalendarCheck, 'chef-hat': ChefHat,
  clock: Clock, coins: Coins, compass: Compass, droplets: Droplets, expand: Expand,
  'file-check': FileCheck, 'file-text': FileText, flame: Flame, gift: Gift, hammer: Hammer,
  'hard-hat': HardHat, home: Home, 'layout-grid': LayoutGrid, loop: Loop, phone: Phone,
  plug: Plug, receipt: Receipt, recycle: Recycle, ruler: Ruler, search: Search,
  shield: Shield, 'shield-check': ShieldCheck, sofa: Sofa, 'test-tube': TestTube,
  timer: Timer, umbrella: Umbrella, wrench: Wrench, zap: Zap,
};

/** Renders the icon a content row asked for, falling back to a neutral mark. */
export function DataIcon({ name, className }) {
  const Icon = ICONS[name] ?? Compass;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />;
}

/** A small caps label with a leading rule — the tag above every heading. */
export function Eyebrow({ children, tone = 'gold', className }) {
  if (!children) return null;
  return (
    <p className={cn('eyebrow flex items-center gap-3', tone === 'gold' ? 'text-gold' : 'text-ink-muted', className)}>
      <span className={cn('h-px w-8', tone === 'gold' ? 'bg-gold/60' : 'bg-ink-muted/50')} aria-hidden />
      {children}
    </p>
  );
}

/**
 * Vertical rhythm for a marketing band. `tone` picks the surface; nothing else
 * on the site sets its own section background.
 */
export function SectionShell({ children, className, tone = 'paper', id, wide = false }) {
  return (
    <section
      id={id}
      className={cn(
        'relative py-20 md:py-28',
        tone === 'muted' && 'bg-muted/60',
        tone === 'ink' && 'ink-panel',
        className,
      )}
    >
      <div className={cn('container relative', wide && 'max-w-none 2xl:px-12')}>{children}</div>
    </section>
  );
}

/**
 * Section heading. Left-aligned by default — centred headings everywhere is the
 * tell of a template, and an optional `action` keeps the "see all" link on the
 * same optical line as the title.
 */
export function SectionHeading({ eyebrow, title, description, action, align = 'left', tone = 'paper', className }) {
  const centred = align === 'center';
  return (
    <Reveal
      from="none"
      blur={false}
      className={cn(
        'mb-12 gap-6 md:mb-16',
        centred ? 'mx-auto max-w-2xl text-center' : 'flex flex-col md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn(centred ? 'flex flex-col items-center' : 'max-w-2xl')}>
        <Eyebrow tone={tone === 'ink' ? 'muted' : 'gold'}>{eyebrow}</Eyebrow>
        <WordRevealOnView
          as="h2"
          text={title}
          className={cn(
            'mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[2.75rem]',
            !eyebrow && 'mt-0',
          )}
        />
        {description ? (
          <p className={cn('mt-4 text-[15px] leading-relaxed', tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className={cn('shrink-0', centred && 'mt-6')}>{action}</div> : null}
    </Reveal>
  );
}

/** Five stars, filled to the rating. Gold, because the accent is gold everywhere. */
export function Stars({ rating = 5, className }) {
  return (
    <div className={cn('flex gap-1', className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn('h-3.5 w-3.5', i < rating ? 'fill-gold' : 'fill-current opacity-20')} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L10 14.8 4.8 17.5l1-5.8L1.5 7.6l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

/** Monospaced-feeling section index — 01, 02, 03 — used on cards and lists. */
export function Index({ n, className }) {
  return (
    <span className={cn('font-display text-sm tabular-nums', className)}>
      {String(n).padStart(2, '0')}
    </span>
  );
}

/**
 * The masthead every interior public page opens with. It continues the ink of
 * the header, so a visitor arriving from the home page hero never sees a seam.
 */
export function PageHero({ eyebrow, title, description, children, className }) {
  return (
    <section className={cn('ink-panel relative overflow-hidden', className)}>
      <div className="blueprint mask-b absolute inset-0 opacity-60" aria-hidden />
      <Spotlight size={560} />
      <DriftField count={10} />
      <div className="container relative py-16 md:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <WordReveal
          as="h1"
          text={title}
          className={cn(
            'block max-w-3xl font-display text-[clamp(2.1rem,4.4vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.025em]',
            eyebrow ? 'mt-5' : 'mt-0',
          )}
        />
        {description ? (
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-muted">{description}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * One service tile, shared by the home page grid and the services index so the
 * two can never drift apart. Meant to sit in a `gap-px bg-border` grid.
 */
export function ServiceCard({ service, media, index }) {
  const asset = service.imageId ? media?.[service.imageId] : null;
  const img = asset ? (asset.variants?.['800'] ?? asset.url) : null;

  return (
    <Link to={`/services/${service.slug}`} className="group relative flex h-full flex-col">
      <span
        className="absolute inset-x-0 top-0 z-10 h-px origin-left scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:scale-x-100"
        aria-hidden
      />
      {/* A card with a photograph gets a full frame; one without gets a short
          marker band, so an empty site does not read as broken. */}
      <div className={cn('relative overflow-hidden bg-muted', img ? 'aspect-[16/10]' : 'h-32')}>
        {img ? (
          <motion.div
            className="h-full w-full"
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            whileInView={{ clipPath: 'inset(0% 0 0 0)' }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={img} alt="" loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          </motion.div>
        ) : (
          <div className="blueprint-fine grid h-full w-full place-items-center bg-muted">
            <DataIcon name={service.icon} className="h-7 w-7 text-muted-foreground/45 transition-colors duration-300 group-hover:text-gold" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
          {service.category?.name ?? 'Service'}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-baseline gap-3">
          <Index n={index} className="text-gold" />
          <h3 className="font-display text-xl font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
            {service.name}
          </h3>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{service.excerpt}</p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="text-sm">
            {service.priceFrom ? (
              <>
                <span className="font-display text-lg font-semibold">{formatNpr(service.priceFrom, { compact: true })}</span>
                <span className="text-muted-foreground">
                  {service.priceUnit ? ` / ${service.priceUnit}` : ''} onwards
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Priced after a free inspection</span>
            )}
          </p>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

/**
 * Column count for a hairline grid: the seams are drawn by the background, so a
 * half-empty last row would show as a grey block. Returns the columns to use
 * and how many blank tiles close the final row.
 */
export function gridFit(count) {
  const cols = count % 3 === 0 ? 3 : 2;
  return { cols, fillers: (cols - (count % cols)) % cols };
}
