import { useEffect, useRef, useState } from 'react';
// Named imports, not a namespace import: rollup can only tree-shake three when
// it can see exactly which classes are reached.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, CircleGeometry, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, EdgesGeometry, ExtrudeGeometry, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshPhongMaterial, NormalBlending, Object3D, Path, PerspectiveCamera,
  RingGeometry, Scene, Shape, SphereGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { cn } from '@/helpers/utils';

/**
 * Section Cut — an exploded bathroom-corner detail that builds itself, then
 * peels open twice to show what it is made of.
 *
 * This is the hero's anchor, and it is deliberately nothing like the timber
 * frame on the login screen: solid shaded material rather than wireframe, a
 * colour per layer rather than gold-on-ink, and a camera that leans around a
 * still object rather than a model that spins. The subject is the trades the
 * company actually sells — screed, waterproofing, tile, conduit, supply, waste.
 *
 * The rules it plays by:
 *   1. Decoration beside a CTA. It never takes a pointer event, never looks
 *      clickable, and holds still for about four fifths of its cycle.
 *   2. Colour comes from CSS variables, so a theme toggle repaints it in place
 *      rather than stranding it or replaying the build.
 *   3. `prefers-reduced-motion` gets one composed still frame and no rAF, ever.
 *   4. It stops when the hero scrolls away or the tab is hidden.
 *   5. No textures, no assets, no network. Every shape is procedural.
 */

// ── the drawing, in metres ─────────────────────────────────────────────────────
// Origin is the centre of the finished floor, +Y up. The room occupies +X/+Z of
// the corner; the two walls sit along the -X and -Z edges.

const ROOM = 2.20;
const HALF = ROOM / 2;
const WALL_H = 1.90;
const CAVITY = 0.18;        // blockwork thickness, behind the board
const RETURN_LEN = 1.20;    // the return wall is partial, with a cut end

const TILE = 0.52;
const GROUT = 0.018;
const PITCH = TILE + GROUT;
const MARGIN = (ROOM - (4 * TILE + 3 * GROUT)) / 2;
/** Centre of tile column/row i along a 2.20 run. */
const cell = (i) => -HALF + MARGIN + TILE / 2 + i * PITCH;

const COL = [0, 1, 2, 3].map(cell);
const ROW = [0, 1, 2].map((i) => 0.033 + TILE / 2 + i * PITCH);
const TOP_ROW_Y = 0.033 + 3 * PITCH + 0.12;
const TOP_ROW_H = 0.24;

const BASIN_X = COL[1];     // the basin owns one tile column
const SOCKET_X = COL[2];
const SOCKET_Y = ROW[2];
const DRAIN = { x: COL[0], z: COL[0] };   // the omitted floor tile

/** Wall-local z of each layer when seated, and how far it opens. */
const SEAT = { services: 0.010, board: 0.180, wallTile: 0.205 };
const OPEN = { services: 0.26, board: 0.52, wallTile: 0.78 };

/** Floor layers: seated height above the slab, and how far they fly apart. */
const FLOOR = {
  screed: { base: 0.010, lift: 0.22 },
  membrane: { base: 0.110, lift: 0.44 },
  adhesive: { base: 0.155, lift: 0.66 },
  tiles: { base: 0.215, lift: 0.88 },
};

const CENTRE = new Vector3(0, 0.92, 0);
const VIEW = new Vector3(0.62, 0.42, 0.66).normalize();
const FIT_WIDE = 2.16;
const FIT_DENSE = 1.98;
const UP = new Vector3(0, 1, 0);

// ── easing ─────────────────────────────────────────────────────────────────────
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.3 * (t - 1) ** 2;
/** 0 before `at`, eased to 1 over `dur`. The whole timeline is written with it. */
const beat = (t, at, dur, ease = easeOutCubic) => ease(clamp01((t - at) / dur));

// ── palette ────────────────────────────────────────────────────────────────────

/** `--gold: 34 58% 45%` → a Color. The tokens are bare triples, not functions. */
function cssColor(styles, name, fallback) {
  const raw = styles.getPropertyValue(name).trim();
  const [h, s, l] = raw.split(/[\s/]+/);
  if (!h || !s || !l) return new Color(fallback);
  return new Color().setHSL(parseFloat(h) / 360, parseFloat(s) / 100, parseFloat(l) / 100);
}

const HSL = { h: 0, s: 0, l: 0 };
/** Keeps a token's hue but forces its lightness — used for the three lights. */
const tintL = (c, l) => { c.getHSL(HSL); return c.setHSL(HSL.h, HSL.s, l); };

const TOKENS = {
  substrate: ['--build-substrate', '#9aa3a6'],
  screed: ['--build-screed', '#c8b49a'],
  membrane: ['--build-membrane', '#1f7fc4'],
  adhesive: ['--build-adhesive', '#a8b6ae'],
  tile: ['--build-tile', '#c2704a'],
  board: ['--build-board', '#cbc5b8'],
  wallTile: ['--build-walltile', '#3f8f92'],
  live: ['--trade-live', '#f08b1d'],
  cold: ['--trade-cold', '#3fa9e8'],
  porcelain: ['--trade-porcelain', '#f6f3ec'],
  hot: ['--destructive', '#b93b32'],
  waste: ['--muted-foreground', '#6b7276'],
  gold: ['--gold', '#c08a3e'],
  ink: ['--ink', '#0a1418'],
  paper: ['--background', '#faf8f5'],
  primary: ['--primary', '#154c59'],
  outline: ['--foreground', '#1b262b'],
};

