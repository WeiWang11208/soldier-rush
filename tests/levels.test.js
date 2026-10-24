import { describe, expect, test } from 'bun:test';
import { LEVELS, THEMES, expandCoins, levelById, themeFor } from '../js/levels.js';
import { applyGateCount, parseOp, MAX_COUNT } from '../js/combat.js';
import { CRATE_BUFFS, ITEM_MAP } from '../js/items.js';

describe('关卡数据', () => {
  test('恰好 10 关，id 连续且唯一', () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(10);
  });

  test('每关主题都存在且不重复', () => {
    const themes = LEVELS.map((level) => level.theme);
    expect(new Set(themes).size).toBe(10);
    for (const key of themes) {
      expect(THEMES[key]).toBeDefined();
      expect(THEMES[key].kind).toBeTruthy();
      expect(THEMES[key].sky).toHaveLength(2);
    }
  });

  test('每关的数值、门和 BOSS 合法', () => {
    for (const level of LEVELS) {
      expect(level.speed).toBeGreaterThan(0);
      expect(level.start).toBeGreaterThan(0);
      expect(level.length).toBe(level.boss.z);
      expect(level.boss.hpFactor).toBeGreaterThan(0);
      expect(level.boss.pressure).toBeGreaterThan(0);
      expect(level.boss.name.length).toBeGreaterThan(0);
      expect(level.gates.length).toBeGreaterThanOrEqual(3);

      let lastZ = 0;
      for (const gate of level.gates) {
        expect(gate.z).toBeGreaterThan(lastZ);
        expect(gate.z).toBeLessThan(level.boss.z);
        lastZ = gate.z;
        expect([2, 3]).toContain(gate.lanes.length);
        for (const token of gate.lanes) {
          const parsed = parseOp(token);
          expect(parsed.value).toBeGreaterThan(0);
          const next = applyGateCount(100, token);
          expect(next).toBeGreaterThanOrEqual(1);
          expect(next).toBeLessThanOrEqual(MAX_COUNT);
        }
        // 每道门至少要有一个不会减员的选项
        expect(gate.lanes.some((token) => token.startsWith('+') || token.startsWith('x'))).toBe(true);
      }

      for (const enemy of level.enemies || []) {
        expect(Math.abs(enemy.x)).toBeLessThanOrEqual(4.4);
        expect(enemy.count).toBeGreaterThan(0);
        expect(enemy.z).toBeGreaterThan(0);
        expect(enemy.z).toBeLessThan(level.boss.z);
      }
      for (const hazard of level.hazards || []) {
        expect(['saw', 'barrel']).toContain(hazard.type);
        expect(Math.abs(hazard.x)).toBeLessThanOrEqual(4.4);
      }
      for (const crate of level.crates || []) {
        expect(CRATE_BUFFS).toContain(crate.buff);
        expect(ITEM_MAP[crate.buff]).toBeDefined();
      }
      for (const run of level.coinRuns || []) {
        expect(run.n).toBeGreaterThan(0);
        expect(Math.abs(run.x)).toBeLessThanOrEqual(4.4);
      }
    }
  });

  test('开局兵力大致递增', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].start).toBeGreaterThanOrEqual(LEVELS[i - 1].start);
    }
  });

  test('金币展开数量与配置一致', () => {
    for (const level of LEVELS) {
      const expected = level.coinRuns.reduce((sum, run) => sum + run.n, 0);
      const coins = expandCoins(level);
      expect(coins).toHaveLength(expected);
      for (const coin of coins) {
        expect(Math.abs(coin.x)).toBeLessThanOrEqual(4.4);
      }
    }
  });

  test('levelById / themeFor 兜底', () => {
    expect(levelById(1).name).toBe('新兵出征');
    expect(levelById(999)).toBeNull();
    expect(themeFor(LEVELS[0])).toBe(THEMES.meadow);
    expect(themeFor({ theme: 'missing' })).toBe(THEMES.meadow);
  });
});
