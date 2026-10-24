/** 可单元测试的纯战斗 / 数值逻辑。 */

export const MAX_COUNT = 999999;

export const OPS = {
  '+': (count, value) => count + value,
  '-': (count, value) => count - value,
  x: (count, value) => count * value,
  '/': (count, value) => count / value,
};

/** 解析 '+5' / '-10' / 'x2' / '/2'。非法值会抛错，测试会覆盖所有关卡数据。 */
export function parseOp(token) {
  if (typeof token !== 'string') throw new TypeError('op token must be a string');
  const match = token.trim().match(/^([+\-x/])\s*(\d+(?:\.\d+)?)$/i);
  if (!match) throw new Error(`非法门运算: ${token}`);
  const op = match[1].toLowerCase() === 'x' ? 'x' : match[1];
  const value = Number(match[2]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`非法门数值: ${token}`);
  return { op, value };
}

export function applyGateCount(count, token) {
  const { op, value } = parseOp(token);
  const fn = OPS[op];
  const next = fn(Number(count), value);
  if (!Number.isFinite(next)) return 1;
  // 门不会直接把人清零，至少留 1 个兵，让玩家还有机会躲开后续敌人。
  return Math.min(MAX_COUNT, Math.max(1, Math.round(next)));
}

export function gateLabel(token) {
  const { op, value } = parseOp(token);
  if (op === 'x') return `×${trimNumber(value)}`;
  if (op === '/') return `÷${trimNumber(value)}`;
  if (op === '-') return `-${trimNumber(value)}`;
  return `+${trimNumber(value)}`;
}

export function isPositiveGate(token) {
  const { op } = parseOp(token);
  return op === '+' || op === 'x';
}

export function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

/** 两兵相接：人数严格多的一方获胜，损失约 40% 的敌军人数。 */
export function resolveEnemy(count, enemyCount, ratio = 0.4) {
  const mine = Math.max(0, Math.floor(count));
  const theirs = Math.max(0, Math.floor(enemyCount));
  if (mine > theirs) {
    const lost = Math.min(mine - 1, Math.max(1, Math.ceil(theirs * ratio)));
    return {
      win: true,
      remaining: mine - lost,
      lost,
      coins: theirs * 2,
      enemyLeft: 0,
    };
  }
  return { win: false, remaining: 0, lost: mine, coins: 0, enemyLeft: theirs - mine };
}

export function hazardLoss(count) {
  const mine = Math.max(1, Math.floor(count));
  if (mine <= 1) return 0;
  return Math.min(mine - 1, Math.max(3, Math.ceil(mine * 0.16) + 2));
}

/**
 * BOSS 模型：血量与每秒伤害都与进场兵力成比例，
 * 这样无论前面滚到多少人，最终战都有约 5 秒的观赏时间。
 */
export function bossModel(boss, entry) {
  const army = Math.max(1, entry);
  return {
    maxHp: Math.max(40, Math.round(army * (boss.hpFactor || 5))),
    incomingDps: Math.max(0.5, army * (boss.pressure || 0.05)),
    playerDps: army * 0.95,
  };
}

/**
 * 连续时间模拟 BOSS 战，供平衡测试使用。
 * shield / drone 单位为秒；复活后以 40% 进场兵力再战。
 */
export function simulateBoss({ entry, boss, shield = 0, drone = 0, revive = false, dt = 0.02 }) {
  let count = Math.max(1, entry);
  const model = bossModel(boss, entry);
  let hp = model.maxHp;
  let seconds = 0;
  let revived = false;
  let shieldLeft = shield;
  const droneLeft = drone;

  while (seconds < 240) {
    seconds += dt;
    const current = Math.max(0, count);
    const dpsBoost = droneLeft > 0 ? 1.25 : 1;
    hp -= current * 0.95 * dpsBoost * dt;
    if (hp <= 0) {
      return {
        win: true,
        survivors: Math.max(1, Math.floor(count)),
        ratio: Math.max(0, count) / Math.max(1, entry),
        seconds,
        revived,
      };
    }
    if (shieldLeft > 0) {
      shieldLeft -= dt;
    } else {
      count -= current * (boss.pressure || 0.05) * dt;
    }
    if (count <= 0.5) {
      if (revive && !revived) {
        revived = true;
        count = Math.max(2, entry * 0.4);
        continue;
      }
      return { win: false, survivors: 0, ratio: 0, seconds, revived };
    }
  }
  return { win: hp <= 0, survivors: Math.max(0, Math.floor(count)), ratio: 0, seconds, revived };
}

/** 星级：三星要求保留 65% 的 BOSS 进场兵力，二星 35%，过关至少一星。 */
export function starsFor({ won, survivors, bossEntry }) {
  if (!won) return 0;
  if (!bossEntry || bossEntry <= 0) return 1;
  const ratio = survivors / bossEntry;
  if (ratio >= 0.65) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

/** 本关金币结算：沿途金币 + 歼敌收益 + 通关奖励。失败也保留沿途金币。 */
export function runReward({ collected = 0, kills = 0, level = 1, won = false, stars = 0 }) {
  const base = Math.max(0, Math.floor(collected)) + Math.max(0, Math.floor(kills));
  if (!won) return { total: base, bonus: 0, base };
  const bonus = 40 + level * 10 + stars * 20;
  return { total: base + bonus, bonus, base };
}

export function formatCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 10000) return String(n);
  if (n < 100000000) {
    const w = n / 10000;
    return `${w >= 100 ? Math.floor(w) : w.toFixed(1).replace(/\.0$/, '')}万`;
  }
  return `${(n / 100000000).toFixed(2).replace(/\.?0+$/, '')}亿`;
}

export function formatCoins(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 10000) return String(n);
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
}

/** 从候选里按权重取一个，rng 可注入测试。 */
export function weightedPick(items, rng = Math.random) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight || 0), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1] || null;
}
