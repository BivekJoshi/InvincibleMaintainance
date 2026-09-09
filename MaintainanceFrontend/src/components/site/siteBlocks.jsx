import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  BadgeCheck, CalendarCheck, ChefHat, Clock, Coins, Compass, Droplets, Expand, FileCheck,
  FileText, Flame, Gift, Hammer, HardHat, Home, LayoutGrid, Phone, Plug, Receipt, Recycle,
  Ruler, Search, Shield, Sofa, TestTube, Timer, Umbrella, Wrench, Zap,
} from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Reveal, RevealImage, motion } from '@/three/motion/motionKit';
import { formatNpr, imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * Shared vocabulary for the storefront. Every public page is assembled from
 * these, so the catalogue, the home page and the service pages cannot drift.
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
  'hard-hat': HardHat, home: Home, 'layout-grid': LayoutGrid, phone: Phone,
  plug: Plug, receipt: Receipt, recycle: Recycle, ruler: Ruler, search: Search,
  shield: Shield, 'shield-check': ShieldCheck, sofa: Sofa, 'test-tube': TestTube,
  timer: Timer, umbrella: Umbrella, wrench: Wrench, zap: Zap,
};

/** Renders the icon a content row asked for, falling back to a neutral mark. */
export function DataIcon({ name, className }) {
  const Icon = ICONS[name] ?? Compass;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />;
}

/**
 * A reserved space for a picture.
 *
 * Every image on the public site goes through this. The point is the *space*:
 * the box is laid out from its ratio before anything loads, so a section looks
 * the same whether or not an editor has uploaded the picture yet, and uploading
 * one never reflows the page around it. With no media it draws the engineering
 * grid and the section's own icon, which is a deliberate placeholder rather
 * than a gap.
 *
 * @param {object} props
 * @param {object|string} [props.media] resolved media row, or a URL
 * @param {number} [props.ratio] width / height — 16/10 by default
 * @param {number} [props.width] variant to request from the media row
 * @param {string} [props.icon] lucide name drawn when there is no picture
 * @param {boolean} [props.reveal] wipe the picture open as it scrolls in
 * @param {'none'|'soft'|'ink'} [props.scrim] gradient for text laid over it
 * @param {boolean} [props.fill] take the parent's height instead of a ratio,
 *   for a slot whose box the layout already decides — a column beside copy that
 *   has to end level with it, rather than at whatever height a ratio lands on
 */
export function Media({
  media, alt = '', ratio = 16 / 10, width = 800, icon = 'hammer', className, imgClassName,
  reveal = false, scrim = 'none', zoom = false, priority = false, fill = false, children,
}) {
  const src = imageUrl(media, width);

  const picture = src ? (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn(
        'h-full w-full object-cover',
        zoom && 'transition-transform duration-700 ease-out group-hover:scale-[1.05]',
        imgClassName,
      )}
    />
  ) : (
    <div className="blueprint-fine grid h-full w-full place-items-center bg-muted/40">
      <DataIcon name={icon} className="h-7 w-7 text-muted-foreground/35" />
    </div>
  );

  const body = (
    <>
      {reveal && src ? <RevealImage className="h-full w-full">{picture}</RevealImage> : picture}
      {scrim !== 'none' && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            scrim === 'ink'
              ? 'bg-gradient-to-t from-ink/85 via-ink/25 to-transparent'
              : 'bg-gradient-to-t from-background/70 to-transparent',
          )}
        />
      )}
      {children}
    </>
  );

  if (fill) {
    return <div className={cn('relative h-full w-full overflow-hidden bg-muted', className)}>{body}</div>;
  }

  return (
    <AspectRatio ratio={ratio} className={cn('relative overflow-hidden bg-muted', className)}>
      {body}
    </AspectRatio>
  );
}

/** A small caps label above a heading. */
export function Eyebrow({ children, className }) {
  if (!children) return null;
  return (
    <p className={cn('text-[11px] font-bold uppercase tracking-[0.14em] text-primary', className)}>
      {children}
    </p>
  );
}

/** Vertical rhythm for a storefront band. `tone` picks the surface. */
export function SectionShell({ children, className, tone = 'paper', id }) {
  return (
    <section
      id={id}
      className={cn(
        'relative py-12 md:py-16',
        tone === 'muted' && 'bg-muted/50',
        tone === 'ink' && 'ink-panel',
        className,
      )}
    >
      <div className="container relative">{children}</div>
    </section>
  );
}

