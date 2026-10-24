import { describe, expect, test } from 'bun:test';
import {
  CAM_DEPTH,
  GROUND_FRAC,
  HORIZON_FRAC,
  PLAYER_D,
  depthOf,
  lanesFor,
  nearestLane,
  perspective,
  roadHalf,
  scaleAt,
  screenX,
  screenY,
} from '../js/camera.js';

describe('伪 3D 投影', () => {
  test('透视随深度递减', () => {
    expect(perspective(0.2)).toBe(CAM_DEPTH / (CAM_DEPTH + 0.2));
    expect(perspective(1)).toBeGreaterThan(perspective(10));
    expect(perspective(100)).toBeGreaterThan(0);
  });

  test('深度不会小于玩家平面', () => {
    expect(depthOf(0, 0)).toBe(PLAYER_D);
    expect(depthOf(100, 0)).toBe(100 + PLAYER_D);
    expect(depthOf(0, 10)).toBe(0.25);
  });

  test('屏幕坐标：中轴、地平线和近端', () => {
    const width = 400;
    const height = 800;
    expect(screenX(0, 1, width)).toBe(width / 2);
    expect(screenY(0.2, height)).toBeCloseTo(height * (HORIZON_FRAC + (GROUND_FRAC - HORIZON_FRAC) * perspective(0.2)));
    expect(roadHalf(1, width)).toBe(width * 0.465 * perspective(1));
    expect(scaleAt(1, 400)).toBe(perspective(1));
  });

  test('车道与最近车道', () => {
    expect(lanesFor(3)).toEqual([-3.2, 0, 3.2]);
    expect(lanesFor(2)).toEqual([-2.5, 2.5]);
    expect(lanesFor(1)).toEqual([0]);
    expect(nearestLane(-2.4, 2)).toBe(0);
    expect(nearestLane(2.4, 2)).toBe(1);
    expect(nearestLane(1.0, 3)).toBe(1);
    expect(nearestLane(-2.8, 3)).toBe(0);
    expect(nearestLane(2.8, 3)).toBe(2);
  });
});
