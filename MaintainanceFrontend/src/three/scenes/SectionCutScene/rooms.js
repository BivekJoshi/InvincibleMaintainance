import { Group, InstancedMesh, Mesh, Object3D } from 'three';

/**
 * The five rooms the hero cycles through.
 *
 * They all stand in the same shell — the same slab, screed, membrane, blockwork
 * and cut caps — because the pitch is "one company fits out your whole house",
 * not five unrelated pictures. What changes per room is the fit-out, the floor
 * colour and the wall colour, so the transition can be a change of dress rather
 * than a change of set.
 *
 * A room contributes:
 *   floor / wall   CSS variables the shared tile materials lerp between
 *   caption        the resting line under the canvas
 *   reveal         the line shown while that room is opened up
 *   build(ctx)     everything the room owns, returned as three groups
 *
 * `build` gets the scene's own helpers so a room never reaches for three.js
 * directly, and never allocates a geometry — everything rides the shared
 * UNIT_BOX / PIPE / JOINT buffers the shell already uploaded.
 */

/** Repeated boxes go through one instanced draw rather than one draw each. */
function instanced(ctx, material, parts) {
  const mesh = new InstancedMesh(ctx.UNIT_BOX, material, parts.length);
  const dummy = new Object3D();
  parts.forEach((part, i) => {
    dummy.position.set(part.p[0], part.p[1], part.p[2]);
    dummy.rotation.set(0, part.ry ?? 0, 0);
    dummy.scale.set(part.s[0], part.s[1], part.s[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ── 1. washroom ────────────────────────────────────────────────────────────────
// The room the scene opens on: the one a customer is most likely to be shopping
// for, and the one whose hidden layers are the company's best argument.
function buildBath(ctx) {
  const { box, pipe, m, FACE, BASIN_X, SOCKET_X, SOCKET_Y, DRAIN, BASIN, TAP_BODY, DISC } = ctx;
  const wall = new Group();
  const floor = new Group();

  const basin = new Mesh(BASIN, m.porcelain);
  basin.position.set(BASIN_X, 0.82, FACE(0.46));
  const tap = new Group();
  const tapBody = new Mesh(TAP_BODY, m.brass);
  tapBody.position.set(BASIN_X, 0.826, FACE(0.30));
  tap.add(
    tapBody,
    pipe(m.brass, 0.026, 0.13, BASIN_X, 1.045, FACE(0.36), 'z'),
    pipe(m.brass, 0.024, 0.06, BASIN_X, 1.015, FACE(0.421)),
    box(m.brass, 0.075, 0.022, 0.055, BASIN_X + 0.055, 1.012, FACE(0.30)),
  );
  const shade = new Mesh(DISC, m.disc);
  shade.scale.set(0.42, 0.30, 1);
  shade.position.set(BASIN_X, 0.60, FACE(0.244));
  shade.renderOrder = 2;

  wall.add(
    basin,
    box(m.porcelain, 0.34, 0.05, 0.16, BASIN_X, 0.755, FACE(0.30)),   // bracket
    tap,
    pipe(m.brass, 0.045, 0.16, BASIN_X, 0.655, FACE(0.46)),           // bottle trap
    box(m.board, 0.30, 0.30, 0.014, SOCKET_X, SOCKET_Y, FACE(0.249)), // faceplate
    shade,
  );

  // The floor drain sits in the tile the field deliberately leaves out.
  const drainDisc = new Mesh(DISC, m.disc);
  drainDisc.rotation.x = -Math.PI / 2;
  drainDisc.scale.setScalar(0.55);
  drainDisc.position.set(BASIN_X, 0.024, -0.46);
  drainDisc.renderOrder = 2;
  floor.add(
    pipe(m.brass, 0.095, 0.032, DRAIN.x, 0.0175, DRAIN.z),
    pipe(m.substrateShade, 0.070, 0.016, DRAIN.x, 0.026, DRAIN.z),
    drainDisc,
  );
  return { wall, floor };
}

// ── 2. electrical ──────────────────────────────────────────────────────────────
// The hardest room to make beautiful — it has the least furniture — so it leans
// on one well-drawn object: an open consumer unit with a legible row of breakers.
function buildElectrical(ctx) {
  const { box, pipe, m, FACE, COL, ROW, SOCKET_X, SOCKET_Y } = ctx;
  const wall = new Group();
  const floor = new Group();

  const SW_X = COL[1];
  const SW_Y = ROW[1];
  const BX = [0.197, 0.243, 0.289, 0.335, 0.381, 0.427];

  wall.add(instanced(ctx, m.board, [
    { p: [SOCKET_X, SOCKET_Y, FACE(0.285)], s: [0.462, 0.340, 0.086] },   // enclosure
    // The door stands open on its hinge, which is what makes the row of
    // breakers readable at all rather than a closed grey box.
    { p: [-0.034, SOCKET_Y, FACE(0.573)], s: [0.462, 0.348, 0.016], ry: -1.833 },
    { p: [-0.500, 1.767, FACE(0.273)], s: [0.640, 0.076, 0.062] },        // batten light
  ]));

  wall.add(instanced(ctx, m.porcelain, [
    { p: [SOCKET_X, SOCKET_Y, FACE(0.335)], s: [0.412, 0.292, 0.014] },   // escutcheon
    { p: [SW_X, SW_Y, FACE(0.287)], s: [0.240, 0.240, 0.018] },           // switch plate
  ]));

  wall.add(instanced(ctx, m.substrateShade, [
    { p: [SOCKET_X, SOCKET_Y, FACE(0.346)], s: [0.352, 0.116, 0.008] },   // gear slot
    { p: [0.127, SOCKET_Y, FACE(0.359)], s: [0.070, 0.100, 0.026] },      // main switch
    ...BX.map((x) => ({ p: [x, SOCKET_Y, FACE(0.358)], s: [0.038, 0.088, 0.024] })),
    { p: [SW_X - 0.052, SW_Y, FACE(0.303)], s: [0.080, 0.130, 0.014] },
    { p: [SW_X + 0.052, SW_Y, FACE(0.303)], s: [0.080, 0.130, 0.014] },
  ]));

  // Toggle position is the state, not the colour — one breaker is switched off,
  // which is the detail that says somebody actually looked at this board.
  wall.add(instanced(ctx, m.live, [
    ...BX.map((x, k) => ({ p: [x, k === 4 ? SOCKET_Y - 0.026 : SOCKET_Y + 0.026, FACE(0.377)], s: [0.030, 0.030, 0.014] })),
    { p: [0.127, SOCKET_Y + 0.028, FACE(0.379)], s: [0.056, 0.038, 0.014] },
    { p: [SOCKET_X, SOCKET_Y - 0.101, FACE(0.347)], s: [0.030, 0.030, 0.010] },
    { p: [SW_X, SW_Y + 0.084, FACE(0.302)], s: [0.030, 0.030, 0.012] },
  ]));

  // Surface casing: down from the board, along, and down to the switch drop.
  const CZ = FACE(0.268);
  wall.add(
    box(m.live, 0.052, 0.62, 0.030, SOCKET_X, SOCKET_Y - 0.50, CZ),
    box(m.live, 0.60, 0.052, 0.030, 0.0, SOCKET_Y - 0.80, CZ),
    box(m.live, 0.052, 0.30, 0.030, SW_X, SW_Y + 0.30, CZ),
    pipe(m.waste, 0.026, 0.86, 0.72, 0.43, FACE(0.262)),   // earth run to the rod
  );

  floor.add(pipe(m.waste, 0.040, 0.05, 0.72, 0.045, 0.86)); // earth rod head
  return { wall, floor };
}

// ── 3. toilet ──────────────────────────────────────────────────────────────────
// Kept unmistakable from the washroom that precedes it: different tile, and a
// close-coupled pan, which is a silhouette nothing else in the set makes.
function buildToilet(ctx) {
  const { box, pipe, m, FACE, COL } = ctx;
  const wall = new Group();
  const floor = new Group();
  const WC_X = COL[2];
  const HB_X = COL[0];

  wall.add(instanced(ctx, m.porcelain, [
    { p: [WC_X, 0.830, FACE(0.3385)], s: [0.44, 0.360, 0.19] },   // cistern
    { p: [WC_X, 1.025, FACE(0.351)], s: [0.47, 0.030, 0.215] },   // lid
    { p: [WC_X, 0.395, FACE(0.375)], s: [0.20, 0.290, 0.28] },    // pan foot
    { p: [WC_X, 0.6125, FACE(0.42)], s: [0.365, 0.145, 0.46] },   // bowl
    { p: [WC_X, 0.698, FACE(0.42)], s: [0.345, 0.026, 0.44] },    // seat
    { p: [HB_X, 0.985, FACE(0.35)], s: [0.40, 0.115, 0.30] },     // hand basin
    { p: [HB_X, 0.890, FACE(0.4725)], s: [0.40, 0.075, 0.055] },  // apron
    { p: [HB_X, 1.080, FACE(0.257)], s: [0.40, 0.075, 0.030] },   // splashback
  ]));

  wall.add(
    box(m.brass, 0.09, 0.030, 0.030, WC_X + 0.13, 1.010, FACE(0.30)),  // flush plate
    pipe(m.brass, 0.020, 0.10, HB_X, 1.075, FACE(0.30)),               // basin pillar tap
    pipe(m.brass, 0.018, 0.05, HB_X, 1.120, FACE(0.345), 'z'),
    pipe(m.waste, 0.030, 0.17, HB_X, 0.845, FACE(0.35)),               // basin waste
    pipe(m.waste, 0.052, 0.13, WC_X, 0.470, FACE(0.185), 'z'),         // pan to soil pipe
    box(m.brass, 0.030, 0.13, 0.030, WC_X + 0.42, 0.90, FACE(0.27)),   // roll holder arm
    pipe(m.porcelain, 0.055, 0.11, WC_X + 0.42, 0.836, FACE(0.325), 'x'),
  );
  return { wall, floor };
}

// ── 4. kitchen ─────────────────────────────────────────────────────────────────
// The headline interiors product, and the only room with a continuous run — two
// long horizontals and a vertical is a shape none of the others can make.
function buildKitchen(ctx) {
  const { box, pipe, m, FACE, COL } = ctx;
  const wall = new Group();
  const floor = new Group();
  const SINK_X = COL[1];
  const HOB_X = COL[3];
  const TOP_Y = 1.12;   // 0.87 above the finished floor

  // Base run: plinth, carcass, worktop, then the doors that make it read as units.
  wall.add(instanced(ctx, m.timber, [
    // Everything sits on the FINISHED floor at y 0.25, not on the slab: drawn
    // from zero the plinth is buried and the run floats over a 0.15 void.
    { p: [0.121, 0.75, FACE(0.53)], s: [1.958, 0.70, 0.58] },        // carcass
    { p: [-0.7235, 0.75, FACE(0.822)], s: [0.255, 0.62, 0.016] },    // door 1
    { p: [-0.269, 0.75, FACE(0.822)], s: [0.626, 0.62, 0.016] },     // sink bay door
    { p: [0.2825, 0.75, FACE(0.822)], s: [0.449, 0.62, 0.016] },     // drawers
    { p: [0.807, 0.75, FACE(0.822)], s: [0.572, 0.62, 0.016] },      // hob unit
    { p: [0.121, 1.63, FACE(0.42)], s: [1.40, 0.62, 0.36] },         // wall units
    { p: [-0.229, 1.63, FACE(0.605)], s: [0.68, 0.58, 0.016] },
    { p: [0.471, 1.63, FACE(0.605)], s: [0.68, 0.58, 0.016] },
  ]));

  wall.add(instanced(ctx, m.substrate, [
    { p: [0.121, 0.325, FACE(0.50)], s: [1.958, 0.15, 0.52] },       // plinth, set back
    { p: [0.121, TOP_Y, FACE(0.54)], s: [2.00, 0.045, 0.62] },       // worktop
    { p: [HOB_X, 1.148, FACE(0.545)], s: [0.52, 0.014, 0.40] },      // hob plate
  ]));

  // Handles and tap: the small bright pieces that stop a run of boxes reading
  // as a wardrobe.
  wall.add(
    box(m.substrateShade, 0.50, 0.030, 0.40, SINK_X, 1.105, FACE(0.545)),   // sink well
    pipe(m.brass, 0.014, 0.34, -0.269, 1.00, FACE(0.836), 'x'),
    pipe(m.brass, 0.014, 0.28, 0.2825, 1.00, FACE(0.836), 'x'),
    pipe(m.brass, 0.014, 0.30, 0.807, 1.00, FACE(0.836), 'x'),
    pipe(m.brass, 0.028, 0.24, SINK_X, 1.24, FACE(0.34)),            // tap column
    pipe(m.brass, 0.024, 0.16, SINK_X, 1.355, FACE(0.40), 'z'),      // spout
    box(m.substrateShade, 0.10, 0.014, 0.10, HOB_X - 0.13, 1.157, FACE(0.50)),
    box(m.substrateShade, 0.10, 0.014, 0.10, HOB_X + 0.13, 1.157, FACE(0.50)),
  );
  return { wall, floor };
}

// ── 5. living hall ─────────────────────────────────────────────────────────────
// The only room with nothing technical in it. It is the "after" the whole
// company sells, so it is the one that has to look warm rather than competent.
function buildLiving(ctx) {
  const { box, pipe, m, FACE, SOCKET_X, SOCKET_Y } = ctx;
  const wall = new Group();
  const floor = new Group();

  // Everything free-standing rides the floor group, so the furnished room
  // travels with the floor reveal as one plate instead of hovering over a hole.
  floor.add(box(m.rug, 1.46, 0.014, 1.34, 0.16, 0.042, -0.02));

  // The sofa is built facing local +Z and then turned to stand along the return
  // wall. Against the back wall it would face the camera's TV and show the
  // viewer nothing but its own back — an L is what puts a seat in the picture.
  const sofa = new Group();
  sofa.add(instanced(ctx, m.fabric, [
    { p: [0, 0.225, 0.05], s: [1.26, 0.20, 0.58] },     // seat
    { p: [0, 0.400, -0.28], s: [1.34, 0.56, 0.18] },    // back
    { p: [-0.60, 0.295, 0.0], s: [0.14, 0.34, 0.74] },  // arms
    { p: [0.60, 0.295, 0.0], s: [0.14, 0.34, 0.74] },
    { p: [0, 0.730, -0.29], s: [1.34, 0.10, 0.22] },    // back roll
  ]));
  sofa.add(instanced(ctx, m.timber, [
    { p: [-0.56, 0.135, 0.26], s: [0.06, 0.13, 0.06] },
    { p: [0.56, 0.135, 0.26], s: [0.06, 0.13, 0.06] },
    { p: [-0.56, 0.135, -0.26], s: [0.06, 0.13, 0.06] },
    { p: [0.56, 0.135, -0.26], s: [0.06, 0.13, 0.06] },
  ]));
  sofa.rotation.y = Math.PI / 2;
  // The return wall's tiled face is at x -0.858; any further left and the
  // sofa's back is driven through it.
  sofa.position.set(-0.44, 0, 0.02);
  floor.add(sofa);

  floor.add(instanced(ctx, m.timber, [
    { p: [0.42, 0.395, 0.02], s: [0.52, 0.035, 0.88] },   // coffee table top
    { p: [0.42, 0.20, -0.36], s: [0.05, 0.36, 0.05] },
    { p: [0.42, 0.20, 0.40], s: [0.05, 0.36, 0.05] },
  ]));

  // A lamp in the far corner gives the room a vertical, and the planter breaks
  // the run of straight edges.
  floor.add(
    pipe(m.substrate, 0.035, 0.03, -0.66, 0.05, -0.64),
    pipe(m.substrate, 0.018, 1.28, -0.66, 0.69, -0.64),
    pipe(m.porcelain, 0.14, 0.22, -0.66, 1.42, -0.64),
    pipe(m.timber, 0.09, 0.30, 0.90, 0.19, 0.78),
    pipe(m.rug, 0.13, 0.26, 0.90, 0.46, 0.78),
  );

  // The one thing on the wall, landing on the penetration the shell already
  // cuts — a television needs no new hole.
  wall.add(
    box(m.dark, 1.06, 0.60, 0.035, SOCKET_X, SOCKET_Y, FACE(0.28)),
    box(m.substrateShade, 0.22, 0.020, 0.020, SOCKET_X, SOCKET_Y - 0.31, FACE(0.28)),
    box(m.timber, 1.20, 0.06, 0.16, SOCKET_X, 0.62, FACE(0.32)),   // console shelf
  );
  return { wall, floor };
}

export const ROOMS = [
  {
    key: 'bath',
    name: 'Washroom',
    floor: '--build-tile',
    wall: '--build-walltile',
    caption: 'A bathroom corner, layer by layer — slab, screed, waterproofing, tile.',
    reveal: 'Waterproof membrane, turned up onto the wall. This is what stops seepage.',
    build: buildBath,
  },
  {
    key: 'electrical',
    name: 'Electrical',
    floor: '--room-elec-floor',
    wall: '--room-elec-wall',
    caption: 'An electrical board — breakers, surface casing, and an earth run to the rod.',
    reveal: 'Conduit and cable, chased into the wall before the finish goes on.',
    build: buildElectrical,
  },
  {
    key: 'toilet',
    name: 'Toilet',
    floor: '--room-wc-floor',
    wall: '--room-wc-wall',
    caption: 'A separate WC — close-coupled pan, hand basin, stone floor under plum tile.',
    reveal: 'The soil pipe behind the pan, and the waste the basin runs into.',
    build: buildToilet,
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    floor: '--room-kitchen-floor',
    wall: '--room-kitchen-wall',
    caption: 'A modular kitchen run — carcass, worktop, sink and hob against a tiled wall.',
    reveal: 'Supply and waste feeding the sink, behind the cabinet that hides them.',
    build: buildKitchen,
  },
  {
    key: 'living',
    name: 'Living hall',
    floor: '--room-living-floor',
    wall: '--room-living-wall',
    caption: 'A finished living hall — timber floor, painted walls, and not one visible service.',
    reveal: 'The floor build-up under the timber, and the wiring behind the panel.',
    build: buildLiving,
  },
];
