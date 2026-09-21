import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RUNWAY_PROMISE_SHARE, RUNWAY_WARN_MINUTES, runwayLanes, runwayPoint } from '@/helpers/leadBoard';
import { formatCountdown, initials } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** Each zone's colour variable; markers and the legend read it as `--tone`. */
const ZONE_VARS = { ok: '--sla-ok', warn: '--sla-warn', breach: '--sla-breach' };
const zoneStyle = (zone) => ({ '--tone': `var(${ZONE_VARS[zone]})` });

/** Where the last stretch starts on a two-hour promise. */
const WARN_AT = RUNWAY_PROMISE_SHARE * (1 - RUNWAY_WARN_MINUTES / 120);

const TICKS = [
  { at: 0, label: 'Received' },
  { at: RUNWAY_PROMISE_SHARE * 0.25, label: '30 min' },
  { at: RUNWAY_PROMISE_SHARE * 0.5, label: '1 h' },
  { at: WARN_AT, label: '1 h 30' },
  { at: RUNWAY_PROMISE_SHARE, label: 'Deadline', strong: true },
  { at: 1, label: '+1 h late' },
];

const LANE = 40;
/** A marker's width plus a little air: neighbours closer than this share no lane. */
const MARKER_SPAN = 38;

/** The element's width, kept current as it resizes; 0 until it has been measured. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Today's score as a small ring: the share of answered enquiries answered in time. */
function PromiseScore({ met, answered, newToday }) {
  const share = answered ? met / answered : null;
  const r = 30;
  const length = 2 * Math.PI * r;
  const stroke = share == null ? 'stroke-ink-foreground/25' : share >= 0.9 ? 'stroke-sla-ok' : share >= 0.7 ? 'stroke-sla-warn' : 'stroke-sla-breach';
  return (
    <div className="flex items-center gap-3 lg:w-56 lg:shrink-0 lg:flex-col lg:items-start lg:border-r lg:border-ink-foreground/10 lg:pr-5">
      <div className="relative h-[72px] w-[72px] shrink-0">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="36" cy="36" r={r} className="fill-none stroke-ink-foreground/10" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} strokeWidth="6" strokeLinecap="round"
            className={cn('fill-none transition-[stroke-dashoffset] duration-1000 motion-reduce:transition-none', stroke)}
            strokeDasharray={length} strokeDashoffset={length * (1 - (share ?? 0))}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-base font-bold tabular-nums">
          {share == null ? '—' : `${Math.round(share * 100)}%`}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Today’s promise</p>
        <p className="mt-1 text-sm">
          <span className="text-lg font-semibold tabular-nums">{answered ? `${met} of ${answered}` : 'None yet'}</span>
          <span className="block text-xs text-ink-muted">answered inside two hours</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {newToday} new enquir{newToday === 1 ? 'y' : 'ies'} today
        </p>
      </div>
    </div>
  );
}

