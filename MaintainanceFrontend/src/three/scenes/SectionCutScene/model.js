// Named imports, not a namespace import: rollup can only tree-shake three when
// it can see exactly which classes are reached.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, CircleGeometry, CylinderGeometry,
  DirectionalLight, DoubleSide, EdgesGeometry, ExtrudeGeometry, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshPhongMaterial, Object3D, RingGeometry, Scene, SphereGeometry,
} from 'three';
import { ROOMS } from './rooms';
import { BASIN_PROFILE, TAP_PROFILE, boardShape } from './profiles';
import {
  BASIN_X, CAVITY, COL, DRAIN, FALL_FROM, FALL_TO, HALF, RETURN_LEN, ROOM, ROW, SEAT,
  SOCKET_X, SOCKET_Y, TILE, TOP_ROW_H, TOP_ROW_Y, WALL_H,
} from './constants';

/**
 * Builds the whole model once and hands back every handle the rest of the scene
 * needs: the graph to render, the groups `pose.js` moves, the materials
 * `palette.js` paints, and the three lists to dispose on unmount.
 *
 * Nothing here reads the clock or the stylesheet — the model is built in a
 * neutral pose and a neutral palette, then posed and painted.
 *
 * @returns {object} the model, destructured by `paint` and `applyPose`.
 */
export function buildModel() {
  const scene = new Scene();

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
  const timberMat = lam();
  const fabricMat = lam();
  const liveMat = lam();
  const coldMat = lam();
  const hotMat = lam();
  const wasteMat = lam();
  // Lambert has no specular, and without one the mixer reads as tan plastic
  // and the basin as grey card. These two carry the finished-fixture read.
  const porcelainMat = new MeshPhongMaterial({ shininess: 60 });
  const brassMat = new MeshPhongMaterial({ shininess: 150 });
  const cutCapMat = new MeshBasicMaterial();
  const darkMat = lam();
  const rugMat = lam();
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
    wallTileMat, timberMat, fabricMat, liveMat, coldMat, hotMat, wasteMat,
    porcelainMat, brassMat, cutCapMat, darkMat, rugMat,
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
  gFloorTiles.add(floorTiles);

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

  // The finished face — board, tiles and everything fixed to them — hangs off a
  // hinge at the wall's left edge. Sliding it straight out of the wall would
  // park it in the middle of the room, in front of the cavity it is opening.
  // Hinged at the LEFT edge. The camera sits front-right, so this is the way
  // round that swings the panel AWAY from the eye and leaves the cavity in
  // clear view; hinging it right brings the tiled face into the lens instead.
  const hingeBack = new Group();
  hingeBack.position.set(-HALF, 0, 0);
  wallBack.add(hingeBack);
  const panelBack = new Group();
  panelBack.position.set(HALF, 0, 0);
  hingeBack.add(panelBack);

  const gBoardBack = new Group();
  gBoardBack.add(new Mesh(BOARD, boardMat), outline(ROOM, WALL_H, 0.015, 0, WALL_H / 2, 0.0075));
  panelBack.add(gBoardBack);

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
  panelBack.add(gTileBack);

  const gTileReturn = new Group();
  const wallTilesReturn = new InstancedMesh(UNIT_BOX, wallTileMat, returnTileDefs.length);
  gTileReturn.add(wallTilesReturn);
  wallReturn.add(gTileReturn);

  // ── the five rooms ──
  // Every room is built once, here, and then shown or hidden. Building them
  // lazily would stutter the first transition, and there are only ~60 meshes
  // across all five.
  const ctx = {
    UNIT_BOX, BASIN, TAP_BODY, DISC,
    box, pipe, joint, outline,
    FACE: (z) => z - SEAT.wallTile,
    COL, ROW, BASIN_X, SOCKET_X, SOCKET_Y, DRAIN,
    m: {
      substrate: substrateMat, substrateShade: substrateShadeMat, board: boardMat,
      porcelain: porcelainMat, brass: brassMat, live: liveMat, cold: coldMat,
      hot: hotMat, waste: wasteMat, disc: discMat, timber: timberMat,
      fabric: fabricMat, dark: darkMat, rug: rugMat,
    },
  };
  const kits = ROOMS.map((room) => {
    const built = room.build(ctx);
    gTileBack.add(built.wall);
    gFloorTiles.add(built.floor);
    return built;
  });

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
  const fallLine = new Mesh(UNIT_BOX, fallMat);
  fallLine.rotation.y = Math.atan2(-(FALL_TO.z - FALL_FROM.z), FALL_TO.x - FALL_FROM.x);
  fallLine.visible = false;
  fallLine.renderOrder = 4;
  world.add(fallLine);

  return {
    scene,
    world,
    // lights
    hemi,
    key,
    fill,
    // materials, by the name the rest of the scene knows them
    substrateMat,
    substrateShadeMat,
    screedMat,
    membraneMat,
    adhesiveMat,
    tileMat,
    boardMat,
    wallTileMat,
    timberMat,
    fabricMat,
    liveMat,
    coldMat,
    hotMat,
    wasteMat,
    porcelainMat,
    brassMat,
    cutCapMat,
    darkMat,
    rugMat,
    discMat,
    flashMat,
    fallMat,
    outlineMat,
    outlineGoldMat,
    // the groups a pose moves
    gScreed,
    gMembrane,
    gAdhesive,
    gFloorTiles,
    gServices,
    hingeBack,
    gBoardBack,
    gTileBack,
    gBoardReturn,
    gTileReturn,
    // tile runs: the instanced mesh and the cells it lays
    floorTiles,
    floorCells,
    wallTilesBack,
    backTileDefs,
    wallTilesReturn,
    returnTileDefs,
    // fit-out and effects
    kits,
    membraneEdges,
    flashes,
    fallLine,
    // written by paint(), read by applyPose()
    roomFloor: [],
    roomWall: [],
    isDark: false,
    // applyPose's own memo: -1 unlaid, 0 mid-lay, 1 laid and left alone
    laid: -1,
    // Nine geometries are shared across ~90 meshes, so a scene.traverse() would
    // dispose the same buffer dozens of times. These three lists are disposed once.
    geometries,
    materials,
    instances: [floorTiles, adhesiveRibs, blockwork, wallTilesBack, wallTilesReturn, cutCaps],
  };
}
