import { useEffect, useRef, useState } from 'react';
// Named imports, not a namespace import: rollup can only tree-shake three when
// it can see exactly which classes are reached.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Clock,
  Color, DoubleSide, EdgesGeometry, Fog, FrontSide, GridHelper,
  Group, LineBasicMaterial, LineLoop, LineSegments, Mesh,
  MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial,
  Scene, Vector3, WebGLRenderer,
} from 'three';

/**
 * A timber frame that erects itself on a blueprint plane under a tower crane,
 * then idles under a slow survey sweep.
 *
 * Two surfaces use it — the dark panel of the login screen and the marketing
 * hero — so it takes a `tone` rather than assuming a dark ground.
 *
 * Three constraints shaped it:
 *   1. It is decoration behind a form, so it never captures a pointer event and
 *      never runs while the tab is hidden or reduced motion is asked for.
 *   2. Colours are read from the same CSS variables the rest of the app uses,
 *      so a theme toggle repaints the scene instead of stranding it.
 *   3. Everything is lines and additive fills — no lights, no shadows, no
 *      textures. The whole frame is one draw pass and holds 60fps on a phone.
 */

/** Bottom-up build order: a member cannot appear before the one it rests on. */
const STAGE_DELAY = 0.3;

// Two generous storeys read as a house; three read as a tower.
const STOREYS = 2;
const W = 2.1;        // half-width  (x)
const D = 1.6;        // half-depth  (z)
const H = 1.35;       // storey height
const SLAB = 0.14;    // thickness of the ground beam the posts start from
const PARAPET = 0.5;  // upstand around the flat roof
const BALCONY = 0.85; // how far the first-floor terrace projects at the front

const TOP = STOREYS * H + SLAB;   // the roof slab
const HEIGHT = TOP + PARAPET;     // the coping, i.e. the top of the house

// The crane stands off the building's -x corner and overhangs it, the way a
// tower crane actually serves a site.
const MAST_X = -3.6;
const MAST_Z = -1.0;
const MAST_H = 6.6;   // the crane is the hero of the panel, so it towers
const CATHEAD = 1.4;  // the A-frame above the slewing ring
const JIB_F = 5.2;    // working jib, reaching out over the building
const JIB_B = 2.1;    // counter jib, carrying the ballast
const SWAY = 0.4;     // radians the jib swings either side of centre

/**
 * The house builds, is held, collapses, and builds again — the crane stays up
 * throughout, working. All house timing is measured against `u = t % CYCLE`;
 * everything that establishes once (crane, ground, site, city) stays on `t`.
 */
const BUILD_START = 0.55;   // the plot is set out before anything lands on it
const GROW = 0.72;          // one member's extrusion
const FALL_STAGGER = 0.11;  // between stages on the way down
const FALL = 0.62;          // one member's retraction
const GAP = 1.1;            // empty plot before the next build starts

/** Centre and radius of the sphere the camera frames. The site fence and the
 *  skyline deliberately fall outside it and bleed off the panel edges. */
const CENTRE = new Vector3(-1.35, 3.4, 0);
const FIT_RADIUS = 5.95;

/**
 * The house, described as beams in metres. `stage` orders the erection and
 * `axis` is the direction a member grows from its supported end. Origin is the
 * centre of the slab, +Y is up.
 *
 * It is deliberately a home rather than a block: a projecting terrace, a gable,
 * and glazing that lands last, so the frame resolves into something lived-in.
 */