/** Section heading with an optional "see all" action on the same optical line. */
export function SectionHeading({ eyebrow, title, description, action, tone = 'paper', className }) {
  return (
    <Reveal
      from="none"
      blur={false}
      className={cn('mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <span className="flex items-center gap-2.5">
            <span className={cn('h-px w-6 shrink-0', tone === 'ink' ? 'bg-gold' : 'bg-gold/70')} aria-hidden />
            <Eyebrow className={tone === 'ink' ? 'text-gold' : undefined}>{eyebrow}</Eyebrow>
          </span>
        ) : null}
        <h2 className={cn('text-2xl font-bold tracking-tight md:text-[1.75rem]', eyebrow && 'mt-2.5')}>{title}</h2>
        {description ? (
          <p className={cn('mt-2 text-sm leading-relaxed', tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Reveal>
  );
}

/** Five stars, filled to the rating. */
export function Stars({ rating = 5, className }) {
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn('h-3.5 w-3.5', i < rating ? 'fill-gold' : 'fill-muted-foreground/25')} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L10 14.8 4.8 17.5l1-5.8L1.5 7.6l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

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

/** The price line on a product card, or the honest absence of one. */
export function PriceTag({ service, className }) {
  if (!service.priceFrom) {
    return (
      <p className={cn('text-sm font-medium text-muted-foreground', className)}>Priced after inspection</p>
    );
  }
  return (
    <p className={className}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">From</span>
      <span className="mt-0.5 block text-lg font-bold leading-none tabular-nums">
        {formatNpr(service.priceFrom, { compact: true })}
        {service.priceUnit ? <span className="text-xs font-normal text-muted-foreground"> /{service.priceUnit}</span> : null}
      </span>
    </p>
  );
}

/**
 * One service tile. This is the unit the whole storefront is built from — the
 * home page grid, the catalogue and the search results all render this, so a
 * price or a booking link can never be shown one way in one place and another
 * way somewhere else.
 */
export function ServiceCard({ service, media, compact = false }) {
  return (
    <Card className="sheen group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card">
      <Link to={`/services/${service.slug}`} className="relative block" aria-label={service.name}>
        <Media
          media={media?.[service.imageId]}
          ratio={compact ? 16 / 9 : 16 / 10}
          icon={service.icon}
          zoom
        />
        {service.category ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/90 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
          >
            {service.category.name}
          </Badge>
        ) : null}
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          <Link to={`/services/${service.slug}`} className="transition-colors hover:text-primary">{service.name}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{service.excerpt}</p>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden />
          Free inspection · 1-month warranty
        </p>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch p-4 pt-0">
        <Separator className="mb-3.5" />
        <div className="flex items-end justify-between gap-3">
          <PriceTag service={service} />
          <Button asChild size="sm" className="shrink-0">
            <Link to={`/book/${service.slug}`}>
              {service.priceFrom ? 'Book' : 'Get a quote'}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

/** A category tile for the storefront's front door. */
export function CategoryTile({ category, count, media, index = 0 }) {
  const picture = media?.[category.imageId];
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 } },
      }}
      className="h-full"
    >
      <Card className="sheen group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card">
        <Link to={`/services?category=${category.slug}`} className="flex h-full flex-col">
          {/* The trade photograph if there is one; the icon plate if there is not.
              Both occupy the same box, so the rail never changes height. */}
          {picture ? (
            <Media media={picture} ratio={16 / 9} icon={category.icon} scrim="soft" zoom />
          ) : null}
          <span className={cn('flex flex-1 flex-col items-center gap-3 p-5 text-center', picture && 'gap-2 py-4')}>
            {picture ? null : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                <DataIcon name={category.icon} />
              </span>
            )}
            <span className="text-sm font-semibold leading-tight tracking-tight">{category.name}</span>
            {count != null ? (
              <span className="text-[11px] text-muted-foreground">{count} service{count === 1 ? '' : 's'}</span>
            ) : null}
          </span>
        </Link>
      </Card>
    </motion.div>
  );
}

/**
 * A published case study. Cost is always a band — the real contract value of a
 * named customer's job never reaches the public site.
 */
export function ProjectCard({ project, media }) {
  const cover = media?.[project.coverId] ?? media?.[project.images?.[0]?.mediaId];

  return (
    <Card className="sheen group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card">
      <Link to={`/projects/${project.slug}`} className="relative block" aria-label={project.title}>
        <Media media={cover} icon="hammer" zoom />
        {project.service ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/90 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
          >
            {project.service.name}
          </Badge>
        ) : null}
      </Link>

      <CardContent className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          <Link to={`/projects/${project.slug}`} className="transition-colors hover:text-primary">{project.title}</Link>
        </h3>
        {project.problem ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{project.problem}</p>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch p-4 pt-0">
        <Separator className="mb-3.5" />
        <div className="flex items-end justify-between gap-3 text-[11px] text-muted-foreground">
          <span>
            {project.location ? <span className="block">{project.location}</span> : null}
            {project.durationDays ? <span>{project.durationDays} day{project.durationDays === 1 ? '' : 's'}</span> : null}
          </span>
          {project.costBandMin ? (
            <span className="shrink-0 text-right font-medium text-foreground">
              {formatNpr(project.costBandMin, { compact: true })}–{formatNpr(project.costBandMax, { symbol: false, compact: true })}
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
