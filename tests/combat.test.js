import { describe, expect, test } from 'bun:test';
import {
  MAX_COUNT,
  applyGateCount,
  bossModel,
  formatCoins,
  formatCount,
  gateLabel,
  hazardLoss,
  isPositiveGate,
  parseOp,
  resolveEnemy,
  runReward,
  simulateBoss,
  starsFor,
  weightedPick,
} from '../js/combat.js';
import { levelById } from '../js/levels.js';

describe('倍数门', () => {
  test('解析四种运算', () => {
    expect(parseOp('+5')).toEqual({ op: '+', value: 5 });
    expect(parseOp('-10')).toEqual({ op: '-', value: 10 });
    expect(parseOp('x2')).toEqual({ op: 'x', value: 2 });
    expect(parseOp('X3')).toEqual({ op: 'x', value: 3 });
    expect(parseOp('/2')).toEqual({ op: '/', value: 2 });
  });

  test('非法表达式会报错', () => {
    for (const token of ['', 'x', '5', '++5', 'y2', 'x0']) {
      expect(() => parseOp(token)).toThrow();
    }
  });

  test('结算、下限和上限', () => {
    expect(applyGateCount(10, '+5')).toBe(15);
    expect(applyGateCount(10, '-20')).toBe(1);
    expect(applyGateCount(10, 'x2')).toBe(20);
    expect(applyGateCount(10, '/3')).toBe(3);
    expect(applyGateCount(MAX_COUNT, 'x2')).toBe(MAX_COUNT);
  });

  test('标签与正负判断', () => {
    expect(gateLabel('+5')).toBe('+5');
    expect(gateLabel('x2')).toBe('×2');
    expect(gateLabel('/2')).toBe('÷2');
    expect(gateLabel('-10')).toBe('-10');
    expect(isPositiveGate('+3')).toBe(true);
    expect(isPositiveGate('x3')).toBe(true);
    expect(isPositiveGate('-3')).toBe(false);
    expect(isPositiveGate('/3')).toBe(false);
  });
});

describe('敌军与障碍', () => {
  test('严格多人才获胜，损失约四成', () => {
    expect(resolveEnemy(100, 50)).toMatchObject({ win: true, lost: 20, remaining: 80, coins: 100 });
    expect(resolveEnemy(50, 50).win).toBe(false);
    expect(resolveEnemy(49, 50).win).toBe(false);
    expect(resolveEnemy(1, 0).win).toBe(true);
  });

  test('障碍按比例减员但至少保留 1 人', () => {
    expect(hazardLoss(1)).toBe(0);
    expect(hazardLoss(10)).toBeGreaterThanOrEqual(3);
    expect(hazardLoss(1000)).toBeLessThan(1000);
    expect(hazardLoss(3)).toBe(2);
  });
});

describe('BOSS 数值', () => {
  test('血量与伤害随进场兵力缩放', () => {
    const boss = levelById(1).boss;
    const small = bossModel(boss, 100);
    const large = bossModel(boss, 1000);
    expect(large.maxHp).toBe(small.maxHp * 10);
    expect(large.incomingDps).toBeCloseTo(small.incomingDps * 10, 6);
    expect(large.playerDps).toBe(950);
    expect(large.maxHp / large.playerDps).toBeCloseTo(5.263, 2);
  });

  test('正常兵力能打赢第一关 BOSS，护盾提高留存', () => {
    const boss = levelById(1).boss;
    const noShield = simulateBoss({ entry: 100, boss });
    const withShield = simulateBoss({ entry: 100, boss, shield: 10 });
    expect(noShield.win).toBe(true);
    expect(noShield.seconds).toBeGreaterThan(4);
    expect(noShield.seconds).toBeLessThan(7);
    expect(withShield.win).toBe(true);
    expect(withShield.ratio).toBeGreaterThan(noShield.ratio);
    expect(starsFor({ won: true, survivors: withShield.survivors, bossEntry: 100 })).toBe(3);
  });

  test('高压 BOSS 下复活兵符会触发且延长战斗', () => {
    const harsh = { name: '测试暴君', hpFactor: 5, pressure: 1.01 };
    const without = simulateBoss({ entry: 100, boss: harsh });
    const withRevive = simulateBoss({ entry: 100, boss: harsh, revive: true });
    expect(without.win).toBe(false);
    expect(withRevive.revived).toBe(true);
    expect(withRevive.seconds).toBeGreaterThan(without.seconds);
  });

  test('无人机提高输出', () => {
    const boss = levelById(10).boss;
    const normal = simulateBoss({ entry: 1000, boss });
    const drone = simulateBoss({ entry: 1000, boss, drone: 10 });
    expect(drone.seconds).toBeLessThan(normal.seconds);
  });
});

describe('星级与奖励', () => {
  test('按 BOSS 进场留存给星', () => {
    expect(starsFor({ won: false, survivors: 100, bossEntry: 100 })).toBe(0);
    expect(starsFor({ won: true, survivors: 65, bossEntry: 100 })).toBe(3);
    expect(starsFor({ won: true, survivors: 64, bossEntry: 100 })).toBe(2);
    expect(starsFor({ won: true, survivors: 35, bossEntry: 100 })).toBe(2);
    expect(starsFor({ won: true, survivors: 34, bossEntry: 100 })).toBe(1);
    expect(starsFor({ won: true, survivors: 0, bossEntry: 0 })).toBe(1);
  });

  test('通关奖励随关卡和星级增加，失败无奖励', () => {
    const one = runReward({ collected: 10, kills: 6, level: 1, won: true, stars: 1 });
    const three = runReward({ collected: 10, kills: 6, level: 1, won: true, stars: 3 });
    expect(one.total).toBe(16 + 40 + 10 + 20);
    expect(three.total - one.total).toBe(40);
    expect(runReward({ collected: 10, kills: 6, level: 5, won: false }).total).toBe(16);
  });
});

describe('格式化与随机', () => {
  test('人数和金币缩写', () => {
    expect(formatCount(9999)).toBe('9999');
    expect(formatCount(10000)).toBe('1万');
    expect(formatCount(12345)).toBe('1.2万');
    expect(formatCount(123456)).toBe('12.3万');
    expect(formatCount(100000000)).toBe('1亿');
    expect(formatCoins(12345)).toBe('1.2万');
  });

  test('weightedPick 可注入 rng', () => {
    const items = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 3 },
    ];
    expect(weightedPick(items, () => 0).id).toBe('a');
    expect(weightedPick(items, () => 0.5).id).toBe('b');
    expect(weightedPick([], () => 0)).toBeNull();
  });
});