function house() {
  const members = [];
  const post = 0.11;
  const beam = 0.13;
  const columnsX = [-W, 0, W];
  const columnsZ = [-D, D];
  const add = (m) => members.push(m);

  // Stage 0 — the slab edge, drawn as four ground beams.
  add({ stage: 0, size: [W * 2, SLAB, beam], pos: [0, SLAB / 2, -D], axis: 'x' });
  add({ stage: 0, size: [W * 2, SLAB, beam], pos: [0, SLAB / 2, D], axis: 'x' });
  add({ stage: 0, size: [beam, SLAB, D * 2], pos: [-W, SLAB / 2, 0], axis: 'z' });
  add({ stage: 0, size: [beam, SLAB, D * 2], pos: [W, SLAB / 2, 0], axis: 'z' });

  // Each storey is two stages: the posts go up, then the deck that closes them.
  for (let storey = 0; storey < STOREYS; storey += 1) {
    const base = SLAB + storey * H;
    for (const x of columnsX) {
      for (const z of columnsZ) {
        add({ stage: storey * 2 + 1, size: [post, H, post], pos: [x, base + H / 2, z], axis: 'y' });
      }
    }

    const y = base + H;
    const deck = storey * 2 + 2;
    add({ stage: deck, size: [W * 2, beam, beam], pos: [0, y, -D], axis: 'x' });
    add({ stage: deck, size: [W * 2, beam, beam], pos: [0, y, D], axis: 'x' });
    for (const x of columnsX) {
      add({ stage: deck, size: [beam, beam, D * 2], pos: [x, y, 0], axis: 'z' });
    }
    // Joists spanning the short way, thinner than the beams carrying them.
    for (const i of [-2, -1, 1, 2]) {
      add({ stage: deck, size: [0.07, 0.09, D * 2], pos: [(i * W) / 3, y - 0.02, 0], axis: 'z' });
    }
  }

  // The first-floor terrace. This is the single detail that most makes the
  // frame read as somebody's home rather than a structure.
  const terrace = STOREYS * 2 + 1;
  const lip = D + BALCONY;
  const deckY = SLAB + H;
  add({ stage: terrace, size: [W * 1.5, 0.1, 0.1], pos: [0, deckY, lip], axis: 'x' });
  add({ stage: terrace, size: [W * 1.5, 0.05, 0.05], pos: [0, deckY + 0.5, lip], axis: 'x' });
  for (const x of [-W * 0.75, 0, W * 0.75]) {
    add({ stage: terrace, size: [0.08, 0.08, BALCONY], pos: [x, deckY, D + BALCONY / 2], axis: 'z' });
    add({ stage: terrace, size: [0.06, 0.5, 0.06], pos: [x, deckY + 0.25, lip], axis: 'y' });
  }

  // A flat roof with a parapet, which is what a modern house here actually has.
  // The top storey's deck already is the slab, so this stage is the upstand
  // around it plus the two things that always end up on a Nepali roof.
  const roofStage = terrace + 1;
  for (const z of columnsZ) {
    add({ stage: roofStage, size: [W * 2, 0.1, 0.1], pos: [0, HEIGHT, z], axis: 'x' });
  }
  for (const x of [-W, W]) {
    add({ stage: roofStage, size: [0.1, 0.1, D * 2], pos: [x, HEIGHT, 0], axis: 'z' });
  }
  for (const x of columnsX) {
    for (const z of columnsZ) {
      add({ stage: roofStage, size: [0.07, PARAPET, 0.07], pos: [x, TOP + PARAPET / 2, z], axis: 'y' });
    }
  }

  // The stair head, and the water tank on its stand.
  add({ stage: roofStage, size: [W * 0.62, 0.62, D * 0.55], pos: [-W * 0.55, TOP + 0.31, -D * 0.45], axis: 'y' });
  for (const dx of [-0.2, 0.2]) {
    for (const dz of [-0.16, 0.16]) {
      add({ stage: roofStage, size: [0.04, 0.34, 0.04], pos: [W * 0.55 + dx, TOP + 0.17, D * 0.4 + dz], axis: 'y' });
    }
  }
  add({ stage: roofStage, size: [0.52, 0.4, 0.44], pos: [W * 0.55, TOP + 0.54, D * 0.4], axis: 'y' });

  // ---- infill ---------------------------------------------------------------
  // Filled panels land after the structure: glazing, then roofing. These are
  // what turn a frame into a house, so they finish the sequence.
  // Walls land first, then glazing reads as openings cut into them, then the
  // roof deck closes the top.
  const wall = roofStage + 1;
  const glass = wall + 1;
  const roof = glass + 1;

  // One panel per face per storey, sitting a hair outside the posts so the
  // structure still reads through them. Plus the four parapet faces.
  const wallPanels = [
    // The terrace floor, laid flat, so the balcony reads as a surface you could
    // stand on rather than an outline.
    {
      kind: 'terrace', stage: wall, w: W * 1.5, h: BALCONY,
      pos: [0, SLAB + H + 0.06, D + BALCONY / 2], rot: [-Math.PI / 2, 0, 0],
    },
  ];
  const faces = [
    { rot: [0, 0, 0], at: [0, 0, D + 0.012], w: W * 2 },
    { rot: [0, Math.PI, 0], at: [0, 0, -D - 0.012], w: W * 2 },
    { rot: [0, Math.PI / 2, 0], at: [W + 0.012, 0, 0], w: D * 2 },
    { rot: [0, -Math.PI / 2, 0], at: [-W - 0.012, 0, 0], w: D * 2 },
  ];
  for (let storey = 0; storey < STOREYS; storey += 1) {
    const cy = SLAB + storey * H + H / 2;
    for (const f of faces) {
      wallPanels.push({ kind: 'wall', stage: wall, w: f.w, h: H, pos: [f.at[0], cy, f.at[2]], rot: f.rot });
    }
  }
  for (const f of faces) {
    wallPanels.push({
      kind: 'trim', stage: wall, w: f.w, h: PARAPET,
      pos: [f.at[0], TOP + PARAPET / 2, f.at[2]], rot: f.rot,
    });
  }
  const panels = [
    ...wallPanels,
    // Full-height glazing across the first floor front — the modern gesture.
    { kind: 'glass', stage: glass, w: W * 0.82, h: H * 0.66, pos: [-W / 2, SLAB + H * 1.5, D + 0.02], rot: [0, 0, 0] },
    { kind: 'glass', stage: glass, w: W * 0.82, h: H * 0.66, pos: [W / 2, SLAB + H * 1.5, D + 0.02], rot: [0, 0, 0] },
    // Ground floor: a wide window, and a door-height opening beside it.
    { kind: 'glass', stage: glass, w: W * 0.76, h: H * 0.46, pos: [-W / 2, SLAB + H * 0.6, D + 0.02], rot: [0, 0, 0] },
    { kind: 'glass', stage: glass, w: W * 0.38, h: H * 0.76, pos: [W * 0.6, SLAB + H * 0.42, D + 0.02], rot: [0, 0, 0] },
    // A return on the gable end, so the house is not just a flat façade.
    { kind: 'glass', stage: glass, w: D * 0.85, h: H * 0.6, pos: [W + 0.02, SLAB + H * 1.5, 0], rot: [0, Math.PI / 2, 0] },
    // The roof deck itself: one horizontal slab, laid inside the parapet.
    { kind: 'roof', stage: roof, w: W * 2, h: D * 2, pos: [0, TOP + 0.02, 0], rot: [-Math.PI / 2, 0, 0] },
  ];

  return {
    members, panels, goldFrom: roofStage, terraceStage: terrace,
    wallStage: wall, glassStage: glass, deckStage: roof,
  };
}

/**
 * The site around the house, as one flat position array: the hoarding that
 * fences the plot, two stacks of blocks waiting to go up, and a scaffold run
 * against the gable end. Static — it is context, not action.
 */
