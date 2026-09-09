import { Vector3 } from 'three';

/**
 * The drawing the scene is built from, in metres. Every position in `model.js`
 * and every offset in `pose.js` resolves back to one of these, so a dimension is
 * changed here once rather than hunted through the geometry.
 */

// Origin is the centre of the finished floor, +Y up. The room occupies +X/+Z of
// the corner; the two walls sit along the -X and -Z edges.

export const ROOM = 2.20;
export const HALF = ROOM / 2;
export const WALL_H = 1.90;
export const CAVITY = 0.18;        // blockwork thickness, behind the board
export const RETURN_LEN = 1.20;    // the return wall is partial, with a cut end

export const TILE = 0.52;
export const GROUT = 0.018;
export const PITCH = TILE + GROUT;
export const MARGIN = (ROOM - (4 * TILE + 3 * GROUT)) / 2;
/** Centre of tile column/row i along a 2.20 run. */
const cell = (i) => -HALF + MARGIN + TILE / 2 + i * PITCH;

export const COL = [0, 1, 2, 3].map(cell);
export const ROW = [0, 1, 2].map((i) => 0.033 + TILE / 2 + i * PITCH);
export const TOP_ROW_Y = 0.033 + 3 * PITCH + 0.12;
export const TOP_ROW_H = 0.24;

export const BASIN_X = COL[1];     // the basin owns one tile column
export const SOCKET_X = COL[2];
export const SOCKET_Y = ROW[2];
export const DRAIN = { x: COL[0], z: COL[0] };   // the omitted floor tile

/** Wall-local z of each layer when seated, and how far it opens. */
export const SEAT = { services: 0.010, board: 0.180, wallTile: 0.205 };
export const OPEN = { services: 0.26, board: 0.52, wallTile: 0.78 };

/** Floor layers: seated height above the slab, and how far they fly apart. */
export const FLOOR = {
  screed: { base: 0.010, lift: 0.22 },
  membrane: { base: 0.110, lift: 0.44 },
  adhesive: { base: 0.155, lift: 0.66 },
  tiles: { base: 0.215, lift: 0.88 },
};

export const CENTRE = new Vector3(0, 0.96, 0);
export const VIEW = new Vector3(0.62, 0.42, 0.66).normalize();
export const FIT_WIDE = 2.06;
export const FIT_DENSE = 1.94;
export const UP = new Vector3(0, 1, 0);

/** The run the fall line traces: far corner of the floor down to the drain. */
export const FALL_FROM = new Vector3(0.85, 0, 0.85);
export const FALL_TO = new Vector3(DRAIN.x, 0, DRAIN.z);
