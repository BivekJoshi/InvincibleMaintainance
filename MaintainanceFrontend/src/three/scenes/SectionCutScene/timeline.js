import { ROOMS } from './rooms';
import { beat, clamp01, easeInOutCubic, easeOutBack, easeOutCubic } from './easing';

/**
 * The timeline, and nothing else.
 *
 * `poseAt` is pure: seconds in, a plain description of where every layer sits
 * out. It never touches the scene graph — `applyPose` in `pose.js` is the only
 * writer. That separation is what makes the reduced-motion frame reachable at
 * all (it is a composition no moment on the timeline produces) and what lets
 * resize and repaint re-apply the last pose instead of guessing a time.
 */

// One room at a time. Each gets a long still hold, one reveal of its own,
// and a short handover to the next. Motion is about a fifth of the loop;
// the rest is a finished room standing still beside the CTA.
const START = 4.2;
const ROOM_T = 15.0;                    // seconds a room owns, handover included
const HOLD = 7.4, OPENING = 1.2, HELD = 2.8;
const SWAP_AT = 13.2, SWAP_T = 1.8;     // when the handover starts, and how long

const fallAt = (t, at) => {
  const p = clamp01((t - at) / 0.9);
  if (p <= 0 || p >= 1) return { alpha: 0, u: 0, len: 0 };
  return {
    alpha: Math.min(1, p / 0.2) * Math.min(1, (1 - p) / 0.24),
    u: p,
    len: p > 0.84 ? (1 - p) / 0.16 : 1,
  };
};

export function poseAt(t) {
  // Layers arrive from beyond their exploded offset rather than fading in,
  // so nothing is ever transparent and no program is ever recompiled.
  const pose = {
    dolly: 1.14 - 0.14 * beat(t, 0, 2.4),
    explode: 1 + 0.4 * (1 - beat(t, 0, 0.55)),
    floor: {
      screed: 1 - beat(t, 0.60, 0.5),
      membrane: 1 - beat(t, 0.82, 0.5),
      adhesive: 1 - beat(t, 1.02, 0.5),
      tiles: 1 - beat(t, 1.24, 0.5),
    },
    back: {
      services: 1 - beat(t, 0.75, 0.5),
      board: 1 - beat(t, 1.10, 0.5),
      tiles: 1 - beat(t, 1.42, 0.5),
    },
    ret: { board: 1 - beat(t, 1.20, 0.5), tiles: 1 - beat(t, 1.50, 0.5) },
    lay: clamp01((t - 1.24) / 0.62),
    fixtures: {
      basin: beat(t, 2.25, 0.36, easeOutBack),
      tap: beat(t, 2.45, 0.36, easeOutBack),
      trap: beat(t, 2.50, 0.36, easeOutBack),
      socket: beat(t, 2.60, 0.36, easeOutBack),
      drain: beat(t, 2.70, 0.36, easeOutBack),
    },
    membraneEmissive: 0.08,
    pipeEmissive: 0.16,
    gold: false,
    flash: [
      Math.max(0, 1 - Math.abs(t - 2.66) / 0.14),
      Math.max(0, 1 - Math.abs(t - 2.81) / 0.14),
      Math.max(0, 1 - Math.abs(t - 2.91) / 0.14),
    ],
    fall: fallAt(t, 3.0),
    swing: 0,
    room: 0,
    next: 0,
    swap: 0,
    outScale: 1,
    inScale: 0,
    bob: 0.006 * Math.sin(2 * Math.PI * 0.13 * t),
    phase: null,
  };

  if (t >= START) {
    const elapsedIdle = t - START;
    const index = Math.floor(elapsedIdle / ROOM_T);
    const tau = elapsedIdle - index * ROOM_T;
    pose.room = index % ROOMS.length;
    pose.next = (index + 1) % ROOMS.length;

    const open = easeInOutCubic(clamp01((tau - HOLD) / OPENING))
      - easeInOutCubic(clamp01((tau - HOLD - OPENING - HELD) / OPENING));
    if (open > 0.02) pose.phase = 'reveal';

    // Rooms alternate which way they open: the wet rooms lift the floor to
    // show the waterproofing, the dry ones swing the wall to show the
    // services. Both are things a customer is paying for and cannot see.
    if (pose.room === 0 || pose.room === 2) {
      pose.floor.tiles = open;
      pose.floor.adhesive = open * 0.72;
      pose.membraneEmissive = 0.08 + 0.18 * open;
      pose.gold = open > 0.4;
      pose.fall = fallAt(tau, HOLD + OPENING + 0.5);
    } else {
      pose.swing = open;
      pose.pipeEmissive = 0.16 + 0.18 * open;
    }

    // The handover. The outgoing fit-out folds away, the tiles fly off and
    // re-lay in the next room's colour, then the new fit-out unfolds.
    const swap = clamp01((tau - SWAP_AT) / SWAP_T);
    if (swap > 0) {
      pose.swap = easeInOutCubic(swap);
      pose.outScale = 1 - easeOutCubic(clamp01(swap / 0.42));
      pose.inScale = easeOutBack(clamp01((swap - 0.52) / 0.48));
      // The tile field lifts and lays itself again, which is the same
      // gesture the room was built with in the first place.
      pose.lay = swap < 0.5
        ? 1 - easeInOutCubic(swap / 0.5)
        : easeOutCubic((swap - 0.5) / 0.5);
      pose.phase = 'swap';
    }
  }
  return pose;
}

/** Not a frozen frame of the loop — no `t` opens both stacks at once. */
export const STATIC_POSE = {
  dolly: 1,
  explode: 1,
  floor: { screed: 0, membrane: 0, adhesive: 0.14, tiles: 0.30 },
  back: { services: 0, board: 0, tiles: 0 },
  ret: { board: 0, tiles: 0 },
  lay: 1,
  fixtures: { basin: 1, tap: 1, trap: 1, socket: 1, drain: 1 },
  membraneEmissive: 0.26,
  pipeEmissive: 0.34,
  gold: true,
  flash: [0, 0, 0],
  fall: { alpha: 0, u: 0, len: 0 },
  swing: 0.55,
  room: 0,
  next: 0,
  swap: 0,
  outScale: 1,
  inScale: 0,
  bob: 0,
  phase: null,
};