function sitePositions() {
  const out = [];
  const fx = W + 2.5;
  const fz = D + 2.1;

  // Hoarding: a rail at head height on posts, all the way round the plot.
  const corners = [[-fx, -fz], [fx, -fz], [fx, fz], [-fx, fz]];
  corners.forEach(([x, z], i) => {
    const [nx, nz] = corners[(i + 1) % 4];
    seg(out, x, 0.62, z, nx, 0.62, nz);
    seg(out, x, 0.3, z, nx, 0.3, nz);
    const spans = 5;
    for (let k = 0; k <= spans; k += 1) {
      const px = x + ((nx - x) * k) / spans;
      const pz = z + ((nz - z) * k) / spans;
      seg(out, px, 0, pz, px, 0.72, pz);
    }
  });

  // Two stacks of blocks, set down inside the hoarding.
  const stack = (ox, oz, rows) => {
    const bw = 0.62; const bd = 0.42; const bh = 0.16;
    for (let r = 0; r < rows; r += 1) {
      const y = r * bh;
      const box = [[ox, oz], [ox + bw, oz], [ox + bw, oz + bd], [ox, oz + bd]];
      box.forEach(([x, z], i) => {
        const [nx, nz] = box[(i + 1) % 4];
        seg(out, x, y, z, nx, y, nz);
        seg(out, x, y, z, x, y + bh, z);
      });
    }
  };
  stack(-W - 1.6, D + 0.5, 5);
  stack(W + 0.9, -D - 1.4, 3);

  // Scaffold against the gable end: standards, ledgers, and a plank lift.
  const sx = W + 0.62;
  const lifts = 4;
  const ledger = (TOP + 0.4) / lifts;
  for (const z of [-D, 0, D]) seg(out, sx, 0, z, sx, TOP + 0.4, z);
  for (let l = 1; l <= lifts; l += 1) {
    const y = l * ledger;
    seg(out, sx, y, -D, sx, y, D);
    // Alternating diagonal brace, the way a real run is stiffened.
    const a = l % 2 ? -D : D;
    const b = l % 2 ? D : -D;
    seg(out, sx, y - ledger, a, sx, y, b);
  }
  for (const l of [2, 4]) {
    const y = l * ledger;
    seg(out, sx - 0.3, y, -D, sx - 0.3, y, D);
    seg(out, sx - 0.3, y, -D, sx, y, -D);
    seg(out, sx - 0.3, y, D, sx, y, D);
  }

  return out;
}

/**
 * A city behind the site: plain blocks, far enough back that the fog does most
 * of the drawing. Deterministic so the composition does not change per load.
 */
function skylinePositions() {
  const out = [];
  // [x, z, halfWidth, halfDepth, storeys] — a fixed table rather than random,
  // so the city is the same on every load and across every cycle.
  const blocks = [
    [-17, -15, 1.8, 1.5, 5], [-9.5, -19, 1.5, 1.4, 8], [-1.5, -22, 2.1, 1.6, 4],
    [6.5, -18, 1.6, 1.5, 6], [14, -21, 1.9, 1.5, 5], [21, -16, 1.5, 1.4, 8],
    [-22, -11, 1.6, 1.4, 4], [10, -27, 2.2, 1.8, 7],
  ];
  const storey = 0.85;
  for (const [x, z, hw, hd, n] of blocks) {
    const corners = [[x - hw, z - hd], [x + hw, z - hd], [x + hw, z + hd], [x - hw, z + hd]];
    for (const [cx, cz] of corners) seg(out, cx, 0, cz, cx, n * storey, cz);
    seg(out, x, 0, z, x, n * storey, z);   // an interior column, for depth
    for (let f = 1; f <= n; f += 1) {
      const y = f * storey;
      corners.forEach(([ax, az], i) => {
        const [bx, bz] = corners[(i + 1) % 4];
        seg(out, ax, y, az, bx, y, bz);
      });
    }
  }
  return out;
}

/** Pushes one segment (a pair of points) onto a flat position array. */
const seg = (out, ax, ay, az, bx, by, bz) => out.push(ax, ay, az, bx, by, bz);

/** The four corners of a square lattice section, in order, so a ring closes. */
const section = (r) => [[-r, -r], [r, -r], [r, r], [-r, r]];

/**
 * The mast: four legs with a ring and a diagonal brace at every panel point.
 * Drawn from the ground up so it can be extruded by scaling in Y.
 */
function mastPositions() {
  const out = [];
  const r = 0.26;
  const panel = 0.72;
  const corners = section(r);

  // Ballast base: the crane has to be standing on something.
  const b = r * 2.6;
  const base = section(b);
  base.forEach(([x, z], i) => {
    const [nx, nz] = base[(i + 1) % 4];
    seg(out, x, 0, z, nx, 0, nz);
    seg(out, x, 0.34, z, nx, 0.34, nz);
    seg(out, x, 0, z, x, 0.34, z);
  });
  corners.forEach(([x, z], i) => seg(out, x, 0.34, z, base[i][0], 0.34, base[i][1]));

  for (const [x, z] of corners) seg(out, x, 0, z, x, MAST_H, z);

  for (let y = panel; y <= MAST_H + 0.001; y += panel) {
    for (let i = 0; i < 4; i += 1) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      seg(out, ax, y, az, bx, y, bz);            // ring
      seg(out, ax, y - panel, az, bx, y, bz);    // brace
    }
  }

  // Climbing ladder up one face — the detail that gives the mast a scale.
  for (let y = 0.3; y < MAST_H; y += 0.3) {
    seg(out, -r * 0.45, y, -r, r * 0.45, y, -r);
  }
  seg(out, -r * 0.45, 0.3, -r, -r * 0.45, MAST_H, -r);
  seg(out, r * 0.45, 0.3, -r, r * 0.45, MAST_H, -r);

  // Slewing collar: the ring the whole head turns on.
  const collar = section(r * 1.25);
  collar.forEach(([x, z], i) => {
    const [nx, nz] = collar[(i + 1) % 4];
    seg(out, x, MAST_H - 0.16, z, nx, MAST_H - 0.16, nz);
    seg(out, x, MAST_H, z, nx, MAST_H, nz);
    seg(out, x, MAST_H - 0.16, z, x, MAST_H, z);
  });

  return out;
}

/**
 * The jib, in the rotating head's own space with the mast top at the origin:
 * two top rails, a bottom chord, the pendant A-frame, and the ballast crate.
 */