// ── turned profiles ────────────────────────────────────────────────────────────
/** Up the outside, over the rim and back down the inside — one direction, so
 *  the normals stay consistent. */
const BASIN_PROFILE = [
  [0.001, -0.145], [0.062, -0.150], [0.140, -0.128], [0.205, -0.078], [0.245, -0.020],
  [0.258, 0.000], [0.262, 0.008], [0.252, 0.010], [0.226, 0.002], [0.180, -0.026],
  [0.001, -0.040],
].map(([r, y]) => new Vector2(r, y));

const TAP_PROFILE = [
  [0.001, 0.000], [0.048, 0.000], [0.046, 0.014], [0.028, 0.030],
  [0.026, 0.150], [0.026, 0.200], [0.001, 0.200],
].map(([r, y]) => new Vector2(r, y));

/**
 * The cement board and the penetrations the first fix passes through. Holes
 * must wind opposite the outer shape or they render filled — and watching the
 * pipes thread through them is the payload of the whole assemble.
 */
function boardShape() {
  const shape = new Shape();
  shape.moveTo(-HALF, 0);
  shape.lineTo(HALF, 0);
  shape.lineTo(HALF, WALL_H);
  shape.lineTo(-HALF, WALL_H);
  shape.closePath();

  const circle = (cx, cy, r) => {
    const hole = new Path();
    hole.absarc(cx, cy, r, 0, Math.PI * 2, true);
    return hole;
  };
  const square = (cx, cy, h) => {
    const hole = new Path();
    hole.moveTo(cx - h, cy - h);
    hole.lineTo(cx - h, cy + h);
    hole.lineTo(cx + h, cy + h);
    hole.lineTo(cx + h, cy - h);
    hole.closePath();
    return hole;
  };

  shape.holes.push(
    circle(BASIN_X - 0.12, 0.95, 0.048),
    circle(BASIN_X + 0.12, 0.95, 0.048),
    circle(BASIN_X, 0.72, 0.090),
    square(SOCKET_X, SOCKET_Y, 0.125),
  );
  return shape;
}

const DEFAULT_CAPTIONS = {
  rest: 'A bathroom corner, layer by layer — slab, screed, waterproofing, tile.',
  membrane: 'Waterproof membrane, turned up onto the wall. This is what stops seepage.',
  services: 'Conduit and supply pipes, set into the wall before the board goes on.',
};

const DEFAULT_LAYERS = [
  'Reinforced concrete slab', 'Cement screed', 'Waterproof membrane', 'Notched tile adhesive',
  'Terracotta floor tile', 'Blockwork', 'Conduit and supply pipes', 'Cement board', 'Wall tile',
];

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {boolean} [props.reduced] Render one static frame and schedule no rAF.
 * @param {{rest?:string, membrane?:string, services?:string}} [props.captions]
 *   Pass Nepali strings here — the component never translates.
 * @param {string[]} [props.layerLabels] The screen-reader layer list, in build order.
 */
