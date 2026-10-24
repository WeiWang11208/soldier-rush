import { describe, expect, test } from 'bun:test';
import { LEVELS } from '../js/levels.js';
import { applyGateCount, bossModel, simulateBoss, starsFor } from '../js/combat.js';

/** 理想路线：每道门都选当前人数最多的结果（不含道具、敌人和障碍损耗）。 */
function idealRun(level) {
  let count = level.start;
  const path = [];
  for (const gate of level.gates) {
    let bestToken = gate.lanes[0];
    let best = -1;
    for (const token of gate.lanes) {
      const next = applyGateCount(count, token);
      if (next > best) {
        best = next;
        bestToken = token;
      }
    }
    path.push(bestToken);
    count = best;
  }
  return { count, path };
}

describe('关卡平衡', () => {
  test('每关都存在能滚大雪球的路线', () => {
    for (const level of LEVELS) {
      const { count, path } = idealRun(level);
      expect(path).toHaveLength(level.gates.length);
      expect(count).toBeGreaterThan(level.start);
      expect(count).toBeLessThanOrEqual(999999);
    }
  });

  test('按理想路线进入 BOSS 都能在合理时间内获胜', () => {
    for (const level of LEVELS) {
      const { count } = idealRun(level);
      const result = simulateBoss({ entry: count, boss: level.boss });
      expect(result.win).toBe(true);
      expect(result.seconds).toBeGreaterThan(3.5);
      expect(result.seconds).toBeLessThan(12);
      const stars = starsFor({ won: true, survivors: result.survivors, bossEntry: count });
      expect(stars).toBeGreaterThanOrEqual(1);
      const model = bossModel(level.boss, count);
      expect(model.maxHp).toBeGreaterThan(0);
    }
  });

  test('后期关卡的理想兵力显著高于前期', () => {
    const first = idealRun(LEVELS[0]).count;
    const last = idealRun(LEVELS[LEVELS.length - 1]).count;
    expect(last).toBeGreaterThan(first * 20);
  });

  test('最终 BOSS 需要护盾/无人机才能三星', () => {
    const level = LEVELS[LEVELS.length - 1];
    const { count } = idealRun(level);
    const plain = simulateBoss({ entry: count, boss: level.boss });
    const shielded = simulateBoss({ entry: count, boss: level.boss, shield: 10 });
    const plainStars = starsFor({ won: plain.win, survivors: plain.survivors, bossEntry: count });
    const shieldStars = starsFor({ won: shielded.win, survivors: shielded.survivors, bossEntry: count });
    expect(plainStars).toBeLessThan(3);
    expect(shieldStars).toBe(3);
  });
});