function jibPositions() {
  const out = [];
  const d = 0.3;         // half the truss width
  const drop = 0.5;      // depth of the truss below the rails
  const tip = 0.12;      // the jib tapers to almost nothing at the tip

  seg(out, -JIB_B, 0, -d, JIB_F, 0, -d);
  seg(out, -JIB_B, 0, d, JIB_F, 0, d);
  seg(out, -JIB_B, -drop, 0, JIB_F - 0.5, -drop, 0);
  // The bottom chord rises to meet the rails at the tip.
  seg(out, JIB_F - 0.5, -drop, 0, JIB_F, -tip, 0);
  seg(out, JIB_F, -tip, 0, JIB_F, 0, -d);
  seg(out, JIB_F, -tip, 0, JIB_F, 0, d);

  // Warren bracing: each panel point drops to the chord and climbs back.
  const step = 0.65;
  for (let x = -JIB_B; x < JIB_F - 0.5; x += step) {
    const next = Math.min(x + step, JIB_F - 0.5);
    seg(out, x, 0, -d, next, -drop, 0);
    seg(out, x, 0, d, next, -drop, 0);
    seg(out, next, 0, -d, next, 0, d);
  }

  // Cathead: the A-frame the pendant ties hang from. Two legs, a spine, and
  // ties running out to the jib and back to the counter jib.
  seg(out, 0, 0, -d, 0, CATHEAD, 0);
  seg(out, 0, 0, d, 0, CATHEAD, 0);
  seg(out, -0.4, 0, 0, 0, CATHEAD, 0);
  seg(out, 0.4, 0, 0, 0, CATHEAD, 0);
  for (let y = 0.35; y < CATHEAD; y += 0.35) {
    seg(out, -0.3 * (1 - y / CATHEAD), y, 0, 0.3 * (1 - y / CATHEAD), y, 0);
  }
  // Pendants: two forward ties and one back, which is what actually holds a
  // tower crane's jib up.
  seg(out, 0, CATHEAD, 0, JIB_F * 0.5, 0, 0);
  seg(out, 0, CATHEAD, 0, JIB_F * 0.88, 0, 0);
  seg(out, 0, CATHEAD, 0, -JIB_B + 0.15, 0, 0);

  // Operator cab, slung under the slewing ring at the front of the head.
  const cab = [[0.34, -0.28], [0.86, -0.28], [0.86, 0.28], [0.34, 0.28]];
  cab.forEach(([x, z], i) => {
    const [nx, nz] = cab[(i + 1) % 4];
    seg(out, x, -drop - 0.05, z, nx, -drop - 0.05, nz);
    seg(out, x, -drop - 0.05, z, x, -0.05, z);
    seg(out, x, -0.05, z, nx, -0.05, nz);
  });

  // Ballast crate on the counter jib.
  const y0 = -drop - 0.12;
  const crate = [
    [-JIB_B + 0.12, y0, -0.4], [-JIB_B + 0.95, y0, -0.4],
    [-JIB_B + 0.95, y0, 0.4], [-JIB_B + 0.12, y0, 0.4],
  ];
  crate.forEach(([x, y, z], i) => {
    const [nx, ny, nz] = crate[(i + 1) % 4];
    seg(out, x, y, z, nx, ny, nz);                       // base
    seg(out, x, y, z, x, y + 0.5, z);                    // upright
    seg(out, x, y + 0.5, z, nx, ny + 0.5, nz);           // top
  });

  return out;
}

/**
 * A setting-out dimension: the witness line a drawing carries under an
 * elevation, with a tick at each end. Purely graphic, and static.
 */
function dimensionPositions() {
  const out = [];
  const z = D + 1.15;
  seg(out, -W, 0, z, W, 0, z);
  for (const x of [-W, W]) {
    seg(out, x, -0.16, z, x, 0.16, z);   // tick
    seg(out, x, 0, D + 0.5, x, 0, z);    // witness line back to the slab
  }
  return out;
}

/**
 * What the frame is drawn on. The login panel is dark and the marketing hero is
 * light, so the structure cannot take its colour from one fixed variable: `line`
 * and `fog` name the variables to read, and the opacities are what those colours
 * need on that ground to carry the same weight.
 */
const TONES = {
  ink: {
    line: '--ink-foreground', lineFallback: '#f0ece3',
    fog: '--ink', fogFallback: '#0a1418',
    grid: 0.11, edge: 0.55, fill: 0.07, dust: 0.4, footprint: 0.5,
    wall: 0.95, wallEdge: 0.3, cream: '#c6ccb4', creamMix: 0.55,
  },
  paper: {
    line: '--primary', lineFallback: '#154c59',
    fog: '--background', fogFallback: '#faf8f5',
    grid: 0.16, edge: 0.42, fill: 0.04, dust: 0.22, footprint: 0.38,
    wall: 0.92, wallEdge: 0.28, cream: '#b3bb9c', creamMix: 0.5,
  },
};

/** `--gold: 34 58% 45%` → a Color. Falls back if the variable is missing. */
function cssColor(styles, name, fallback) {
  const raw = styles.getPropertyValue(name).trim();
  const [h, s, l] = raw.split(/[\s/]+/);
  if (!h || !s || !l) return new Color(fallback);
  return new Color().setHSL(parseFloat(h) / 360, parseFloat(s) / 100, parseFloat(l) / 100);
}

/**
 * The finish palette. Structure cures from its drawing colour to concrete, then
 * the walls are painted: a cream body with a clay band at the parapet. Unlike
 * every other colour in this file these are literals, because they are the
 * colour of the thing being depicted — a painted wall does not change hue when
 * the operator switches the app to dark mode.
 */
const CONCRETE = new Color('#6e747a');
const CLAY = new Color('#B47368');
/** The terrace deck and its railing — a warmer, deeper relative of the clay. */
const TIMBER = new Color('#6b4c3e');
/** The roof deck, read as a screeded terrace rather than bare structure. */
const DECK = new Color('#474e54');
// Glazing has to read as an opening cut into a pale wall, so it is darker than
// the wall rather than lighter — the opposite of what works on a wireframe.
const GLASS = new Color('#22405f');

/** Where the camera sits, as a unit direction out from CENTRE. */
const VIEW = new Vector3(0.5, 0.38, 0.78).normalize();

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {boolean} [props.reduced] Render one finished frame and stop.
 */