export function SectionCutScene({ className, reduced = false, captions, layerLabels }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [pass, setPass] = useState(null); // null = resting

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return undefined;
    }

    renderer.setClearAlpha(0);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 3.0, 18);
    // The camera hangs off a rig centred on the model, so the pointer leans the
    // view around a still object rather than spinning the object. Nine separated
    // layers swim if you rotate them; they hold if you rotate the eye.
    const rig = new Group();
    rig.position.copy(CENTRE);
    rig.add(camera);
    scene.add(rig);

    const world = new Group();
    scene.add(world);

    // ── shared geometry ──
    const UNIT_BOX = new BoxGeometry(1, 1, 1);
    const UNIT_EDGES = new EdgesGeometry(UNIT_BOX);
    const PIPE = new CylinderGeometry(1, 1, 1, 12);
    const JOINT = new SphereGeometry(1, 10, 8);
    const RING = new RingGeometry(0.86, 1.0, 24);
    const BASIN = new LatheGeometry(BASIN_PROFILE, 20);
    BASIN.computeVertexNormals();
    const TAP_BODY = new LatheGeometry(TAP_PROFILE, 14);
    const BOARD = new ExtrudeGeometry(boardShape(), { depth: 0.015, bevelEnabled: false });

    // A disc that fades to nothing at its rim, standing in for contact shadow.
    const DISC = new CircleGeometry(1, 24);
    const dc = new Float32Array(DISC.attributes.position.count * 4);
    for (let i = 0; i < dc.length; i += 4) {
      dc[i] = 1; dc[i + 1] = 1; dc[i + 2] = 1; dc[i + 3] = i === 0 ? 1 : 0;
    }
    DISC.setAttribute('color', new BufferAttribute(dc, 4));

    const geometries = [UNIT_BOX, UNIT_EDGES, PIPE, JOINT, RING, BASIN, TAP_BODY, BOARD, DISC];

    // ── materials ──
    const lam = () => new MeshLambertMaterial();
    const substrateMat = lam();
    const substrateShadeMat = lam();
    const screedMat = lam();
    const membraneMat = lam();
    const adhesiveMat = lam();
    const tileMat = lam();
    const boardMat = lam();
    const wallTileMat = lam();
    const liveMat = lam();
    const coldMat = lam();
    const hotMat = lam();
    const wasteMat = lam();
    // Lambert has no specular, and without one the mixer reads as tan plastic
    // and the basin as grey card. These two carry the finished-fixture read.
    const porcelainMat = new MeshPhongMaterial({ shininess: 60 });
    const brassMat = new MeshPhongMaterial({ shininess: 150 });
    const cutCapMat = new MeshBasicMaterial();
    const discMat = new MeshBasicMaterial({
      transparent: true, opacity: 0.13, depthWrite: false, vertexColors: true,
    });
    const flashMat = new MeshBasicMaterial({
      transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
    });
    const fallMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const outlineMat = new LineBasicMaterial({ transparent: true, opacity: 0.16 });
    const outlineGoldMat = new LineBasicMaterial({ transparent: true, opacity: 0.45 });

    const materials = [
      substrateMat, substrateShadeMat, screedMat, membraneMat, adhesiveMat, tileMat, boardMat,
      wallTileMat, liveMat, coldMat, hotMat, wasteMat, porcelainMat, brassMat, cutCapMat,
      discMat, flashMat, fallMat, outlineMat, outlineGoldMat,
    ];

    // ── lights: three, no shadow maps ──
    const hemi = new HemisphereLight(0xffffff, 0x223033, 1.05);
    const key = new DirectionalLight(0xffffff, 0.95);
    key.position.set(3.2, 5.4, 3.8);
    const fill = new DirectionalLight(0xffffff, 0.26);
    fill.position.set(-4.2, 1.6, 2.4);
    scene.add(hemi, key, fill);

    // ── builders ──
    const dummy = new Object3D();
    const box = (mat, sx, sy, sz, x, y, z) => {
      const m = new Mesh(UNIT_BOX, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      return m;
    };
    const outline = (sx, sy, sz, x, y, z) => {
      const l = new LineSegments(UNIT_EDGES, outlineMat);
      l.scale.set(sx, sy, sz);
      l.position.set(x, y, z);
      l.renderOrder = 3;
      return l;
    };
    const pipe = (mat, r, len, x, y, z, axis = 'y') => {
      const m = new Mesh(PIPE, mat);
      m.scale.set(r, len, r);
      m.position.set(x, y, z);
      if (axis === 'x') m.rotation.z = Math.PI / 2;
      if (axis === 'z') m.rotation.x = Math.PI / 2;
      return m;
    };
    const joint = (mat, r, x, y, z) => {
      const m = new Mesh(JOINT, mat);
      m.scale.setScalar(r);
      m.position.set(x, y, z);
      return m;
    };

    // ── the floor, five layers ──
    const floorSub = new Group();
    floorSub.add(
      box(substrateMat, ROOM, 0.16, ROOM, 0, -0.08, 0),
      // A separate darker slice under the slab, rather than a material array,
      // which would cost six group draws on one box.
      box(substrateShadeMat, ROOM, 0.024, ROOM, 0, -0.172, 0),
      outline(ROOM, 0.16, ROOM, 0, -0.08, 0),
    );
    world.add(floorSub);

    const gScreed = new Group();
    gScreed.add(box(screedMat, ROOM, 0.09, ROOM, 0, 0.045, 0), outline(ROOM, 0.09, ROOM, 0, 0.045, 0));

    // The membrane turns up onto both walls. That L is the seepage pitch, drawn.
    const gMembrane = new Group();
    const membraneEdges = [
      outline(ROOM, 0.035, ROOM, 0, 0.0175, 0),
      outline(ROOM, 0.26, 0.035, 0, 0.13, -HALF + 0.0175),
    ];
    gMembrane.add(
      box(membraneMat, ROOM, 0.035, ROOM, 0, 0.0175, 0),
      box(membraneMat, ROOM, 0.26, 0.035, 0, 0.13, -HALF + 0.0175),
      box(membraneMat, 0.035, 0.26, ROOM, -HALF + 0.0175, 0.13, 0),
      ...membraneEdges,
    );

    // The notched trowel bed — the most trade-literate object in the scene.
    const RIBS = 12;
    const gAdhesive = new Group();
    const adhesiveRibs = new InstancedMesh(UNIT_BOX, adhesiveMat, RIBS);
    for (let i = 0; i < RIBS; i += 1) {
      dummy.position.set(0, 0.025, -0.935 + i * 0.17);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(2.16, 0.05, 0.075);
      dummy.updateMatrix();
      adhesiveRibs.setMatrixAt(i, dummy.matrix);
    }
    adhesiveRibs.instanceMatrix.needsUpdate = true;
    gAdhesive.add(adhesiveRibs);

    // The tile field, laid corner to corner rather than dropped on as a lid.
    const gFloorTiles = new Group();
    const floorCells = [];
    for (let cx = 0; cx < 4; cx += 1) {
      for (let cz = 0; cz < 4; cz += 1) {
        if (cx === 0 && cz === 0) continue;  // the drain takes this one
        floorCells.push({ x: COL[cx], z: COL[cz], h: TILE, order: cx + cz });
      }
    }
    const floorTiles = new InstancedMesh(UNIT_BOX, tileMat, floorCells.length);
    const drain = pipe(brassMat, 0.095, 0.032, DRAIN.x, 0.0175, DRAIN.z);
    const drainInner = pipe(substrateShadeMat, 0.070, 0.016, DRAIN.x, 0.026, DRAIN.z);
    const floorDisc = new Mesh(DISC, discMat);
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.scale.setScalar(0.55);
    floorDisc.position.set(BASIN_X, 0.024, -0.46);
    floorDisc.renderOrder = 2;
    gFloorTiles.add(floorTiles, drain, drainInner, floorDisc);

    world.add(gScreed, gMembrane, gAdhesive, gFloorTiles);

    // ── the walls ──
    // Each wall has its own frame: local +Z points out of the wall into the room,
    // local +X runs along it. The two therefore open along diverging axes, which
    // is what keeps the corner reading as a corner while it is apart.
    const wallBack = new Group();
    wallBack.position.set(0, 0, -HALF);
    const wallReturn = new Group();
    wallReturn.position.set(-HALF, 0, 0);
    wallReturn.rotation.y = Math.PI / 2;
    world.add(wallBack, wallReturn);

    // Blockwork for both walls, one instanced mesh in world space. Never moves.
    const BLOCK = { w: 0.53, h: 0.32, joint: 0.018 };
    const blocks = [];
    /**
     * Lays one course, cutting the end blocks to the wall rather than letting
     * them overhang it. A real mason cuts the closer; an uncut course reads as
     * a bug, because it is one.
     */
    const course = (lo, hi, y, h, offset, place) => {
      const pitch = BLOCK.w + BLOCK.joint;
      const first = Math.floor((lo - offset) / pitch) - 1;
      for (let i = first; i < first + 7; i += 1) {
        const left = Math.max(lo, offset + i * pitch);
        const right = Math.min(hi, offset + i * pitch + BLOCK.w);
        if (right - left < 0.04) continue;   // a sliver reads as a crack, not a block
        blocks.push(place((left + right) / 2, right - left, y, h));
      }
    };
    for (let c = 0; c < 6; c += 1) {
      const bottom = c * (BLOCK.h + BLOCK.joint);
      if (bottom >= WALL_H) break;
      const h = Math.min(BLOCK.h, WALL_H - bottom);
      const y = bottom + h / 2;
      const stagger = c % 2 ? (BLOCK.w + BLOCK.joint) / 2 : 0;
      course(-HALF, HALF, y, h, -HALF + stagger,
        (mid, w, yy, hh) => ({ pos: [mid, yy, -HALF - CAVITY / 2], w, h: hh, rot: 0 }));
      course(-HALF, -HALF + RETURN_LEN, y, h, -HALF + stagger,
        (mid, w, yy, hh) => ({ pos: [-HALF - CAVITY / 2, yy, mid], w, h: hh, rot: Math.PI / 2 }));
    }
    const blockwork = new InstancedMesh(UNIT_BOX, substrateMat, blocks.length);
    blocks.forEach((b, i) => {
      dummy.position.set(b.pos[0], b.pos[1], b.pos[2]);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.h, CAVITY);
      dummy.updateMatrix();
      blockwork.setMatrixAt(i, dummy.matrix);
    });
    blockwork.instanceMatrix.needsUpdate = true;
    world.add(blockwork);

    // First fix in the cavity: conduit and back box, hot and cold supply, waste.
    // Radii are deliberately oversized — a true 22mm pipe is three pixels here
    // and the whole colour argument dies with it.
    const CAV_Z = 0.09;
    const RISER_TOP = SOCKET_Y - 0.14;
    const gServices = new Group();
    gServices.add(
      pipe(liveMat, 0.032, RISER_TOP, 0.72, RISER_TOP / 2, CAV_Z),
      joint(liveMat, 0.036, 0.72, RISER_TOP, CAV_Z),
      pipe(liveMat, 0.032, 0.72 - SOCKET_X, (0.72 + SOCKET_X) / 2, RISER_TOP, CAV_Z, 'x'),
      joint(liveMat, 0.036, SOCKET_X, RISER_TOP, CAV_Z),
      pipe(liveMat, 0.032, 0.16, SOCKET_X, RISER_TOP + 0.08, CAV_Z),
      box(liveMat, 0.25, 0.25, 0.10, SOCKET_X, SOCKET_Y, 0.06),

      // The supplies terminate capped inside the wall — correct first fix, and
      // the reason the finished wall is clean.
      pipe(coldMat, 0.038, 0.95, BASIN_X - 0.12, 0.475, CAV_Z),
      joint(coldMat, 0.042, BASIN_X - 0.12, 0.95, CAV_Z),
      pipe(hotMat, 0.038, 0.95, BASIN_X + 0.12, 0.475, CAV_Z),
      joint(hotMat, 0.042, BASIN_X + 0.12, 0.95, CAV_Z),

      pipe(wasteMat, 0.072, 0.72, BASIN_X, 0.36, CAV_Z + 0.005),
      joint(wasteMat, 0.078, BASIN_X, 0.72, CAV_Z + 0.005),
      // Through the board hole, protruding to where the basin's trap meets it.
      pipe(wasteMat, 0.072, 0.40, BASIN_X, 0.72, 0.20, 'z'),
    );
    wallBack.add(gServices);

    const gBoardBack = new Group();
    gBoardBack.add(new Mesh(BOARD, boardMat), outline(ROOM, WALL_H, 0.015, 0, WALL_H / 2, 0.0075));
    wallBack.add(gBoardBack);

    const RET_MID = -HALF + RETURN_LEN / 2;
    const gBoardReturn = new Group();
    gBoardReturn.add(
      box(boardMat, RETURN_LEN, WALL_H, 0.015, RET_MID, WALL_H / 2, 0.0075),
      outline(RETURN_LEN, WALL_H, 0.015, RET_MID, WALL_H / 2, 0.0075),
    );
    wallReturn.add(gBoardReturn);

    /** A run of wall tiles, skipping the cells a fixture occupies. */
    const wallTileDefs = (cols, skip) => {
      const out = [];
      cols.forEach((x, ci) => {
        ROW.forEach((y, ri) => {
          if (skip.some(([sc, sr]) => sc === ci && sr === ri)) return;
          out.push({ x, y, h: TILE, order: ci + ri });
        });
        out.push({ x, y: TOP_ROW_Y, h: TOP_ROW_H, order: ci + 3 });
      });
      return out;
    };
    const backTileDefs = wallTileDefs(COL, [[1, 1], [2, 2]]);
    const returnTileDefs = wallTileDefs([COL[0], COL[1]], []);

    const gTileBack = new Group();
    const wallTilesBack = new InstancedMesh(UNIT_BOX, wallTileMat, backTileDefs.length);
    gTileBack.add(wallTilesBack);
    wallBack.add(gTileBack);

    const gTileReturn = new Group();
    const wallTilesReturn = new InstancedMesh(UNIT_BOX, wallTileMat, returnTileDefs.length);
    gTileReturn.add(wallTilesReturn);
    wallReturn.add(gTileReturn);

    // ── fixtures: children of the back tiles, so they ride the finishes ──
    // Their depths are quoted from the tiled FACE, not from the wall origin —
    // the group they hang off is already SEAT.wallTile forward, and adding the
    // two together is what leaves a basin floating in the middle of the room.
    const FACE = (z) => z - SEAT.wallTile;
    const basin = new Mesh(BASIN, porcelainMat);
    basin.position.set(BASIN_X, 0.82, FACE(0.46));
    const bracket = box(porcelainMat, 0.34, 0.05, 0.16, BASIN_X, 0.755, FACE(0.30));
    const tapParts = new Group();
    const tapBody = new Mesh(TAP_BODY, brassMat);
    tapBody.position.set(BASIN_X, 0.826, FACE(0.30));
    const tapLever = box(brassMat, 0.075, 0.022, 0.055, BASIN_X + 0.055, 1.012, FACE(0.30));
    tapParts.add(
      tapBody,
      pipe(brassMat, 0.026, 0.13, BASIN_X, 1.045, FACE(0.36), 'z'),
      pipe(brassMat, 0.024, 0.06, BASIN_X, 1.015, FACE(0.421)),
      tapLever,
    );
    const trap = pipe(brassMat, 0.045, 0.16, BASIN_X, 0.655, FACE(0.46));
    const FACE_SOCKET_Z = FACE(0.249);
    const socketPlate = box(boardMat, 0.22, 0.22, 0.014, SOCKET_X, SOCKET_Y, FACE_SOCKET_Z);
    const wallDisc = new Mesh(DISC, discMat);
    wallDisc.scale.set(0.42, 0.30, 1);
    wallDisc.position.set(BASIN_X, 0.60, FACE(0.244));
    wallDisc.renderOrder = 2;
    gTileBack.add(basin, bracket, tapParts, trap, socketPlate, wallDisc);

    // ── the section caps: a gold L that holds while everything else flies apart ──
    const caps = [
      { p: [0, WALL_H + 0.006, -HALF - CAVITY / 2], s: [ROOM, 0.012, CAVITY] },
      { p: [HALF - 0.006, WALL_H / 2, -HALF - CAVITY / 2], s: [0.012, WALL_H, CAVITY] },
      { p: [-HALF - CAVITY / 2, WALL_H + 0.006, RET_MID], s: [CAVITY, 0.012, RETURN_LEN] },
      { p: [-HALF - CAVITY / 2, WALL_H / 2, -HALF + RETURN_LEN - 0.006], s: [CAVITY, WALL_H, 0.012] },
    ];
    const cutCaps = new InstancedMesh(UNIT_BOX, cutCapMat, caps.length);
    caps.forEach((c, i) => {
      dummy.position.set(c.p[0], c.p[1], c.p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(c.s[0], c.s[1], c.s[2]);
      dummy.updateMatrix();
      cutCaps.setMatrixAt(i, dummy.matrix);
    });
    cutCaps.instanceMatrix.needsUpdate = true;
    world.add(cutCaps);

    // ── effects ──
    const flashes = [new Mesh(RING, flashMat), new Mesh(RING, flashMat), new Mesh(RING, flashMat)];
    flashes[0].position.set(BASIN_X, 1.045, -HALF + 0.42);
    flashes[1].position.set(SOCKET_X, SOCKET_Y, -HALF + 0.27);
    flashes[2].position.set(DRAIN.x, 0.26, DRAIN.z);
    flashes[2].rotation.x = -Math.PI / 2;
    flashes.forEach((f) => { f.visible = false; f.renderOrder = 4; world.add(f); });

    // A gold streak running the fall of the floor into the drain — the only time
    // gold appears at scale, and it draws the thing waterproofing is sold on.
    const FALL_FROM = new Vector3(0.85, 0, 0.85);
    const FALL_TO = new Vector3(DRAIN.x, 0, DRAIN.z);
    const fallLine = new Mesh(UNIT_BOX, fallMat);
    fallLine.rotation.y = Math.atan2(-(FALL_TO.z - FALL_FROM.z), FALL_TO.x - FALL_FROM.x);
    fallLine.visible = false;
    fallLine.renderOrder = 4;
    world.add(fallLine);

    // ── palette, re-read whenever the theme is toggled ──
    let isDark = false;
    const paint = () => {
      const styles = getComputedStyle(document.documentElement);
      const c = {};
      for (const k of Object.keys(TOKENS)) c[k] = cssColor(styles, TOKENS[k][0], TOKENS[k][1]);
      isDark = document.documentElement.classList.contains('dark');

      substrateMat.color.copy(c.substrate);
      substrateShadeMat.color.copy(c.substrate).multiplyScalar(0.7);
      screedMat.color.copy(c.screed);
      membraneMat.color.copy(c.membrane);
      adhesiveMat.color.copy(c.adhesive);
      tileMat.color.copy(c.tile);
      boardMat.color.copy(c.board);
      wallTileMat.color.copy(c.wallTile);
      liveMat.color.copy(c.live);
      coldMat.color.copy(c.cold);
      hotMat.color.copy(c.hot);
      wasteMat.color.copy(c.waste);
      porcelainMat.color.copy(c.porcelain);
      porcelainMat.specular.setRGB(0.35, 0.35, 0.35);
      brassMat.color.copy(c.gold);
      brassMat.specular.copy(tintL(c.gold.clone(), 0.86));
      brassMat.emissive.copy(c.gold).multiplyScalar(0.10);
      cutCapMat.color.copy(c.gold);
      flashMat.color.copy(c.gold);
      fallMat.color.copy(c.gold);
      discMat.color.copy(c.ink);
      outlineMat.color.copy(c.outline);
      outlineGoldMat.color.copy(c.gold);

      // A thin pipe in shadow desaturates to grey and takes the hue-coding with
      // it, so every service run carries a little of its own colour as emissive.
      membraneMat.emissive.copy(c.membrane);
      liveMat.emissive.copy(c.live);
      coldMat.emissive.copy(c.cold);
      hotMat.emissive.copy(c.hot);
      wasteMat.emissive.copy(c.waste);

      // Additive gold has nothing to add to on near-white paper, so the fall
      // line changes blending with the theme rather than vanishing in light mode.
      fallMat.blending = isDark ? AdditiveBlending : NormalBlending;
      fallMat.needsUpdate = true;

      hemi.color.copy(tintL(c.paper.clone(), isDark ? 0.58 : 0.94));
      hemi.groundColor.copy(tintL(c.ink.clone(), isDark ? 0.10 : 0.20));
      hemi.intensity = isDark ? 0.70 : 1.05;
      key.color.copy(tintL(c.gold.clone(), 0.90));
      key.intensity = isDark ? 0.62 : 0.95;
      fill.color.copy(tintL(c.primary.clone(), 0.62));
      fill.intensity = isDark ? 0.40 : 0.26;
    };
    paint();

    // ── pose ──
    // draw() never writes to the scene graph. poseAt() is pure, applyPose() is
    // the only writer. That is what makes the reduced-motion frame reachable at
    // all — it is a composition no moment on the timeline produces — and what
    // lets resize and repaint re-apply the last pose instead of guessing a time.
    const START = 4.2, PASS = 16.0, HOLD = 9.4, OPENING = 1.3, HELD = 2.9;

    const fallAt = (t, at) => {
      const p = clamp01((t - at) / 0.9);
      if (p <= 0 || p >= 1) return { alpha: 0, u: 0, len: 0 };
      return {
        alpha: Math.min(1, p / 0.2) * Math.min(1, (1 - p) / 0.24),
        u: p,
        len: p > 0.84 ? (1 - p) / 0.16 : 1,
      };
    };

    function poseAt(t) {
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
        bob: 0.006 * Math.sin(2 * Math.PI * 0.13 * t),
        phase: null,
      };

      if (t >= START) {
        const cycle = (t - START) % (PASS * 2);
        const inB = cycle >= PASS;
        const tau = inB ? cycle - PASS : cycle;
        const open = easeInOutCubic(clamp01((tau - HOLD) / OPENING))
          - easeInOutCubic(clamp01((tau - HOLD - OPENING - HELD) / OPENING));
        if (open > 0.02) pose.phase = inB ? 'services' : 'membrane';
        if (inB) {
          // The board and its tiles push forward carrying the basin and socket,
          // and what is behind them is the pitch.
          pose.back.board = open;
          pose.back.tiles = open;
          pose.pipeEmissive = 0.16 + 0.18 * open;
        } else {
          pose.floor.tiles = open;
          pose.floor.adhesive = open * 0.72;
          pose.membraneEmissive = 0.08 + 0.18 * open;
          pose.gold = open > 0.4;
          pose.fall = fallAt(tau, HOLD + OPENING + 0.5);
        }
      }
      return pose;
    }

    /** Not a frozen frame of the loop — no `t` opens both stacks at once. */
    const STATIC_POSE = {
      dolly: 1,
      explode: 1,
      floor: { screed: 0, membrane: 0, adhesive: 0.14, tiles: 0.30 },
      back: { services: 0, board: 0.26, tiles: 0.26 },
      ret: { board: 0, tiles: 0 },
      lay: 1,
      fixtures: { basin: 1, tap: 1, trap: 1, socket: 1, drain: 1 },
      membraneEmissive: 0.26,
      pipeEmissive: 0.34,
      gold: true,
      flash: [0, 0, 0],
      fall: { alpha: 0, u: 0, len: 0 },
      bob: 0,
      phase: null,
    };

    let lastPose = STATIC_POSE;
    let laid = -1;

    /** Instance matrices for a tile run, laid corner to corner. */
    const layRun = (mesh, defs, p, floorRun) => {
      const maxOrder = defs.reduce((m, d) => Math.max(m, d.order), 0) || 1;
      for (let i = 0; i < defs.length; i += 1) {
        const d = defs[i];
        const e = easeOutCubic(clamp01((p - (d.order / maxOrder) * 0.45) / 0.55));
        if (floorRun) {
          dummy.position.set(d.x, 0.0175 + (1 - e) * 0.32, d.z);
          dummy.scale.set(TILE, 0.035, TILE);
        } else {
          dummy.position.set(d.x, d.y, 0.0185 + (1 - e) * 0.20);
          dummy.scale.set(TILE, d.h, 0.037);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    function applyPose(pose) {
      gScreed.position.y = FLOOR.screed.base + pose.floor.screed * FLOOR.screed.lift * pose.explode;
      gMembrane.position.y = FLOOR.membrane.base + pose.floor.membrane * FLOOR.membrane.lift * pose.explode;
      gAdhesive.position.y = FLOOR.adhesive.base + pose.floor.adhesive * FLOOR.adhesive.lift * pose.explode;
      gFloorTiles.position.y = FLOOR.tiles.base + pose.floor.tiles * FLOOR.tiles.lift * pose.explode;

      gServices.position.z = SEAT.services + pose.back.services * OPEN.services * pose.explode;
      gBoardBack.position.z = SEAT.board + pose.back.board * OPEN.board * pose.explode;
      gTileBack.position.z = SEAT.wallTile + pose.back.tiles * OPEN.wallTile * pose.explode;
      gBoardReturn.position.z = SEAT.board + pose.ret.board * OPEN.board * pose.explode;
      gTileReturn.position.z = SEAT.wallTile + pose.ret.tiles * OPEN.wallTile * pose.explode;

      // The instance buffers are only ever written while the tiles are landing.
      if (laid !== 1 || pose.lay !== 1) {
        layRun(floorTiles, floorCells, pose.lay, true);
        layRun(wallTilesBack, backTileDefs, pose.lay, false);
        layRun(wallTilesReturn, returnTileDefs, pose.lay, false);
        laid = pose.lay === 1 ? 1 : 0;
      }

      const f = pose.fixtures;
      basin.visible = f.basin > 0.01;
      bracket.visible = f.basin > 0.01;
      basin.position.y = 0.82 + (1 - f.basin) * 0.20;
      tapParts.visible = f.tap > 0.01;
      tapParts.position.y = (1 - f.tap) * -0.14;
      trap.visible = f.trap > 0.01 && !dense;
      socketPlate.visible = f.socket > 0.01 && !dense;
      socketPlate.position.z = FACE_SOCKET_Z + (1 - f.socket) * 0.12;
      drain.visible = f.drain > 0.01;
      drainInner.visible = f.drain > 0.01;

      membraneMat.emissiveIntensity = pose.membraneEmissive;
      liveMat.emissiveIntensity = pose.pipeEmissive;
      coldMat.emissiveIntensity = pose.pipeEmissive;
      hotMat.emissiveIntensity = pose.pipeEmissive;
      wasteMat.emissiveIntensity = pose.pipeEmissive;

      const nowOutline = pose.gold ? outlineGoldMat : outlineMat;
      for (const e of membraneEdges) e.material = nowOutline;

      let flashPeak = 0;
      for (let i = 0; i < 3; i += 1) {
        const v = pose.flash[i];
        flashes[i].visible = v > 0.02;
        if (v > 0.02) flashes[i].scale.setScalar(0.10 + 0.16 * (1 - v));
        flashPeak = Math.max(flashPeak, v);
      }
      flashMat.opacity = flashPeak * 0.7;

      fallLine.visible = pose.fall.alpha > 0.02;
      if (fallLine.visible) {
        fallMat.opacity = pose.fall.alpha * (isDark ? 0.75 : 0.9);
        fallLine.scale.set(0.35 * pose.fall.len, 0.006, 0.022);
        fallLine.position.set(
          FALL_FROM.x + (FALL_TO.x - FALL_FROM.x) * pose.fall.u,
          FLOOR.tiles.base + 0.04 + pose.floor.tiles * FLOOR.tiles.lift * pose.explode,
          FALL_FROM.z + (FALL_TO.z - FALL_FROM.z) * pose.fall.u,
        );
      }

      world.position.y = pose.bob;
      lastPose = pose;
    }

    // ── size ──
    let dense = false;
    let baseDistance = 7.5;
    const bias = new Vector3();

    const placeCamera = (dolly) => {
      camera.position.copy(VIEW).multiplyScalar(baseDistance * dolly).add(bias);
      camera.lookAt(rig.worldToLocal(CENTRE.clone()));
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      dense = w < 520;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dense ? 1.5 : 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // The distance that fits in BOTH axes: a short wide panel is constrained
      // vertically, a narrow one horizontally. Take whichever is tighter.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      baseDistance = (dense ? FIT_DENSE : FIT_WIDE) / Math.sin(Math.min(vFov, hFov) / 2);
      tapLever.visible = !dense;

      // The bias sits on the camera's own position, never on the aim point:
      // offsetting the target makes the model slide across the panel instead of
      // being leaned around.
      bias.set(0, 0, 0);
      if (!dense) bias.crossVectors(VIEW, UP).normalize().multiplyScalar(-0.24);

      placeCamera(lastPose.dolly);
      applyPose(lastPose);
      renderer.render(scene, camera);
    };

    const resizeWatcher = new ResizeObserver(resize);
    resizeWatcher.observe(host);

    const themeWatcher = new MutationObserver(() => {
      paint();
      applyPose(lastPose);
      renderer.render(scene, camera);
    });
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // ── pointer: parallax only, and never on a touch device ──
    const aim = { x: 0, y: 0 };
    const eye = { x: 0, y: 0 };
    const fine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;
    const onPointerMove = (e) => {
      const r = host.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const onPointerLeave = () => { aim.x = 0; aim.y = 0; };
    if (fine && !reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      host.addEventListener('pointerleave', onPointerLeave);
    }

    // ── the loop ──
    let raf = 0;
    let elapsed = 0;
    let last = 0;
    let onScreen = true;
    let shown = null;

    const draw = (t) => {
      const pose = poseAt(t);
      applyPose(pose);
      placeCamera(pose.dolly);
      rig.rotation.y = eye.x * 0.085;
      rig.rotation.x = eye.y * 0.045;
      renderer.render(scene, camera);
      // Two setState calls per 32s cycle, never one per frame.
      if (pose.phase !== shown) { shown = pose.phase; setPass(pose.phase); }
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      // Clamped deltas, never wall-clock elapsed: a 32s cycle read off a real
      // clock would teleport most of the way into a reveal after a scroll-past.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      eye.x += (aim.x - eye.x) * Math.min(dt * 3.2, 1);
      eye.y += (aim.y - eye.y) * Math.min(dt * 3.2, 1);
      draw(elapsed);
    };
    const play = () => {
      if (raf || reduced || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const pause = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    resize();
    // Compile before anything is hidden, so the shader hitch lands on an empty
    // canvas rather than in the middle of the build.
    renderer.compile(scene, camera);

    if (reduced) {
      applyPose(STATIC_POSE);
      placeCamera(1);
      renderer.render(scene, camera);
    } else {
      play();
    }

    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener('visibilitychange', onVisibility);
    const viewWatcher = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) play(); else pause();
    }, { rootMargin: '120px' });
    viewWatcher.observe(host);

    return () => {
      pause();
      viewWatcher.disconnect();
      resizeWatcher.disconnect();
      themeWatcher.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      // Nine geometries are shared across ~90 meshes, so a scene.traverse()
      // would dispose the same buffer dozens of times. Dispose the list once.
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      [floorTiles, adhesiveRibs, blockwork, wallTilesBack, wallTilesReturn, cutCaps]
        .forEach((im) => im.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduced]);

  const copy = { ...DEFAULT_CAPTIONS, ...captions };
  const labels = layerLabels ?? DEFAULT_LAYERS;

  if (failed) return <SectionCutFallback className={className} labels={labels} />;

  return (
    <figure className={cn('relative m-0', className)}>
      <div ref={hostRef} aria-hidden className="aspect-[7/6] w-full" style={{ pointerEvents: 'none' }} />
      {/* The layers named in build order, so the panel is legible to a screen
          reader and to a crawler whatever WebGL does. */}
      <ul className="sr-only">{labels.map((l) => <li key={l}>{l}</li>)}</ul>
      <figcaption className="border-t bg-muted/40 px-5 py-2.5 text-[12px] leading-snug text-muted-foreground">
        {reduced ? (
          <>
            {copy.membrane}
            <span className="mt-1 block">{copy.services}</span>
          </>
        ) : (copy[pass] ?? copy.rest)}
      </figcaption>
    </figure>
  );
}

/**
 * No WebGL. This panel is the hero's anchor so it cannot render nothing — the
 * same layers in the same colours, stacked flat. It is also the no-JS view.
 */
function SectionCutFallback({ className, labels }) {
  const BANDS = [
    ['--build-walltile', 'h-6'], ['--trade-live', 'h-2'], ['--build-board', 'h-4'],
    ['--build-tile', 'h-8'], ['--build-adhesive', 'h-2'], ['--build-membrane', 'h-3'],
    ['--build-screed', 'h-6'], ['--build-substrate', 'h-10'],
  ];
  return (
    <figure className={cn('relative m-0', className)}>
      <div className="flex aspect-[7/6] w-full flex-col justify-center gap-1 bg-muted/30 p-6">
        {BANDS.map(([token, h]) => (
          <span key={token} className={cn('block w-full rounded-sm', h)} style={{ background: `hsl(var(${token}))` }} />
        ))}
      </div>
      <ul className="sr-only">{labels.map((l) => <li key={l}>{l}</li>)}</ul>
      <figcaption className="border-t bg-muted/40 px-5 py-2.5 text-[12px] leading-snug text-muted-foreground">
        {DEFAULT_CAPTIONS.rest}
      </figcaption>
    </figure>
  );
}
