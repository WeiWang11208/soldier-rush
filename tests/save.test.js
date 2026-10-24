import { describe, expect, test } from 'bun:test';
import {
  SAVE_KEY,
  createSave,
  isLevelUnlocked,
  loadSave,
  persistSave,
  recordResult,
  resetSave,
  sanitizeSave,
  totalStars,
  validateSaveShape,
} from '../js/save.js';
import { ITEMS } from '../js/items.js';

function memoryStorage(initial = null) {
  const map = new Map();
  if (initial != null) map.set(SAVE_KEY, initial);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => map,
  };
}

describe('存档创建与清洗', () => {
  test('初始存档结构', () => {
    const save = createSave();
    expect(save.version).toBe(1);
    expect(save.coins).toBe(50);
    expect(save.unlocked).toBe(1);
    expect(save.loadout).toEqual([]);
    expect(validateSaveShape(save)).toEqual([]);
    expect(Object.keys(save.items)).toHaveLength(ITEMS.length);
  });

  test('损坏或越界数据被清洗', () => {
    const save = sanitizeSave({
      coins: -100,
      unlocked: 99,
      stars: { 1: 9, 2: -1, 3: '2', 999: 3 },
      best: { 1: 123.8, 2: -5 },
      items: { airdrop: 100, shield: -1, unknown: 3 },
      upgrades: { start: 99, coin: -1, duration: 2 },
      loadout: ['airdrop', 'airdrop', 'nope', 'shield', 'dash'],
      mute: 1,
      totalRuns: -4,
    });
    expect(save.coins).toBe(0);
    expect(save.unlocked).toBe(10);
    expect(save.stars).toEqual({ 1: 3, 3: 2 });
    expect(save.best).toEqual({ 1: 123 });
    expect(save.items.airdrop).toBe(9);
    expect(save.items.shield).toBe(0);
    expect(save.upgrades.start).toBe(5);
    expect(save.upgrades.coin).toBe(0);
    expect(save.loadout).toHaveLength(2);
    expect(save.loadout).toEqual(['airdrop', 'shield']);
    expect(save.mute).toBe(true);
    expect(save.totalRuns).toBe(0);
    expect(validateSaveShape(save)).toEqual([]);
  });

  test('非对象输入返回默认存档', () => {
    expect(sanitizeSave(null).coins).toBe(50);
    expect(sanitizeSave('bad').unlocked).toBe(1);
    expect(sanitizeSave([]).coins).toBe(50);
  });
});

describe('读写', () => {
  test('往返读写并保留数据', () => {
    const storage = memoryStorage();
    const save = createSave();
    save.coins = 321;
    save.items.shield = 2;
    expect(persistSave(save, storage)).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.coins).toBe(321);
    expect(loaded.items.shield).toBe(2);
  });

  test('无存储、坏 JSON、异常存储都安全兜底', () => {
    expect(loadSave(null).coins).toBe(50);
    expect(loadSave(memoryStorage('{oops')).coins).toBe(50);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(broken).coins).toBe(50);
    expect(persistSave(createSave(), null)).toBe(false);
    expect(persistSave(createSave(), broken)).toBe(false);
  });

  test('重置存档', () => {
    const storage = memoryStorage();
    const save = createSave();
    save.coins = 999;
    persistSave(save, storage);
    const reset = resetSave(storage);
    expect(reset.coins).toBe(50);
    expect(loadSave(storage).coins).toBe(50);
  });
});

describe('结算', () => {
  test('通关解锁下一关、提高星级和最佳兵力', () => {
    const save = createSave();
    const result = recordResult(save, 1, { won: true, stars: 2, coinsEarned: 100, survivors: 60 });
    expect(result.unlockedNext).toBe(true);
    expect(result.nextLevel).toBe(2);
    expect(result.newBest).toBe(true);
    expect(save.unlocked).toBe(2);
    expect(save.stars[1]).toBe(2);
    expect(save.best[1]).toBe(60);
    expect(save.coins).toBe(150);
    expect(save.totalRuns).toBe(1);
    expect(isLevelUnlocked(save, 2)).toBe(true);
    expect(isLevelUnlocked(save, 3)).toBe(false);
  });

  test('低星重打不覆盖高星，失败不解锁但保留金币', () => {
    const save = createSave();
    recordResult(save, 1, { won: true, stars: 3, coinsEarned: 10, survivors: 80 });
    const before = save.coins;
    const lower = recordResult(save, 1, { won: true, stars: 1, coinsEarned: 5, survivors: 20 });
    expect(lower.stars).toBe(0);
    expect(save.stars[1]).toBe(3);
    expect(save.best[1]).toBe(80);
    expect(save.coins).toBe(before + 5);

    const loss = recordResult(save, 2, { won: false, stars: 3, coinsEarned: 7, survivors: 0 });
    expect(loss.unlockedNext).toBe(false);
    expect(save.unlocked).toBe(2);
    expect(save.stars[2]).toBeUndefined();
    expect(save.coins).toBe(before + 12);
  });

  test('通关最后一关不会越界解锁', () => {
    const save = createSave();
    save.unlocked = 10;
    const result = recordResult(save, 10, { won: true, stars: 3, coinsEarned: 0, survivors: 1 });
    expect(result.unlockedNext).toBe(false);
    expect(save.unlocked).toBe(10);
  });

  test('星星合计', () => {
    const save = createSave();
    expect(totalStars(save)).toBe(0);
    save.stars = { 1: 3, 2: 2, 3: 1 };
    expect(totalStars(save)).toBe(6);
  });
});
