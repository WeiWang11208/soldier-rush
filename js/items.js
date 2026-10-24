/** 道具与永久升级定义。所有数值集中在这里，方便调平衡。 */

export const ITEMS = [
  {
    id: 'airdrop',
    name: '空投增援',
    icon: '援',
    color: '#34d399',
    type: 'instant',
    price: 80,
    desc: '立即空投 15 名士兵，落地就能冲。',
    short: '+15 兵',
    duration: 0,
  },
  {
    id: 'shield',
    name: '能量护盾',
    icon: '盾',
    color: '#38bdf8',
    type: 'timed',
    price: 70,
    desc: '10 秒内免疫障碍、敌军和 BOSS 伤害。',
    short: '10 秒无敌',
    duration: 10,
  },
  {
    id: 'magnet',
    name: '磁力拾取',
    icon: '磁',
    color: '#fbbf24',
    type: 'timed',
    price: 60,
    desc: '12 秒内自动吸走附近金币与补给箱。',
    short: '12 秒吸取',
    duration: 12,
  },
  {
    id: 'dash',
    name: '闪电冲锋',
    icon: '冲',
    color: '#a78bfa',
    type: 'timed',
    price: 90,
    desc: '6 秒无敌冲刺，速度提升 70%。',
    short: '6 秒无敌',
    duration: 6,
  },
  {
    id: 'drone',
    name: '无人机',
    icon: '机',
    color: '#f472b6',
    type: 'timed',
    price: 120,
    desc: '15 秒自动清除前方敌人与障碍，BOSS 战增伤。',
    short: '15 秒护航',
    duration: 15,
  },
  {
    id: 'double',
    name: '双倍金币',
    icon: '金',
    color: '#facc15',
    type: 'passive',
    price: 100,
    desc: '本关金币收益 ×2，出征时自动生效。',
    short: '金币 ×2',
    duration: 0,
  },
  {
    id: 'revive',
    name: '复活兵符',
    icon: '活',
    color: '#fb7185',
    type: 'passive',
    price: 200,
    desc: '兵力归零时以 40% 兵力复活一次。',
    short: '自动复活',
    duration: 0,
  },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

export const CRATE_BUFFS = [
  'airdrop',
  'shield',
  'magnet',
  'dash',
  'drone',
  'double',
  'revive',
];

export const UPGRADES = [
  {
    id: 'start',
    name: '新兵训练',
    icon: '兵',
    color: '#22d3ee',
    desc: '每级开局兵力 +2',
    max: 5,
    costs: [120, 260, 480, 800, 1200],
  },
  {
    id: 'coin',
    name: '战利品',
    icon: '币',
    color: '#facc15',
    desc: '每级金币收益 +10%',
    max: 4,
    costs: [100, 240, 450, 800],
  },
  {
    id: 'duration',
    name: '道具强化',
    icon: '时',
    color: '#c084fc',
    desc: '每级道具持续时间 +10%',
    max: 3,
    costs: [150, 350, 650],
  },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

export const MAX_ITEM_STACK = 9;

export function getItem(id) {
  return ITEM_MAP[id] || null;
}

export function upgradeCost(upgrade, rank) {
  if (rank >= upgrade.max) return null;
  return upgrade.costs[rank] ?? null;
}

export function startingSoldiers(level, save) {
  const rank = save?.upgrades?.start || 0;
  return level.start + rank * 2;
}

export function coinMultiplier(save) {
  const rank = save?.upgrades?.coin || 0;
  return 1 + rank * 0.1;
}

export function durationMultiplier(save) {
  const rank = save?.upgrades?.duration || 0;
  return 1 + rank * 0.1;
}

/** 返回 {ok, reason?, item?}；成功时就地修改 save。 */
export function purchaseItem(save, id) {
  const item = getItem(id);
  if (!item) return { ok: false, reason: '未知道具' };
  if (!save.items || typeof save.items[id] !== 'number') {
    if (save.items) save.items[id] = 0;
  }
  if (save.items[id] >= MAX_ITEM_STACK) return { ok: false, reason: '道具已满' };
  if (save.coins < item.price) return { ok: false, reason: '金币不足' };
  save.coins -= item.price;
  save.items[id] += 1;
  return { ok: true, item };
}

/** 返回 {ok, reason?, upgrade?, rank?}；成功时就地修改 save。 */
export function purchaseUpgrade(save, id) {
  const upgrade = UPGRADE_MAP[id];
  if (!upgrade) return { ok: false, reason: '未知升级' };
  const rank = save.upgrades[id] || 0;
  const cost = upgradeCost(upgrade, rank);
  if (cost == null) return { ok: false, reason: '已满级' };
  if (save.coins < cost) return { ok: false, reason: '金币不足' };
  save.coins -= cost;
  save.upgrades[id] = rank + 1;
  return { ok: true, upgrade, rank: save.upgrades[id] };
}

/** 装备 / 卸下（最多两个槽位）。 */
export function toggleEquip(save, id) {
  const item = getItem(id);
  if (!item) return { ok: false, reason: '未知道具' };
  const loadout = save.loadout;
  const index = loadout.indexOf(id);
  if (index >= 0) {
    loadout.splice(index, 1);
    return { ok: true, equipped: false };
  }
  if ((save.items[id] || 0) <= 0) return { ok: false, reason: '先去商店购买' };
  if (loadout.length >= 2) return { ok: false, reason: '最多装备 2 个道具' };
  loadout.push(id);
  return { ok: true, equipped: true };
}

/** 消费一个道具库存；道具数量不足时返回 false。 */
export function consumeItem(save, id) {
  if ((save.items[id] || 0) <= 0) return false;
  save.items[id] -= 1;
  if (save.items[id] <= 0) {
    save.items[id] = 0;
    const index = save.loadout.indexOf(id);
    if (index >= 0) save.loadout.splice(index, 1);
  }
  return true;
}
