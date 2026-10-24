import { describe, expect, test } from 'bun:test';
import {
  ITEMS,
  MAX_ITEM_STACK,
  UPGRADES,
  coinMultiplier,
  consumeItem,
  durationMultiplier,
  getItem,
  purchaseItem,
  purchaseUpgrade,
  startingSoldiers,
  toggleEquip,
  upgradeCost,
} from '../js/items.js';
import { createSave, sanitizeSave } from '../js/save.js';

describe('道具定义', () => {
  test('7 种道具，字段完整、id 唯一', () => {
    expect(ITEMS).toHaveLength(7);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(7);
    for (const item of ITEMS) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
      expect(['instant', 'timed', 'passive']).toContain(item.type);
      expect(item.desc.length).toBeGreaterThan(6);
    }
  });

  test('三种永久升级', () => {
    expect(UPGRADES).toHaveLength(3);
    for (const upgrade of UPGRADES) {
      expect(upgrade.costs).toHaveLength(upgrade.max);
      expect(upgradeCost(upgrade, 0)).toBe(upgrade.costs[0]);
      expect(upgradeCost(upgrade, upgrade.max)).toBeNull();
    }
  });
});

describe('购买道具', () => {
  test('金币不足 / 未知 / 满仓', () => {
    const save = createSave();
    expect(purchaseItem(save, 'shield').ok).toBe(false);
    expect(purchaseItem(save, 'nope').ok).toBe(false);
    save.coins = 99999;
    save.items.shield = MAX_ITEM_STACK;
    expect(purchaseItem(save, 'shield').ok).toBe(false);
    expect(purchaseItem(save, 'shield').reason).toBe('道具已满');
  });

  test('购买扣费并增加库存', () => {
    const save = createSave();
    save.coins = 200;
    const result = purchaseItem(save, 'shield');
    expect(result.ok).toBe(true);
    expect(save.coins).toBe(130);
    expect(save.items.shield).toBe(1);
  });
});

describe('购买升级', () => {
  test('逐级扣费、满级拒绝', () => {
    const save = createSave();
    save.coins = 10000;
    const first = purchaseUpgrade(save, 'start');
    expect(first.ok).toBe(true);
    expect(save.upgrades.start).toBe(1);
    expect(save.coins).toBe(10000 - 120);
    for (let i = 0; i < 4; i += 1) purchaseUpgrade(save, 'start');
    expect(save.upgrades.start).toBe(5);
    expect(purchaseUpgrade(save, 'start').ok).toBe(false);
    expect(purchaseUpgrade(save, 'nope').ok).toBe(false);
  });

  test('金币不足', () => {
    const save = createSave();
    expect(purchaseUpgrade(save, 'start').ok).toBe(false);
  });
});

describe('装备与消耗', () => {
  test('最多两个、不可重复、无库存不可装备', () => {
    const save = createSave();
    expect(toggleEquip(save, 'shield').ok).toBe(false);
    save.items.shield = 2;
    save.items.magnet = 2;
    save.items.dash = 2;
    expect(toggleEquip(save, 'shield')).toMatchObject({ ok: true, equipped: true });
    expect(toggleEquip(save, 'magnet').ok).toBe(true);
    expect(toggleEquip(save, 'dash').reason).toBe('最多装备 2 个道具');
    expect(toggleEquip(save, 'shield')).toMatchObject({ ok: true, equipped: false });
    expect(save.loadout).toEqual(['magnet']);
  });

  test('消耗到 0 自动卸下，0 库存消耗失败', () => {
    const save = createSave();
    save.items.shield = 2;
    toggleEquip(save, 'shield');
    expect(consumeItem(save, 'shield')).toBe(true);
    expect(save.items.shield).toBe(1);
    expect(save.loadout).toContain('shield');
    expect(consumeItem(save, 'shield')).toBe(true);
    expect(save.items.shield).toBe(0);
    expect(save.loadout).not.toContain('shield');
    expect(consumeItem(save, 'shield')).toBe(false);
  });
});

describe('升级效果', () => {
  test('开局兵力、金币倍率、时长倍率', () => {
    const save = createSave();
    const level = { start: 5 };
    expect(startingSoldiers(level, save)).toBe(5);
    expect(coinMultiplier(save)).toBe(1);
    expect(durationMultiplier(save)).toBe(1);
    save.upgrades.start = 3;
    save.upgrades.coin = 2;
    save.upgrades.duration = 1;
    expect(startingSoldiers(level, save)).toBe(11);
    expect(coinMultiplier(save)).toBeCloseTo(1.2);
    expect(durationMultiplier(save)).toBeCloseTo(1.1);
  });

  test('清洗后的存档兼容所有道具 id', () => {
    const save = sanitizeSave({ loadout: ['airdrop', 'double'] });
    expect(save.loadout).toEqual(['airdrop', 'double']);
    expect(getItem('double').type).toBe('passive');
  });
});