function Marker({ lead, point, onSelect }) {
  const late = point.zone === 'breach';
  const when = late
    ? `${formatCountdown(point.minutesLeft).replace(' overdue', '')} past the deadline`
    : formatCountdown(point.minutesLeft);
  // Keep the whole marker on the track at both ends.
  const left = `clamp(18px, ${point.x * 100}%, calc(100% - 18px))`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect?.(lead.id)}
          aria-label={`${lead.name}, ${when}`}
          style={{ ...zoneStyle(point.zone), left, top: point.lane * LANE + 6 }}
          className={cn(
            'group absolute flex -translate-x-1/2 flex-col items-center',
            'transition-[left] duration-700 ease-out motion-reduce:transition-none',
            'focus-visible:outline-none',
          )}
        >
          <span
            className={cn(
              'relative grid h-8 w-8 place-items-center rounded-full border-2 border-[hsl(var(--tone))] bg-ink text-[11px] font-bold text-ink-foreground',
              'shadow-[0_0_0_4px_hsl(var(--tone)/0.18)] transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-gold motion-reduce:transition-none',
            )}
          >
            {initials(lead.name)}
            {late ? (
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-[hsl(var(--tone))] opacity-40 motion-reduce:hidden" />
            ) : null}
          </span>
          {point.pinned ? (
            <span className="mt-0.5 rounded-full bg-[hsl(var(--tone))] px-1.5 text-[9px] font-bold leading-4 text-ink">
              {formatCountdown(point.minutesLeft).replace(' overdue', '')}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60">
        <p className="font-semibold">{lead.name}</p>
        <p className="text-xs text-muted-foreground">{lead.service?.name ?? 'General enquiry'}{lead.area ? ` · ${lead.area}` : ''}</p>
        <p className="mt-1 text-xs font-medium" style={zoneStyle(point.zone)}>
          <span className="text-[hsl(var(--tone))]">{when}</span>
          {lead.assignedTo ? ` · ${lead.assignedTo.name}` : ' · nobody owns it'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The response board's thesis: every enquiry still waiting for its first reply, placed on
 * its own two-hour clock. The first 80% of the track is the promise — its last half hour
 * shaded as the warning — and the rest is the first hour past it, where a later lead pins
 * to the end with how late it is. Choosing a marker hands its id to `onSelect`.
 *
 * @param {{ leads: object[], now: number, met: number, answered: number, newToday: number, onSelect?: (id: string) => void }} props
 */
export function ResponseRunway({ leads, now, met, answered, newToday, onSelect }) {
  const [trackRef, trackWidth] = useWidth();
  // Spacing is in pixels on screen, so a phone stacks neighbours a desktop sets side by side.
  const points = runwayLanes(
    leads.map((lead) => ({ lead, ...runwayPoint(lead, now) })).filter((p) => Number.isFinite(p.x)),
    trackWidth ? MARKER_SPAN / trackWidth : 0.035,
    5,
  );
  const lanes = points.length ? Math.max(...points.map((p) => p.lane)) + 1 : 1;
  const count = (zone) => points.filter((p) => p.zone === zone).length;

  return (
    <section
      aria-label="Response runway"
      className="relative isolate overflow-hidden rounded-2xl bg-ink p-5 text-ink-foreground shadow-card"
    >
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 -z-10 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(hsl(var(--ink-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--ink-foreground))_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        <PromiseScore met={met} answered={answered} newToday={newToday} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Response runway</h2>
              <p className="text-xs text-ink-muted">Everyone still waiting for a first reply, placed on their two-hour clock.</p>
            </div>
            <ul className="flex flex-wrap gap-3 text-xs" aria-label="On the runway">
              {[['ok', 'On track'], ['warn', 'Last 30 min'], ['breach', 'Past the deadline']].map(([zone, label]) => (
                <li key={zone} style={zoneStyle(zone)} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--tone))]" />
                  <span className="font-semibold tabular-nums">{count(zone)}</span>
                  <span className="text-ink-muted">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <TooltipProvider delayDuration={100}>
            <div ref={trackRef} className="relative mt-4" style={{ height: lanes * LANE + 16 }}>
              {/* The track: the promise, its last stretch, then the time past it. */}
              <div aria-hidden className="absolute inset-0 overflow-hidden rounded-xl">
                <div className="absolute inset-y-0 left-0 bg-sla-ok/10" style={{ width: `${WARN_AT * 100}%` }} />
                <div
                  className="absolute inset-y-0 bg-sla-warn/15"
                  style={{ left: `${WARN_AT * 100}%`, width: `${(RUNWAY_PROMISE_SHARE - WARN_AT) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,hsl(var(--sla-breach)/0.22)_0_6px,hsl(var(--sla-breach)/0.08)_6px_12px)]"
                  style={{ left: `${RUNWAY_PROMISE_SHARE * 100}%` }}
                />
                {TICKS.slice(1, -1).map((t) => (
                  <span
                    key={t.label}
                    className={cn('absolute inset-y-0 w-px', t.strong ? 'bg-sla-breach' : 'border-l border-dashed border-ink-foreground/15')}
                    style={{ left: `${t.at * 100}%` }}
                  />
                ))}
              </div>

              {points.length ? (
                points.map((p) => <Marker key={p.lead.id} lead={p.lead} point={p} onSelect={onSelect} />)
              ) : (
                <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">
                  <CheckCircle2 className="h-4 w-4 text-sla-ok" aria-hidden /> Clear runway — nobody is waiting for a reply.
                </p>
              )}
            </div>
          </TooltipProvider>

          <div aria-hidden className="relative mt-1.5 h-4 text-[10px] text-ink-muted">
            {TICKS.map((t, i) => (
              <span
                key={t.label}
                className={cn(
                  'absolute whitespace-nowrap',
                  i === 0 ? 'left-0' : i === TICKS.length - 1 ? 'right-0' : '-translate-x-1/2',
                  t.strong && 'font-semibold text-sla-breach',
                  // The middle ticks crowd on a phone; keep the ends and the deadline.
                  !t.strong && i > 0 && i < TICKS.length - 1 && 'hidden sm:inline',
                )}
                style={i > 0 && i < TICKS.length - 1 ? { left: `${t.at * 100}%` } : undefined}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The runway in a line, for a card on a light surface: the same zones, each waiting lead a dot.
 * Read as a picture — its label says how many sit in each zone.
 *
 * @param {{ leads: { id: string, name: string, createdAt: string, sla?: { dueAt?: string } }[], now?: number, className?: string }} props
 */
export function RunwayStrip({ leads, now = Date.now(), className }) {
  const points = runwayLanes(
    leads.map((lead) => ({ lead, ...runwayPoint(lead, now) })).filter((p) => Number.isFinite(p.x)),
    0.02, 2,
  );
  const count = (zone) => points.filter((p) => p.zone === zone).length;
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`${count('ok')} on track, ${count('warn')} in the last 30 minutes, ${count('breach')} past the deadline`}
        className="relative h-7 overflow-hidden rounded-lg bg-muted/60"
      >
        <div aria-hidden className="absolute inset-y-0 left-0 bg-sla-ok/15" style={{ width: `${WARN_AT * 100}%` }} />
        <div aria-hidden className="absolute inset-y-0 bg-sla-warn/20" style={{ left: `${WARN_AT * 100}%`, width: `${(RUNWAY_PROMISE_SHARE - WARN_AT) * 100}%` }} />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,hsl(var(--sla-breach)/0.2)_0_5px,transparent_5px_10px)]"
          style={{ left: `${RUNWAY_PROMISE_SHARE * 100}%` }}
        />
        <span aria-hidden className="absolute inset-y-0 w-px bg-sla-breach" style={{ left: `${RUNWAY_PROMISE_SHARE * 100}%` }} />
        {points.map((p) => (
          <span
            key={p.lead.id}
            aria-hidden
            title={p.lead.name}
            style={{ ...zoneStyle(p.zone), left: `clamp(7px, ${p.x * 100}%, calc(100% - 7px))`, top: p.lane ? 15 : 5 }}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[hsl(var(--tone))] ring-2 ring-card transition-[left] duration-700 motion-reduce:transition-none"
          />
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-3.5 text-[10px] text-muted-foreground">
        <span className="absolute left-0">Came in</span>
        <span className="absolute -translate-x-1/2 font-semibold text-sla-breach" style={{ left: `${RUNWAY_PROMISE_SHARE * 100}%` }}>2 h</span>
        <span className="absolute right-0">Late</span>
      </div>
    </div>
  );
}
