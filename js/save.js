/** 本地存档：结构清洗、读写、结算。使用注入的 storage，便于测试。 */

import { ITEMS, MAX_ITEM_STACK, UPGRADES, UPGRADE_MAP } from './items.js';
import { LEVELS } from './levels.js';

export const SAVE_KEY = 'soldier-rush-save-v1';
export const SAVE_VERSION = 1;

export function createSave() {
  return {
    version: SAVE_VERSION,
    coins: 50,
    unlocked: 1,
    stars: {},
    best: {},
    items: Object.fromEntries(ITEMS.map((item) => [item.id, 0])),
    upgrades: Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, 0])),
    loadout: [],
    mute: false,
    totalRuns: 0,
    createdAt: Date.now(),
  };
}

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function sanitizeSave(raw) {
  const save = createSave();
  if (!raw || typeof raw !== 'object') return save;

  save.coins = clampInt(raw.coins, 0, 99999999, save.coins);
  save.unlocked = clampInt(raw.unlocked, 1, LEVELS.length, 1);
  save.mute = Boolean(raw.mute);
  save.totalRuns = clampInt(raw.totalRuns, 0, 999999, 0);
  save.createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : save.createdAt;

  if (raw.stars && typeof raw.stars === 'object') {
    for (const level of LEVELS) {
      const star = clampInt(raw.stars[level.id], 0, 3, 0);
      if (star > 0) save.stars[level.id] = star;
    }
  }

  if (raw.best && typeof raw.best === 'object') {
    for (const level of LEVELS) {
      const best = clampInt(raw.best[level.id], 0, 999999, 0);
      if (best > 0) save.best[level.id] = best;
    }
  }

  if (raw.items && typeof raw.items === 'object') {
    for (const item of ITEMS) {
      save.items[item.id] = clampInt(raw.items[item.id], 0, MAX_ITEM_STACK, 0);
    }
  }

  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const upgrade of UPGRADES) {
      save.upgrades[upgrade.id] = clampInt(raw.upgrades[upgrade.id], 0, upgrade.max, 0);
    }
  }

  if (Array.isArray(raw.loadout)) {
    const seen = new Set();
    for (const id of raw.loadout) {
      if (save.loadout.length >= 2) break;
      if (!ITEMS.some((item) => item.id === id) || seen.has(id)) continue;
      seen.add(id);
      save.loadout.push(id);
    }
  }

  return save;
}

export function loadSave(storage) {
  if (!storage) return createSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createSave();
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return createSave();
  }
}

export function persistSave(save, storage) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function totalStars(save) {
  return Object.values(save.stars || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function isLevelUnlocked(save, levelId) {
  return levelId <= (save.unlocked || 1) && levelId >= 1 && levelId <= LEVELS.length;
}

/**
 * 关卡结束结算。coinsEarned 已包含沿途金币和通关奖励。
 * 返回本次新增的星级、是否破纪录、是否解锁下一关。
 */
export function recordResult(save, levelId, { won = false, stars = 0, coinsEarned = 0, survivors = 0 } = {}) {
  const beforeStars = save.stars[levelId] || 0;
  const beforeBest = save.best[levelId] || 0;
  save.coins = clampInt(save.coins + Math.max(0, Math.floor(coinsEarned)), 0, 99999999, save.coins);
  save.totalRuns = (save.totalRuns || 0) + 1;
  const result = {
    stars: 0,
    newBest: false,
    unlockedNext: false,
    nextLevel: null,
  };

  if (won) {
    const star = clampInt(stars, 1, 3, 1);
    if (star > beforeStars) {
      save.stars[levelId] = star;
      result.stars = star;
    }
    if (survivors > beforeBest) {
      save.best[levelId] = Math.floor(survivors);
      result.newBest = true;
    }
    if (levelId >= save.unlocked && levelId < LEVELS.length) {
      save.unlocked = levelId + 1;
      result.unlockedNext = true;
      result.nextLevel = levelId + 1;
    }
  }

  return result;
}

export function resetSave(storage) {
  const save = createSave();
  persistSave(save, storage);
  return save;
}

export function describeUpgrade(save, upgrade) {
  const rank = save.upgrades[upgrade.id] || 0;
  const cost = rank >= upgrade.max ? null : upgrade.costs[rank];
  return {
    rank,
    max: upgrade.max,
    cost,
    maxed: cost == null,
    nextText: cost == null ? '已满级' : `升级 ${cost} 金币`,
  };
}

export function validateSaveShape(save) {
  const errors = [];
  if (!save || typeof save !== 'object') errors.push('save 不是对象');
  if (!Array.isArray(save.loadout)) errors.push('loadout 不是数组');
  for (const upgrade of UPGRADES) {
    const rank = save.upgrades?.[upgrade.id];
    if (!Number.isInteger(rank) || rank < 0 || rank > upgrade.max) {
      errors.push(`升级 ${upgrade.id} 超出范围`);
    }
  }
  if (save.unlocked < 1 || save.unlocked > LEVELS.length) errors.push('unlocked 超出范围');
  return errors;
}

export function upgradeLabel(save, id) {
  const upgrade = UPGRADE_MAP[id];
  if (!upgrade) return '';
  return `${upgrade.name} Lv.${save.upgrades[id] || 0}`;
}
