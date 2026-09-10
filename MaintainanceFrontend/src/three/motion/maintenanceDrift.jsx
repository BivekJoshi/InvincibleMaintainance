import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/helpers/utils';

/**
 * Trades work going on quietly behind the storefront copy.
 *
 * Four drawings, each fitted to a part of the band the layout leaves empty: a
 * services void along the top, a flow-and-return riser down the gutter between
 * the copy and the scene card, a ladder in the left margin and a circuit
 * dropping the right one. Scattering small vignettes into the corners was the
 * first attempt and it read as litter — a drawing has to be big enough to be a
 * drawing.
 *
 * Everything is at about 7% of the foreground colour, and that is the point: the
 * reader should register that something is being worked on without ever being
 * asked to look at it. What moves is what would actually be moving on a site —
 * water and current running the services, a handwheel being closed and a gauge
 * answering it, a damper swinging, an extract fan and a circulator turning, a
 * spanner pulling a joint up tight, a breaker thrown, a tile going down, and a
 * drop gathering at an elbow nobody has got to yet.
 *
 * Two tricks are worth naming. A pulse is a short bright dash drawn on top of
 * its own run and translated end to end: the same shape as the pipe it travels,
 * so it reads as something moving *inside* the pipe, at the cost of a transform
 * rather than the stroke-dashoffset animation it imitates. And the top void is
 * masked off at its foot, which is what lets it carry four services' worth of
 * detail without any of it reaching the headline.
 *
 * The motion kit's four rules hold. Only transform and opacity animate (plus
 * `pathLength` on the dimensions, which is stroke-dashoffset underneath);
 * nothing here can be clicked; every position and delay is written down rather
 * than rolled, so the composition is identical on every visit; and under
 * `prefers-reduced-motion` the drawing simply stands still.
 */

// One pen for all four, so separate drawings read as a single hand. The stroke
// is deliberately non-scaling — these sit at very different scales, and a scaled
// stroke would give each its own line weight.
const PEN = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
};

// The two services that get a colour, because they are the two the company is
// called out for: water in the pipes, current in the conduit. Each is graded
// twice over — perceived weight goes with area, so a dash long enough to cross
// the band has to be dimmer than a drop to carry the same amount of attention.
const WATER = 'hsl(var(--primary) / 0.42)';
const WATER_FLOW = 'hsl(var(--primary) / 0.26)';
const LIVE = 'hsl(var(--gold) / 0.55)';
const LIVE_FLOW = 'hsl(var(--gold) / 0.32)';

