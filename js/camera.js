/** 伪 3D 投影。道路横向 x ∈ [-5, 5]，d 为相对相机的深度。 */

export const CAM_DEPTH = 5;
export const PLAYER_D = 1.2;
export const HORIZON_FRAC = 0.285;
export const GROUND_FRAC = 0.865;
export const ROAD_SCREEN_HALF = 0.465;

export function perspective(d) {
  const depth = Math.max(0.2, d);
  return CAM_DEPTH / (CAM_DEPTH + depth);
}

export function depthOf(z, playerZ) {
  return Math.max(0.25, z - playerZ + PLAYER_D);
}

export function screenY(d, height) {
  const horizon = height * HORIZON_FRAC;
  const ground = height * GROUND_FRAC;
  return horizon + (ground - horizon) * perspective(d);
}

export function roadHalf(d, width) {
  return width * ROAD_SCREEN_HALF * perspective(d);
}

export function screenX(x, d, width) {
  return width / 2 + (x / 5) * roadHalf(d, width);
}

/** 通用缩放：W=400 时，玩家平面的单位约为 1。 */
export function scaleAt(d, width) {
  return perspective(d) * (width / 400);
}

export function lanesFor(count) {
  if (count === 3) return [-3.2, 0, 3.2];
  if (count === 2) return [-2.5, 2.5];
  return [0];
}

export function nearestLane(x, count) {
  const lanes = lanesFor(count);
  let best = 0;
  let bestDist = Infinity;
  lanes.forEach((lane, index) => {
    const dist = Math.abs(lane - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}