export function BlueprintScene({ className, reduced = false, tone = 'ink' }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);           // No WebGL — the CSS blueprint underneath carries the panel.
      return undefined;
    }

    const T = TONES[tone] ?? TONES.ink;
    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      // A cream-green: the theme's primary, let down toward a warm cream. Mixed
      // here rather than hardcoded so the finished house carries the brand hue.
      const primary = cssColor(styles, '--primary', '#154c59');
      return {
        cream: primary.clone().lerp(new Color(T.cream), T.creamMix),
        gold: cssColor(styles, '--gold', '#c08a3e'),
        line: cssColor(styles, T.line, T.lineFallback),
        deep: cssColor(styles, T.fog, T.fogFallback),
      };
    };
    const { gold, line, deep, cream } = readPalette();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    // Fog does the work a vignette would: the grid dissolves instead of ending.
    scene.fog = new Fog(deep, 12, 40);

    const camera = new PerspectiveCamera(38, 1, 0.1, 120);

    const world = new Group();
    scene.add(world);

    // ---- ground -------------------------------------------------------------
    const grid = new GridHelper(64, 64, line, line);
    grid.material.vertexColors = false;
    grid.material.color = line.clone();
    grid.material.transparent = true;
    grid.material.opacity = T.grid;
    grid.material.fog = true;
    world.add(grid);

    // A brighter setting-out square marks the footprint the frame stands on.
    const { members, panels, goldFrom, terraceStage, wallStage, glassStage, deckStage } = house();
    const footprint = new LineLoop(
      new BufferGeometry().setFromPoints([
        new Vector3(-W - 0.4, 0.01, -D - 0.4),
        new Vector3(W + 0.4, 0.01, -D - 0.4),
        new Vector3(W + 0.4, 0.01, D + 0.4),
        new Vector3(-W - 0.4, 0.01, D + 0.4),
      ]),
      new LineBasicMaterial({ color: gold, transparent: true, opacity: T.footprint }),
    );
    world.add(footprint);

    // ---- frame --------------------------------------------------------------
    // One shared geometry, scaled per member: 40-odd beams stay a handful of
    // draw calls instead of forty distinct buffers.
    const unitBox = new BoxGeometry(1, 1, 1);
    const unitEdges = new EdgesGeometry(unitBox);
    const fillMaterial = new MeshBasicMaterial({
      color: line, transparent: true, opacity: T.fill, depthWrite: false,
    });
    const edgeMaterial = new LineBasicMaterial({ color: line, transparent: true, opacity: T.edge });
    // The terrace is picked out from the frame, so it can be finished in timber
    // while the structure around it stays concrete.
    const terraceEdge = new LineBasicMaterial({ color: line, transparent: true, opacity: T.edge });
    const goldEdgeMaterial = new LineBasicMaterial({ color: gold, transparent: true, opacity: 0.95 });

    const frame = new Group();
    world.add(frame);

    // ---- the cycle ------------------------------------------------------------
    // One pass of a real build, in order: the crane raises the skeleton, the site
    // pauses, the crane withdraws, the concrete cures grey, the walls go up raw,
    // and only then are they painted. Every phase is derived from the one before
    // it, so retiming a single beat cannot silently overlap the next.
    const LAST_STAGE = deckStage;
    const SKELETON_END = BUILD_START + goldFrom * STAGE_DELAY + GROW;
    const BREAK_END = SKELETON_END + 1.0;    // the pause, with the crane still up
    const CRANE_OUT = BREAK_END;             // the crane starts to leave
    const CRANE_GONE = CRANE_OUT + 1.4;
    const CURE_AT = CRANE_OUT + 0.5;         // concrete greys as the crane goes
    const CURE_FOR = 1.3;
    const CURE_END = CURE_AT + CURE_FOR;
    // The frame stands finished in grey concrete for a beat before anything is
    // clad — the same pause a real site takes while the pour goes off.
    const WALLS_AT = CURE_END + 0.9;
    const WALLS_FOR = 1.2;
    const PAINT_AT = WALLS_AT + WALLS_FOR;
    const PAINT_FOR = 1.9;
    const PAINT_END = PAINT_AT + PAINT_FOR;
    const BUILD_END = PAINT_END;
    // Then the house is handed over: a break, a slow push in on the finished
    // thing, and a pull back out before the plot is cleared again.
    const FOCUS_AT = PAINT_END + 0.9;
    const FOCUS_IN = 1.3;
    const FOCUS_HOLD = 1.1;
    const FOCUS_OUT = 1.1;
    const COLLAPSE_AT = FOCUS_AT + FOCUS_IN + FOCUS_HOLD + FOCUS_OUT;
    const CYCLE = COLLAPSE_AT + LAST_STAGE * FALL_STAGGER + FALL + GAP;

    /** Smooth 0..1 ramp over [at, at+dur]. */
    const ramp = (u, at, dur) => {
      const k = Math.min(1, Math.max(0, (u - at) / dur));
      return k * k * (3 - 2 * k);   // smoothstep
    };
    /** How far the collapse has eaten into a given stage, 0..1. */
    const unbuild = (u, stage) => {
      const k = Math.min(1, Math.max(0, (u - COLLAPSE_AT - (LAST_STAGE - stage) * FALL_STAGGER) / FALL));
      return k * k * k;             // ease-in cubic: it lets go, then goes
    };

    const built = members.map((m) => {
      // Members grow from the end that is already supported, so a post rises off
      // its slab and a beam runs out from its start rather than swelling in place.
      // The pivot sits at that supported end; the mesh sits a half-length out
      // along the member, so scaling the group between them extrudes it.
      const axisIndex = { x: 0, y: 1, z: 2 }[m.axis];
      const offset = new Vector3().setComponent(axisIndex, m.size[axisIndex] / 2);

      const pivot = new Group();
      if (m.rot) pivot.rotation.set(...m.rot);
      pivot.position
        .set(...m.pos)
        .sub(offset.clone().applyEuler(pivot.rotation));

      const inner = new Group();

      const mesh = new Mesh(unitBox, fillMaterial);
      mesh.scale.set(...m.size);
      mesh.position.copy(offset);
      inner.add(mesh);

      const structural = m.stage === terraceStage
        ? terraceEdge
        : (m.stage >= goldFrom ? goldEdgeMaterial : edgeMaterial);
      const edges = new LineSegments(unitEdges, structural);
      edges.scale.set(...m.size);
      edges.position.copy(offset);
      inner.add(edges);

      pivot.add(inner);
      frame.add(pivot);

      return { inner, axis: m.axis, stage: m.stage, jitter: Math.random() * 0.18 };
    });

    // ---- infill ---------------------------------------------------------------
    // Glazing and roofing, added on the same shared unit plane. One material per
    // kind, so a whole stage fades in together with a single opacity to drive.
    const unitPlane = new PlaneGeometry(1, 1);
    const unitPlaneEdges = new EdgesGeometry(unitPlane);
    // Walls take the brass token rather than a new hex, so they read as a warm
    // finished surface in the dark panel and on the light marketing ground alike.
    const wallBody = new MeshBasicMaterial({
      color: CONCRETE.clone(), transparent: true, opacity: 0, side: FrontSide, depthWrite: false,
    });
    const wallTrim = new MeshBasicMaterial({
      color: CONCRETE.clone(), transparent: true, opacity: 0, side: FrontSide, depthWrite: false,
    });
    const terraceMaterial = new MeshBasicMaterial({
      color: CONCRETE.clone(), transparent: true, opacity: 0, side: DoubleSide, depthWrite: false,
    });
    const wallEdge = new LineBasicMaterial({ color: gold, transparent: true, opacity: 0 });
    const glassMaterial = new MeshBasicMaterial({
      color: GLASS, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false,
    });
    const glassEdge = new LineBasicMaterial({ color: gold, transparent: true, opacity: 0 });
    const roofMaterial = new MeshBasicMaterial({
      color: gold, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false,
    });
    const roofEdge = new LineBasicMaterial({ color: gold, transparent: true, opacity: 0 });

    const PANEL_MATERIALS = {
      wall: [wallBody, wallEdge, 1],
      trim: [wallTrim, wallEdge, 1],
      terrace: [terraceMaterial, wallEdge, 1],
      glass: [glassMaterial, glassEdge, 2],
      roof: [roofMaterial, roofEdge, 1],
    };

    for (const panel of panels) {
      const [fillMat, edgeMat, order] = PANEL_MATERIALS[panel.kind];
      const holder = new Group();
      holder.position.set(...panel.pos);
      holder.rotation.set(...panel.rot);

      const fill = new Mesh(unitPlane, fillMat);
      fill.scale.set(panel.w, panel.h, 1);
      fill.renderOrder = order;
      holder.add(fill);

      const outline = new LineSegments(unitPlaneEdges, edgeMat);
      outline.scale.set(panel.w, panel.h, 1);
      outline.renderOrder = order + 2;
      holder.add(outline);

      frame.add(holder);
    }

    // ---- crane --------------------------------------------------------------
    // Its own group so the whole rig can be extruded upward on erection, and so
    // the head can sway without moving the mast.
    const lineGeometry = (positions) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
      return g;
    };

    const crane = new Group();
    crane.position.set(MAST_X, 0, MAST_Z);
    world.add(crane);

    const craneMaterial = new LineBasicMaterial({ color: line, transparent: true, opacity: 0.42 });
    const mastLift = new Group();
    mastLift.add(new LineSegments(lineGeometry(mastPositions()), craneMaterial));
    crane.add(mastLift);

    const head = new Group();
    head.position.y = MAST_H;
    crane.add(head);
    head.add(new LineSegments(lineGeometry(jibPositions()), craneMaterial));

    // The hoist: a rope from the trolley down to a hook block, both of which
    // move, so the rope geometry is rewritten each frame rather than scaled.
    const hoistPositions = new Float32Array(6);
    const hoistGeometry = new BufferGeometry();
    hoistGeometry.setAttribute('position', new BufferAttribute(hoistPositions, 3));
    const hoist = new LineSegments(
      hoistGeometry,
      new LineBasicMaterial({ color: gold, transparent: true, opacity: 0.6 }),
    );
    head.add(hoist);

    const hookMaterial = new LineBasicMaterial({ color: gold, transparent: true, opacity: 0.95 });
    const hook = new LineSegments(unitEdges, hookMaterial);
    hook.scale.set(0.3, 0.22, 0.3);
    head.add(hook);

    const dimension = new LineSegments(
      lineGeometry(dimensionPositions()),
      new LineBasicMaterial({ color: gold, transparent: true, opacity: 0 }),
    );
    world.add(dimension);

    // ---- site -----------------------------------------------------------------
    // Context around the plot. It is background, so it sits at a lower opacity
    // than the house and is allowed to run off the edges of the panel.
    const siteMaterial = new LineBasicMaterial({ color: line, transparent: true, opacity: 0 });
    const site = new LineSegments(lineGeometry(sitePositions()), siteMaterial);
    world.add(site);

    const skylineMaterial = new LineBasicMaterial({ color: line, transparent: true, opacity: 0 });
    const skyline = new LineSegments(lineGeometry(skylinePositions()), skylineMaterial);
    world.add(skyline);

    // ---- survey sweep -------------------------------------------------------
    // A level line that climbs the frame, the way a laser level is run up a build.
    const sweep = new Mesh(
      new PlaneGeometry(W * 2.8, 0.05),
      new MeshBasicMaterial({
        color: gold, transparent: true, opacity: 0, blending: AdditiveBlending,
        side: DoubleSide, depthWrite: false, fog: false,
      }),
    );
    sweep.rotation.x = -Math.PI / 2;
    const sweepRing = new LineLoop(
      new BufferGeometry().setFromPoints([
        new Vector3(-W - 0.3, 0, -D - 0.3),
        new Vector3(W + 0.3, 0, -D - 0.3),
        new Vector3(W + 0.3, 0, D + 0.3),
        new Vector3(-W - 0.3, 0, D + 0.3),
      ]),
      new LineBasicMaterial({ color: gold, transparent: true, opacity: 0, fog: false }),
    );
    world.add(sweep, sweepRing);

    // ---- dust ---------------------------------------------------------------
    // Declared here because the theme repaint below needs it too: under reduced
    // motion there is no loop, so anything that changes must re-render by hand.
    let staticRedraw = null;
    // The camera's fitted distance, owned by resize(); draw() only scales it, so
    // resizing mid-focus still frames the scene correctly.
    let fitDistance = 20;
    const camAim = new Vector3();
    // What the push-in settles on: the house, not the composed centre, because
    // the crane has left the frame by the time it happens.
    const HOUSE = new Vector3(0, HEIGHT * 0.52, 0);

    const DUST = 90;
    const dustPositions = new Float32Array(DUST * 3);
    const dustSpeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i += 1) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 18;
      dustPositions[i * 3 + 1] = Math.random() * 8;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      dustSpeed[i] = 0.08 + Math.random() * 0.16;
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
    const dustMaterial = new PointsMaterial({
      color: line, size: 0.035, transparent: true, opacity: T.dust,
      sizeAttenuation: true, depthWrite: false,
    });
    world.add(new Points(dustGeometry, dustMaterial));

    // ---- theme ---------------------------------------------------------------
    // Toggling the theme swaps the CSS variables under us. Repaint the materials
    // in place rather than rebuilding the scene, so the build sequence is not
    // replayed and nothing flashes.
    // draw() tints these every frame, so the repaint stores the untinted values
    // here and draw() lerps out of them. Writing straight to material.color
    // would be overwritten on the next frame.
    const base = { line: line.clone(), gold: gold.clone(), cream: cream.clone() };

    const paint = () => {
      const next = readPalette();
      base.line.copy(next.line);
      base.gold.copy(next.gold);
      base.cream.copy(next.cream);
      grid.material.color.copy(next.line);
      fillMaterial.color.copy(next.line);
      edgeMaterial.color.copy(next.line);
      dustMaterial.color.copy(next.line);
      craneMaterial.color.copy(next.line);
      hoist.material.color.copy(next.gold);
      hookMaterial.color.copy(next.gold);
      dimension.material.color.copy(next.gold);
      siteMaterial.color.copy(next.line);
      skylineMaterial.color.copy(next.line);
      wallEdge.color.copy(next.gold);
      terraceEdge.color.copy(next.line);
      glassEdge.color.copy(next.gold);
      roofEdge.color.copy(next.gold);
      footprint.material.color.copy(next.gold);
      goldEdgeMaterial.color.copy(next.gold);
      sweep.material.color.copy(next.gold);
      sweepRing.material.color.copy(next.gold);
      scene.fog.color.copy(next.deep);
      if (staticRedraw) staticRedraw();
    };
    const themeWatcher = new MutationObserver(paint);
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // ---- sizing -------------------------------------------------------------
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Distance that fits FIT_RADIUS in *both* axes. A tall narrow panel is
      // constrained horizontally, a wide one vertically — take whichever is
      // tighter, or the frame runs off the edge.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      fitDistance = FIT_RADIUS / Math.sin(Math.min(vFov, hFov) / 2);
      const distance = fitDistance;

      // A three-quarter view, held at whatever distance the fit asks for.
      camera.position.copy(VIEW).multiplyScalar(distance).add(CENTRE);
      camera.lookAt(CENTRE);
      if (staticRedraw) staticRedraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // ---- pointer parallax ---------------------------------------------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (e) => {
      const r = host.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onPointerLeave = () => { pointer.tx = 0; pointer.ty = 0; };
    if (!reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      host.addEventListener('pointerleave', onPointerLeave);
    }

    // ---- loop ---------------------------------------------------------------
    const clock = new Clock();
    let raf = 0;

    const draw = (t) => {
      // The house lives on a cycle; everything that establishes once — the
      // crane, the ground, the site, the city — stays on absolute time.
      const u = t % CYCLE;

      for (const b of built) {
        const up = Math.min(1, Math.max(0, (u - BUILD_START - b.stage * STAGE_DELAY - b.jitter) / GROW));
        const presence = (up <= 0 ? 0 : easeOutBack(up)) * (1 - unbuild(u, b.stage));
        b.inner.scale.setScalar(1);
        b.inner.scale[b.axis] = Math.max(0.0001, presence);
        b.inner.visible = presence > 0.001;
      }

      // The concrete cures: the drawing colours give way to grey once the crane
      // has done its work. The gold parapet greys with everything else and is
      // painted clay a beat later.
      const cured = ramp(u, CURE_AT, CURE_FOR);
      edgeMaterial.color.copy(base.line).lerp(CONCRETE, cured);
      fillMaterial.color.copy(base.line).lerp(CONCRETE, cured);
      goldEdgeMaterial.color.copy(base.gold).lerp(CONCRETE, cured);

      // The crane erects at the head of each cycle and withdraws once the
      // skeleton stands, so the finished house is seen without it in the way.
      const erect = ramp(u, 0, 1.4);
      mastLift.scale.y = Math.max(0.0001, erect);
      head.position.y = MAST_H * mastLift.scale.y;
      head.visible = erect > 0.99;
      const craneFade = 1 - ramp(u, CRANE_OUT, CRANE_GONE - CRANE_OUT);
      craneMaterial.opacity = 0.42 * erect * craneFade;
      hoist.material.opacity = 0.6 * erect * craneFade;
      hookMaterial.opacity = 0.95 * erect * craneFade;
      crane.visible = craneMaterial.opacity > 0.002;
      dimension.material.opacity = 0.3 * ramp(u, BUILD_START, 1.5) * (1 - ramp(u, COLLAPSE_AT, 1));

      // The site is set out before anything is built on it, and the city was
      // always there — it just fades up out of the fog.
      siteMaterial.opacity = 0.22 * Math.min(1, Math.max(0, (t - 0.4) / 1.6));
      skylineMaterial.opacity = 0.09 * Math.min(1, Math.max(0, (t - 0.8) / 2.4));

      // Walls go up raw, in the same grey as the frame, and are painted after.
      const walled = ramp(u, WALLS_AT, WALLS_FOR) * (1 - unbuild(u, wallStage));
      const painted = ramp(u, PAINT_AT, PAINT_FOR);
      wallBody.color.copy(CONCRETE).lerp(base.cream, painted);
      wallTrim.color.copy(CONCRETE).lerp(CLAY, painted);
      terraceMaterial.color.copy(CONCRETE).lerp(TIMBER, painted);
      terraceMaterial.opacity = T.wall * (0.55 + 0.45 * painted) * walled;
      // The terrace railing is finished in timber along with its deck.
      terraceEdge.color.copy(base.line).lerp(CONCRETE, cured).lerp(TIMBER, painted);
      // Paint covers: bare blockwork is thin enough to read the frame through,
      // a painted wall is not. The setting-out lines fade as the coat goes on.
      const cover = T.wall * (0.55 + 0.45 * painted) * walled;
      wallBody.opacity = cover;
      wallTrim.opacity = cover;
      wallEdge.opacity = T.wallEdge * walled * (1 - 0.8 * painted);

      // Glazing lands with the paint, and has to be dark to read as an opening.
      const glazed = ramp(u, PAINT_AT - 0.4, 1.3) * (1 - unbuild(u, glassStage));
      glassMaterial.opacity = 0.85 * glazed;
      glassEdge.opacity = 0.4 * glazed;
      // The roof deck cures with everything else rather than staying brass.
      const roofed = ramp(u, WALLS_AT + 0.3, 1.2) * (1 - unbuild(u, deckStage));
      roofMaterial.color.copy(base.gold).lerp(CONCRETE, cured).lerp(DECK, painted);
      roofMaterial.opacity = (0.5 + 0.35 * painted) * roofed;
      roofEdge.opacity = 0.4 * roofed;

      // A slow sway rather than a full slew: the jib stays in frame and the
      // composition does not swing apart.
      head.rotation.y = Math.sin(t * 0.16) * SWAY;

      // The trolley runs out and back while the hook rises and falls, offset so
      // the two never look mechanically locked together.
      const trolley = JIB_F * (0.42 + 0.34 * Math.sin(t * 0.23));
      const lift = -0.4 - (MAST_H - HEIGHT - 0.9) * (0.5 + 0.5 * Math.sin(t * 0.31));
      hoistPositions.set([trolley, -0.4, 0, trolley, lift, 0]);
      hoist.geometry.attributes.position.needsUpdate = true;
      hook.position.set(trolley, lift, 0);

      // The frame swings into square as it goes up. It resets at the loop seam,
      // which is invisible because the plot is empty by then.
      const settled = Math.min(1, Math.max(0, (u - BUILD_START) / 2.2));
      frame.rotation.y = (1 - easeOutExpo(settled)) * -0.4;
      grid.material.opacity = T.grid * Math.min(1, t / 1.4);
      footprint.material.opacity = T.footprint * Math.min(1, t / 0.9);

      // One survey pass per cycle, inside the hold — there is only something to
      // survey between the house being finished and it coming down again.
      const sweepT = u - PAINT_END + 0.2;
      if (sweepT > 0 && sweepT < 2.4) {
        const k = sweepT / 2.4;
        const y = k * (HEIGHT + 1.1);
        sweep.position.y = y;
        sweepRing.position.y = y;
        const fade = Math.sin(k * Math.PI) ** 0.7;
        sweep.material.opacity = 0.22 * fade;
        sweepRing.material.opacity = 0.55 * fade;
      } else {
        sweep.material.opacity = 0;
        sweepRing.material.opacity = 0;
      }

      const pos = dustGeometry.attributes.position;
      for (let i = 0; i < DUST; i += 1) {
        let y = pos.array[i * 3 + 1] + dustSpeed[i] * 0.016;
        if (y > 8) y = -0.5;
        pos.array[i * 3 + 1] = y;
        pos.array[i * 3] += Math.sin(t * 0.4 + i) * 0.0012;
      }
      pos.needsUpdate = true;

      // Handover: push in on the finished house, hold, then pull back out.
      const focus = ramp(u, FOCUS_AT, FOCUS_IN)
        * (1 - ramp(u, FOCUS_AT + FOCUS_IN + FOCUS_HOLD, FOCUS_OUT));
      camAim.copy(CENTRE).lerp(HOUSE, focus * 0.85);
      camera.position.copy(VIEW).multiplyScalar(fitDistance * (1 - 0.26 * focus)).add(camAim);
      camera.lookAt(camAim);

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      world.rotation.y = pointer.x * 0.13 + t * 0.012;
      world.rotation.x = pointer.y * 0.05;

      renderer.render(scene, camera);
    };

    // Two independent reasons to stop — a hidden tab, and a panel scrolled out
    // of view — so the loop is gated on both rather than on whichever came last.
    let onScreen = true;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      draw(clock.getElapsedTime());
    };
    const play = () => {
      if (raf || reduced || !onScreen || document.hidden) return;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    if (reduced) {
      // One finished frame: the structure is the information, the build is not.
      staticRedraw = () => draw(FOCUS_AT + FOCUS_IN + FOCUS_HOLD * 0.5);
      staticRedraw();
    } else {
      play();
    }

    // A background tab should not hold a GPU loop open, and on the home page
    // the hero is one band of a long scroll — once it is past, it stops too.
    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener('visibilitychange', onVisibility);

    const viewWatcher = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) play(); else pause();
    }, { rootMargin: '100px' });
    viewWatcher.observe(host);

    return () => {
      pause();
      viewWatcher.disconnect();
      themeWatcher.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      observer.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      unitBox.dispose();
      unitEdges.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduced, tone]);

  if (failed) return null;
  return <div ref={hostRef} aria-hidden className={className} />;
}
