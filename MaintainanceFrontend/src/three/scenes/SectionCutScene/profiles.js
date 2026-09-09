import { Path, Shape, Vector2 } from 'three';
import { BASIN_X, HALF, SOCKET_X, SOCKET_Y, WALL_H } from './constants';

/** Up the outside, over the rim and back down the inside — one direction, so
 *  the normals stay consistent. */
export const BASIN_PROFILE = [
  [0.001, -0.145], [0.062, -0.150], [0.140, -0.128], [0.205, -0.078], [0.245, -0.020],
  [0.258, 0.000], [0.262, 0.008], [0.252, 0.010], [0.226, 0.002], [0.180, -0.026],
  [0.001, -0.040],
].map(([r, y]) => new Vector2(r, y));

export const TAP_PROFILE = [
  [0.001, 0.000], [0.048, 0.000], [0.046, 0.014], [0.028, 0.030],
  [0.026, 0.150], [0.026, 0.200], [0.001, 0.200],
].map(([r, y]) => new Vector2(r, y));

/**
 * The cement board and the penetrations the first fix passes through. Holes
 * must wind opposite the outer shape or they render filled — and watching the
 * pipes thread through them is the payload of the whole assemble.
 */
export function boardShape() {
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