// SVG transform-origin is a known footgun — pinned to the viewBox explicitly
// rather than left to the browser's default transform-box.
const pivot = (x, y) => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` });

const HANGERS = [140, 480, 860, 1320];
const UNIONS = [200, 900];
const TRAY_RUNGS = Array.from({ length: 23 }, (_, i) => 26 + i * 48);
const DUCT_RODS = [200, 760, 1300];
const BREAKERS = [24, 36, 48, 60];

/** Rungs climb a leaning ladder by interpolating between its two rails. */
const RUNGS = [0.12, 0.28, 0.44, 0.6, 0.76, 0.92].map((t) => ({
  t,
  x: 12 + 32 * t,
  y: 236 - 230 * t,
}));

// The drop falls, lands, and the ring it makes is timed to the landing rather
// than to a rhythm of its own — the two would drift apart within a minute.
const FALL = 1.7;
const FALL_GAP = 3.6;

export function MaintenanceDrift({ className }) {
  const reduced = useReducedMotion();
  // Under reduced motion each motif keeps its static attributes and never
  // receives an `animate` prop, so the drawing stands still rather than
  // disappearing — nothing here is said by the movement alone.
  const play = (spec) => (reduced ? undefined : spec);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ color: 'hsl(var(--foreground) / 0.07)' }}
    >
      {/* ── the services void ── the top strip is the one place that is empty at
          every width, and a run of services is the rare motif that wants to be
          1400 long and 220 tall. Masked off at the foot so the duct dissolves
          before it can reach the headline, and held at a minimum width so it
          stays a drawing on a phone instead of shrinking to a scratch. */}
      <svg
        viewBox="0 0 1440 220"
        className="mask-b absolute left-1/2 top-0 w-full min-w-[1180px] -translate-x-1/2"
      >
        <g {...PEN}>
          {/* two dimensions across the void, taken one after the other */}
          <path d="M120 10 V30" />
          <path d="M380 10 V30" />
          <motion.path
            d="M120 20 H380"
            animate={play({ pathLength: [0, 0, 1, 1, 1], opacity: [0.1, 0.1, 1, 1, 0.1] })}
            transition={{ duration: 14, times: [0, 0.42, 0.6, 0.86, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
          <path d="M120 20 L130 16 M120 20 L130 24" />
          <path d="M380 20 L370 16 M380 20 L370 24" />

          <path d="M400 10 V30" />
          <path d="M1040 10 V30" />
          <motion.path
            d="M400 20 H1040"
            animate={play({ pathLength: [0, 1, 1, 1], opacity: [0.1, 1, 1, 0.1] })}
            transition={{ duration: 14, times: [0, 0.22, 0.4, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
          <path d="M400 20 L410 16 M400 20 L410 24" />
          <path d="M1040 20 L1030 16 M1040 20 L1030 24" />

          {/* threaded rod dropping from the slab, nutted above the pipe */}
          {HANGERS.map((x) => (
            <g key={x}>
              <path d={`M${x} 40 V62`} />
              <path d={`M${x - 5} 52 H${x + 5}`} />
            </g>
          ))}

          {/* the main run: unions, a reducer, a strainer, a flanged joint */}
          <path d="M0 62 H1440" strokeWidth="4" />
          {UNIONS.map((x) => (
            <g key={x}>
              <path d={`M${x - 4} 53 V71`} />
              <path d={`M${x + 4} 53 V71`} />
            </g>
          ))}
          <path d="M294 54 L310 58 M294 70 L310 66" />
          <path d="M416 62 L434 86 M424 88 H446" />
          <path d="M1156 50 V74 M1164 50 V74" />
          {!reduced && (
            <motion.path
              d="M0 62 H90" strokeWidth="4" stroke={WATER_FLOW}
              animate={{ x: [-110, 1450] }}
              transition={{ duration: 13, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* a tee dropping to the floor below, and the drop it is losing */}
          <path d="M700 62 V96" strokeWidth="4" />
          <motion.circle
            cx="700" cy="80" r="3.4" fill={WATER} stroke="none"
            animate={play({ y: [0, 44], opacity: [0, 1, 1, 0] })}
            transition={{ duration: FALL, repeat: Infinity, repeatDelay: FALL_GAP, ease: 'easeIn' }}
          />

          {/* the isolating valve, drawn face-on so that closing it reads */}
          <path d="M1000 48 V62" />
          <motion.g
            style={pivot(1000, 34)}
            animate={play({ rotate: [0, 132] })}
            transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
          >
            <circle cx="1000" cy="34" r="14" />
            <path d="M986 34 H1014 M993 22 L1007 46 M993 46 L1007 22" />
          </motion.g>

          {/* the gauge that answers it */}
          <path d="M1240 62 V47" />
          <circle cx="1240" cy="34" r="13" />
          <motion.path
            d="M1240 34 V23" style={pivot(1240, 34)}
            animate={play({ rotate: [-54, 46, -54] })}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* cable tray, rungs and all, with the circuit live inside it */}
          <path d="M0 100 H1130 M0 116 H1130" />
          {TRAY_RUNGS.map((x) => (
            <path key={x} d={`M${x} 100 V116`} />
          ))}
          <path d="M1130 100 Q1156 100 1156 126 V220" />
          <rect x="316" y="82" width="52" height="34" rx="3" />
          {!reduced && (
            <motion.path
              d="M0 108 H64" stroke={LIVE_FLOW}
              animate={{ x: [-80, 1200] }}
              transition={{ duration: 7, repeat: Infinity, repeatDelay: 1.8, ease: 'linear' }}
            />
          )}

          {/* ductwork, hung below everything else */}
          {DUCT_RODS.map((x) => (
            <path key={x} d={`M${x} 124 V148`} />
          ))}
          <path d="M0 148 H1440 M0 194 H1440" />
          <path d="M294 148 V194 M301 148 V194 M308 148 V194 M315 148 V194" />
          <path d="M876 144 V198 M884 144 V198" />

          {/* a volume damper, swinging between shut and wide open */}
          <path d="M508 148 V194 M532 148 V194" />
          <motion.path
            d="M520 152 V190" style={pivot(520, 171)}
            animate={play({ rotate: [0, 74, 0] })}
            transition={{ duration: 8, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
          />

          {/* and the extract fan pulling through it */}
          <circle cx="1120" cy="171" r="21" />
          <motion.g
            style={pivot(1120, 171)}
            animate={play({ rotate: 360 })}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 90, 180, 270].map((deg) => (
              <path key={deg} d="M1120 171 Q1129 157 1141 161" transform={`rotate(${deg} 1120 171)`} />
            ))}
          </motion.g>
        </g>
      </svg>

      {/* ── the riser ── the gutter between the copy and the scene card. Only
          exists once the grid goes two-up, so it is desktop-only. Flow down and
          return up, which is why the two pulses travel opposite ways, and where
          the work actually happens: a spanner pulling a joint up tight. */}
      <svg
        viewBox="0 0 130 500"
        className="absolute left-1/2 top-[168px] hidden w-[130px] -translate-x-1/2 lg:block"
      >
        <g {...PEN}>
          <path d="M38 0 V400" strokeWidth="4" />
          <path d="M38 400 Q38 424 62 424 H130" strokeWidth="4" />
          <path d="M74 0 V372" strokeWidth="3" />
          <path d="M38 200 H74" />
          {!reduced && (
            <motion.path
              d="M38 0 V74" strokeWidth="4" stroke={WATER_FLOW}
              animate={{ y: [-90, 430] }}
              transition={{ duration: 6.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' }}
            />
          )}
          {!reduced && (
            <motion.path
              d="M74 0 V62" stroke={WATER_FLOW} strokeWidth="3"
              animate={{ y: [400, -70] }}
              transition={{ duration: 7.4, repeat: Infinity, repeatDelay: 0.9, ease: 'linear' }}
            />
          )}

          {/* clamped back to the wall, as a riser has to be */}
          <rect x="4" y="142" width="13" height="17" rx="2" />
          <path d="M17 150 H58" />
          <path d="M26 86 H50 M26 94 H50" />

          {/* gate valve, handwheel side-on */}
          <path d="M38 250 H68 M68 236 V264" />

          {/* the circulator on the return, turning the whole time */}
          <rect x="60" y="292" width="28" height="34" rx="3" />
          <circle cx="74" cy="309" r="10" />
          <motion.g
            style={pivot(74, 309)}
            animate={play({ rotate: 360 })}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 120, 240].map((deg) => (
              <path key={deg} d="M74 309 Q80 302 82 309" transform={`rotate(${deg} 74 309)`} />
            ))}
          </motion.g>

          {/* the joint being tightened: hex, ring spanner, and the pull */}
          <path d="M47 352 L42.5 359.8 L33.5 359.8 L29 352 L33.5 344.2 L42.5 344.2 Z" />
          <motion.g
            style={pivot(38, 352)}
            animate={play({ rotate: [-12, 6, -12, -12] })}
            transition={{ duration: 4.6, times: [0, 0.32, 0.44, 1], repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="38" cy="352" r="16" />
            <path d="M49.3 340.7 L102 288" strokeWidth="5" />
          </motion.g>

          {/* what the joint is losing while it waits, and the ring it makes */}
          <motion.circle
            cx="94" cy="436" r="3" fill={WATER} stroke="none"
            animate={play({ y: [0, 34], opacity: [0, 1, 1, 0] })}
            transition={{ duration: FALL, repeat: Infinity, repeatDelay: FALL_GAP, delay: 0.9, ease: 'easeIn' }}
          />
          <ellipse cx="94" cy="476" rx="11" ry="2.4" />
          <motion.ellipse
            cx="94" cy="476" rx="11" ry="2.4" style={pivot(94, 476)}
            animate={play({ scale: [0.3, 1.35], opacity: [0, 0.9, 0] })}
            transition={{
              duration: 1.4, repeat: Infinity, repeatDelay: FALL + FALL_GAP - 1.4,
              delay: 0.9 + FALL, ease: 'easeOut',
            }}
          />
        </g>
      </svg>

      {/* ── the ladder ── the left margin, empty at every desktop width, with
          the tiling that is waiting at the foot of it. */}
      <svg
        viewBox="0 0 80 300"
        className="absolute left-0 top-[40%] hidden w-[74px] lg:block"
      >
        <g {...PEN}>
          <path d="M12 236 L44 6" />
          <path d="M40 236 L72 6" />
          {RUNGS.map((r) => (
            <path key={r.t} d={`M${r.x.toFixed(1)} ${r.y.toFixed(1)} H${(r.x + 28).toFixed(1)}`} />
          ))}

          {/* somebody's pail, hung off a rung and still moving */}
          <motion.g
            style={pivot(40, 135)}
            animate={play({ rotate: [-4.5, 4.5, -4.5] })}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M32 137 Q40 127 48 137" />
            <path d="M31 137 H49 L46 157 H34 Z" />
          </motion.g>

          {/* the stack, and the next one going down on top of it */}
          <rect x="6" y="288" width="46" height="9" rx="1" />
          <rect x="9" y="277" width="46" height="9" rx="1" />
          <rect x="5" y="266" width="46" height="9" rx="1" />
          <motion.rect
            x="7" y="255" width="46" height="9" rx="1"
            animate={play({ x: [34, 0, 0, 0], opacity: [0, 1, 1, 0] })}
            transition={{ duration: 6, times: [0, 0.28, 0.86, 1], repeat: Infinity, ease: 'easeOut' }}
          />
        </g>
      </svg>

      {/* ── the circuit ── the right margin. Answers the ladder across the band
          and gives the tray somewhere to be going: meter, board, and a socket. */}
      <svg
        viewBox="0 0 84 460"
        className="absolute right-0 top-[22%] hidden w-[80px] lg:block"
      >
        <g {...PEN}>
          <path d="M42 0 V190" strokeWidth="3" />
          <path d="M33 60 H51 M33 140 H51" />
          {!reduced && (
            <motion.path
              d="M42 0 V58" strokeWidth="3" stroke={LIVE_FLOW}
              animate={{ y: [-70, 210] }}
              transition={{ duration: 5.2, repeat: Infinity, repeatDelay: 2.2, ease: 'linear' }}
            />
          )}

          {/* the meter, and the disc that never stops */}
          <rect x="14" y="190" width="56" height="60" rx="3" />
          <circle cx="42" cy="220" r="16" />
          <motion.path
            d="M42 220 V206" style={pivot(42, 220)}
            animate={play({ rotate: 360 })}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />

          {/* the board, and one breaker being thrown */}
          <path d="M42 250 V266" />
          <rect x="10" y="266" width="64" height="64" rx="3" />
          <path d="M18 280 H66" />
          {BREAKERS.map((x) => (
            x === 48 ? (
              <motion.path
                key={x} d={`M${x} 292 V308`} style={pivot(x, 292)}
                animate={play({ rotate: [0, 0, -30, -30, 0] })}
                transition={{ duration: 9, times: [0, 0.3, 0.36, 0.8, 0.86], repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : (
              <path key={x} d={`M${x} 292 V308`} />
            )
          ))}

          <path d="M42 330 V348" />
          <rect x="22" y="348" width="40" height="30" rx="3" />
          <motion.circle
            cx="55" cy="356" r="2.4" fill={LIVE} stroke="none"
            animate={play({ opacity: [0.15, 1, 0.15] })}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <path d="M42 378 V398" />
          <rect x="24" y="398" width="36" height="28" rx="3" />
          <path d="M34 407 V415 M50 407 V415" />
        </g>
      </svg>
    </div>
  );
}
