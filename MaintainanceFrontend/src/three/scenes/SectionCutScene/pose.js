import { Object3D } from 'three';
import { clamp01, easeOutCubic } from './easing';
import { FALL_FROM, FALL_TO, FLOOR, OPEN, SEAT, TILE } from './constants';

/** One scratch object, reused for every instance matrix written below. */
const dummy = new Object3D();

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

/**
 * The only writer to the scene graph. Everything a frame changes — group
 * positions, instance matrices, tile colour, emissive strength, the fall line —
 * is applied here from a pose, so no other code has to know how the model is
 * assembled.
 */
export function applyPose(model, pose) {
  const {
    world, tileMat, wallTileMat, membraneMat, liveMat, coldMat, hotMat, wasteMat,
    flashMat, fallMat, outlineMat, outlineGoldMat,
    gScreed, gMembrane, gAdhesive, gFloorTiles, gServices, hingeBack, gBoardBack, gTileBack,
    gBoardReturn, gTileReturn,
    floorTiles, floorCells, wallTilesBack, backTileDefs, wallTilesReturn, returnTileDefs,
    kits, membraneEdges, flashes, fallLine, roomFloor, roomWall,
  } = model;

  gScreed.position.y = FLOOR.screed.base + pose.floor.screed * FLOOR.screed.lift * pose.explode;
  gMembrane.position.y = FLOOR.membrane.base + pose.floor.membrane * FLOOR.membrane.lift * pose.explode;
  gAdhesive.position.y = FLOOR.adhesive.base + pose.floor.adhesive * FLOOR.adhesive.lift * pose.explode;
  gFloorTiles.position.y = FLOOR.tiles.base + pose.floor.tiles * FLOOR.tiles.lift * pose.explode;

  gServices.position.z = SEAT.services + pose.back.services * OPEN.services * pose.explode;
  hingeBack.rotation.y = -pose.swing * 0.62;
  gBoardBack.position.z = SEAT.board + pose.back.board * OPEN.board * pose.explode;
  gTileBack.position.z = SEAT.wallTile + pose.back.tiles * OPEN.wallTile * pose.explode;
  gBoardReturn.position.z = SEAT.board + pose.ret.board * OPEN.board * pose.explode;
  gTileReturn.position.z = SEAT.wallTile + pose.ret.tiles * OPEN.wallTile * pose.explode;

  // The instance buffers are only ever written while the tiles are landing.
  if (model.laid !== 1 || pose.lay !== 1) {
    layRun(floorTiles, floorCells, pose.lay, true);
    layRun(wallTilesBack, backTileDefs, pose.lay, false);
    layRun(wallTilesReturn, returnTileDefs, pose.lay, false);
    model.laid = pose.lay === 1 ? 1 : 0;
  }

  // Only the two rooms involved in a handover are in the graph at all; the
  // other three are switched off, so they cost nothing to keep built.
  const landing = pose.fixtures.basin;   // the assemble's fixture beat
  for (let i = 0; i < kits.length; i += 1) {
    const active = i === pose.room;
    const arriving = i === pose.next && pose.swap > 0;
    const on = active || arriving;
    kits[i].wall.visible = on;
    kits[i].floor.visible = on;
    if (!on) continue;
    // Fit-out folds away and unfolds rather than fading: nothing here is
    // ever transparent, so no material flips its program mid-loop.
    const k = active ? Math.min(pose.outScale, landing) : pose.inScale;
    const scale = Math.max(0.0001, k);
    kits[i].wall.scale.setScalar(scale);
    kits[i].floor.scale.setScalar(scale);
  }

  // The two shared tile surfaces carry the room change as a colour.
  const from = roomFloor[pose.room];
  const to = roomFloor[pose.next];
  if (from && to) tileMat.color.lerpColors(from, to, pose.swap);
  const wFrom = roomWall[pose.room];
  const wTo = roomWall[pose.next];
  if (wFrom && wTo) wallTileMat.color.lerpColors(wFrom, wTo, pose.swap);

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
    fallMat.opacity = pose.fall.alpha * (model.isDark ? 0.75 : 0.9);
    fallLine.scale.set(0.35 * pose.fall.len, 0.006, 0.022);
    fallLine.position.set(
      FALL_FROM.x + (FALL_TO.x - FALL_FROM.x) * pose.fall.u,
      FLOOR.tiles.base + 0.04 + pose.floor.tiles * FLOOR.tiles.lift * pose.explode,
      FALL_FROM.z + (FALL_TO.z - FALL_FROM.z) * pose.fall.u,
    );
  }

  world.position.y = pose.bob;
}
