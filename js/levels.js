/**
 * 关卡与主题数据。
 * 坐标约定：道路横向 x ∈ [-5, 5]，z 为前进距离；关卡数据全部为纯数据，便于测试。
 */

export const ROAD_HALF = 5;
export const LANE_X = {
  2: [-2.5, 2.5],
  3: [-3.2, 0, 3.2],
};

export const THEMES = {
  meadow: {
    name: '青草平原',
    kind: 'hills',
    sky: ['#041c1b', '#0f766e'],
    haze: '#134e4a',
    far: '#0b4a45',
    near: '#082e2c',
    road: '#0a2524',
    roadEdge: '#2dd4bf',
    accent: '#5eead4',
    particle: '#a7f3d0',
  },
  desert: {
    name: '黄沙峡谷',
    kind: 'dunes',
    sky: ['#1f0c04', '#b45309'],
    haze: '#7c2d12',
    far: '#92400e',
    near: '#451a03',
    road: '#291309',
    roadEdge: '#fbbf24',
    accent: '#fcd34d',
    particle: '#fed7aa',
  },
  snow: {
    name: '极寒雪原',
    kind: 'peaks',
    sky: ['#061224', '#1e3a8a'],
    haze: '#3b82f6',
    far: '#93c5fd',
    near: '#1e293b',
    road: '#0b1b33',
    roadEdge: '#7dd3fc',
    accent: '#e0f2fe',
    particle: '#f8fafc',
  },
  neon: {
    name: '霓虹街区',
    kind: 'city',
    sky: ['#0c051d', '#4c1d95'],
    haze: '#7c3aed',
    far: '#312e81',
    near: '#1e1b4b',
    road: '#110c24',
    roadEdge: '#e879f9',
    accent: '#f0abfc',
    particle: '#c4b5fd',
  },
  lava: {
    name: '熔岩深渊',
    kind: 'volcano',
    sky: ['#160202', '#9a3412'],
    haze: '#7f1d1d',
    far: '#7c2d12',
    near: '#431407',
    road: '#200806',
    roadEdge: '#fb923c',
    accent: '#fdba74',
    particle: '#f97316',
  },
  space: {
    name: '星海轨道',
    kind: 'space',
    sky: ['#01030d', '#1e1b4b'],
    haze: '#0ea5e9',
    far: '#0f172a',
    near: '#020617',
    road: '#060b1a',
    roadEdge: '#38bdf8',
    accent: '#7dd3fc',
    particle: '#bae6fd',
  },
  factory: {
    name: '机械工厂',
    kind: 'factory',
    sky: ['#070b12', '#334155'],
    haze: '#475569',
    far: '#1e293b',
    near: '#0f172a',
    road: '#0b1120',
    roadEdge: '#f59e0b',
    accent: '#fbbf24',
    particle: '#fde68a',
  },
  haunted: {
    name: '幽影墓地',
    kind: 'graveyard',
    sky: ['#060313', '#312e81'],
    haze: '#4c1d95',
    far: '#1e1b4b',
    near: '#0c0a1f',
    road: '#0a0718',
    roadEdge: '#a5b4fc',
    accent: '#c7d2fe',
    particle: '#ddd6fe',
  },
  sky: {
    name: '云端天梯',
    kind: 'sky',
    sky: ['#041a2e', '#0e7490'],
    haze: '#22d3ee',
    far: '#67e8f9',
    near: '#164e63',
    road: '#082f49',
    roadEdge: '#fef08a',
    accent: '#fef9c3',
    particle: '#fefce8',
  },
  throne: {
    name: '终焉王座',
    kind: 'castle',
    sky: ['#120202', '#7f1d1d'],
    haze: '#991b1b',
    far: '#450a0a',
    near: '#1c0505',
    road: '#190404',
    roadEdge: '#fbbf24',
    accent: '#fcd34d',
    particle: '#fca5a5',
  },
};

/**
 * lanes: ['+5', 'x2', '/2', '-10']，分别表示 +5、×2、÷2、-10。
 * boss: hpFactor 为进场兵力 × hpFactor；pressure 为每秒对兵力造成的比例伤害基数。
 */
export const LEVELS = [
  {
    id: 1,
    name: '新兵出征',
    theme: 'meadow',
    length: 250,
    speed: 9.5,
    start: 5,
    desc: '凑够一支队伍，闯过倍数门，把木甲队长赶出平原。',
    tip: '左右拖动改变路线。蓝色门通常是增益，红色门要绕开。',
    gates: [
      { z: 55, lanes: ['+5', 'x2'] },
      { z: 115, lanes: ['x2', '+10'] },
      { z: 175, lanes: ['+8', 'x2'] },
    ],
    enemies: [
      { z: 145, x: -2.5, count: 5 },
      { z: 215, x: 2.5, count: 8 },
    ],
    hazards: [],
    crates: [
      { z: 95, x: 0, buff: 'magnet' },
      { z: 155, x: 2.5, buff: 'shield' },
    ],
    coinRuns: [
      { z: 70, x: -2.5, n: 6 },
      { z: 130, x: 2.5, n: 6 },
      { z: 190, x: 0, n: 8 },
    ],
    boss: { z: 250, name: '木甲队长', kind: 'brute', hpFactor: 5, pressure: 0.035 },
  },
  {
    id: 2,
    name: '沙暴突袭',
    theme: 'desert',
    length: 275,
    speed: 10,
    start: 6,
    desc: '沙暴里混进了敌军斥候，别让减兵门吃掉你的队伍。',
    tip: '木桶和锯轮会强行减员，护盾道具可以硬扛一次。',
    gates: [
      { z: 50, lanes: ['+10', '-5'] },
      { z: 110, lanes: ['x2', '+12'] },
      { z: 165, lanes: ['x2', '/2'] },
      { z: 225, lanes: ['+15', 'x2'] },
    ],
    enemies: [
      { z: 135, x: -2.5, count: 12 },
      { z: 200, x: 2.5, count: 18 },
    ],
    hazards: [
      { z: 80, x: 0, type: 'saw' },
      { z: 245, x: -2.5, type: 'barrel' },
    ],
    crates: [
      { z: 100, x: -2.5, buff: 'shield' },
      { z: 185, x: 0, buff: 'dash' },
    ],
    coinRuns: [
      { z: 62, x: 2.5, n: 6 },
      { z: 142, x: 0, n: 6 },
      { z: 210, x: -2.5, n: 8 },
    ],
    boss: { z: 275, name: '沙暴督军', kind: 'brute', hpFactor: 5, pressure: 0.04 },
  },
  {
    id: 3,
    name: '雪原追兵',
    theme: 'snow',
    length: 295,
    speed: 10.2,
    start: 8,
    desc: '冰面上的追兵越聚越多，用三倍门把人数滚起来。',
    tip: '×3 门往往比 +N 更划算，前提是先把基数做大。',
    gates: [
      { z: 45, lanes: ['x2', '+12'] },
      { z: 105, lanes: ['x3', '+20'] },
      { z: 165, lanes: ['-20', 'x2'] },
      { z: 225, lanes: ['x2', '/2'] },
    ],
    enemies: [
      { z: 130, x: 0, count: 18 },
      { z: 195, x: -2.5, count: 24 },
    ],
    hazards: [
      { z: 75, x: 2.5, type: 'saw' },
      { z: 255, x: 0, type: 'saw' },
    ],
    crates: [
      { z: 110, x: -2.5, buff: 'magnet' },
      { z: 210, x: 2.5, buff: 'shield' },
    ],
    coinRuns: [
      { z: 58, x: -2.5, n: 7 },
      { z: 145, x: 2.5, n: 7 },
      { z: 235, x: -2.5, n: 8 },
    ],
    boss: { z: 295, name: '冰原巨汉', kind: 'brute', hpFactor: 5.1, pressure: 0.045 },
  },
  {
    id: 4,
    name: '霓虹街区',
    theme: 'neon',
    length: 315,
    speed: 10.5,
    start: 10,
    desc: '三条路线任你选，黑帮队伍守在霓虹灯下。',
    tip: '三岔门只会结算最靠近的那条，提前把队伍带到目标线上。',
    gates: [
      { z: 50, lanes: ['+15', 'x2', '/2'] },
      { z: 115, lanes: ['x2', '+25', '-10'] },
      { z: 180, lanes: ['x3', '+30', '/2'] },
      { z: 240, lanes: ['x2', '+40', 'x2'] },
    ],
    enemies: [
      { z: 145, x: -3.2, count: 30 },
      { z: 210, x: 3.2, count: 40 },
      { z: 275, x: 0, count: 25 },
    ],
    hazards: [
      { z: 80, x: 0, type: 'saw' },
      { z: 250, x: -3.2, type: 'barrel' },
    ],
    crates: [
      { z: 100, x: 3.2, buff: 'shield' },
      { z: 190, x: -3.2, buff: 'airdrop' },
      { z: 265, x: 3.2, buff: 'dash' },
    ],
    coinRuns: [
      { z: 62, x: -3.2, n: 7 },
      { z: 130, x: 0, n: 7 },
      { z: 200, x: 3.2, n: 7 },
      { z: 285, x: -3.2, n: 8 },
    ],
    boss: { z: 315, name: '霓虹黑帮', kind: 'brute', hpFactor: 5.2, pressure: 0.05 },
  },
  {
    id: 5,
    name: '熔岩峡谷',
    theme: 'lava',
    length: 335,
    speed: 11,
    start: 12,
    desc: '滚烫的峡谷只留三条窄路，熔岩暴君正在尽头等你。',
    tip: '连续变道可以同时吃到好门和躲掉锯轮，别一直走中路。',
    gates: [
      { z: 55, lanes: ['x2', '+30', '/2'] },
      { z: 120, lanes: ['x3', '+40', '-30'] },
      { z: 185, lanes: ['x2', '+60', '/3'] },
      { z: 255, lanes: ['x3', '+80', 'x2'] },
    ],
    enemies: [
      { z: 150, x: 0, count: 60 },
      { z: 220, x: -3.2, count: 90 },
      { z: 290, x: 3.2, count: 120 },
    ],
    hazards: [
      { z: 90, x: -3.2, type: 'barrel' },
      { z: 160, x: 3.2, type: 'saw' },
      { z: 235, x: 0, type: 'saw' },
      { z: 305, x: -3.2, type: 'barrel' },
    ],
    crates: [
      { z: 105, x: 3.2, buff: 'shield' },
      { z: 200, x: -3.2, buff: 'airdrop' },
      { z: 270, x: 0, buff: 'dash' },
    ],
    coinRuns: [
      { z: 68, x: 3.2, n: 8 },
      { z: 135, x: -3.2, n: 8 },
      { z: 210, x: 0, n: 8 },
      { z: 315, x: 3.2, n: 8 },
    ],
    boss: { z: 335, name: '熔岩暴君', kind: 'brute', hpFactor: 5.3, pressure: 0.055 },
  },
  {
    id: 6,
    name: '星海轨道',
    theme: 'space',
    length: 355,
    speed: 11.5,
    start: 15,
    desc: '在失重轨道上狂奔，母舰的炮口已经对准你的队伍。',
    tip: '无人机道具会在奔跑途中自动清掉前方的敌人和障碍。',
    gates: [
      { z: 50, lanes: ['x3', '+40', '/2'] },
      { z: 120, lanes: ['x2', '+60', '-20'] },
      { z: 190, lanes: ['x3', '+80', '/2'] },
      { z: 260, lanes: ['x3', '+100', 'x2'] },
    ],
    enemies: [
      { z: 155, x: 0, count: 100 },
      { z: 235, x: -3.2, count: 150 },
      { z: 315, x: 3.2, count: 200 },
    ],
    hazards: [
      { z: 100, x: 0, type: 'saw' },
      { z: 180, x: -3.2, type: 'barrel' },
      { z: 265, x: 3.2, type: 'saw' },
      { z: 335, x: 0, type: 'barrel' },
    ],
    crates: [
      { z: 110, x: 3.2, buff: 'shield' },
      { z: 210, x: -3.2, buff: 'drone' },
      { z: 300, x: 3.2, buff: 'dash' },
    ],
    coinRuns: [
      { z: 64, x: -3.2, n: 8 },
      { z: 140, x: 3.2, n: 8 },
      { z: 220, x: 0, n: 8 },
      { z: 330, x: -3.2, n: 9 },
    ],
    boss: { z: 355, name: '轨道母舰', kind: 'brute', hpFactor: 5.4, pressure: 0.06 },
  },
  {
    id: 7,
    name: '机械工厂',
    theme: 'factory',
    length: 375,
    speed: 11,
    start: 18,
    desc: '传送带、锯轮和机械军团，整座工厂都在拦你。',
    tip: '敌人不是必须打：横向拉开距离就能从旁边绕过去。',
    gates: [
      { z: 55, lanes: ['x2', 'x3', '/2'] },
      { z: 125, lanes: ['+100', 'x2', '-50'] },
      { z: 195, lanes: ['x3', 'x2', '/3'] },
      { z: 265, lanes: ['x3', '+150', 'x2'] },
      { z: 320, lanes: ['x2', 'x3', '/2'] },
    ],
    enemies: [
      { z: 165, x: 0, count: 140 },
      { z: 245, x: -3.2, count: 180 },
      { z: 340, x: 3.2, count: 220 },
    ],
    hazards: [
      { z: 105, x: 3.2, type: 'saw' },
      { z: 185, x: 0, type: 'barrel' },
      { z: 285, x: -3.2, type: 'saw' },
      { z: 355, x: 0, type: 'saw' },
    ],
    crates: [
      { z: 115, x: -3.2, buff: 'shield' },
      { z: 215, x: 3.2, buff: 'drone' },
      { z: 300, x: 0, buff: 'airdrop' },
    ],
    coinRuns: [
      { z: 72, x: 3.2, n: 8 },
      { z: 140, x: -3.2, n: 8 },
      { z: 225, x: 0, n: 8 },
      { z: 310, x: 3.2, n: 8 },
    ],
    boss: { z: 375, name: '机械泰坦', kind: 'brute', hpFactor: 5.5, pressure: 0.065 },
  },
  {
    id: 8,
    name: '幽影墓地',
    theme: 'haunted',
    length: 395,
    speed: 11.5,
    start: 20,
    desc: '雾气里有亡灵的低语，减兵门和幽灵军团交替出现。',
    tip: '路线被红门封住时，先选能保住队伍的一侧，再想倍数。',
    gates: [
      { z: 50, lanes: ['x2', '-20', '/2'] },
      { z: 120, lanes: ['x3', '+60', '/3'] },
      { z: 190, lanes: ['x2', 'x2', '-50'] },
      { z: 260, lanes: ['x3', '+120', '/2'] },
    ],
    enemies: [
      { z: 175, x: 0, count: 160 },
      { z: 265, x: -3.2, count: 220 },
      { z: 345, x: 3.2, count: 300 },
    ],
    hazards: [
      { z: 100, x: -3.2, type: 'saw' },
      { z: 200, x: 3.2, type: 'barrel' },
      { z: 300, x: 0, type: 'saw' },
      { z: 365, x: 3.2, type: 'barrel' },
    ],
    crates: [
      { z: 110, x: 3.2, buff: 'shield' },
      { z: 220, x: -3.2, buff: 'magnet' },
      { z: 320, x: 0, buff: 'dash' },
    ],
    coinRuns: [
      { z: 66, x: -3.2, n: 8 },
      { z: 140, x: 3.2, n: 8 },
      { z: 230, x: 0, n: 8 },
      { z: 330, x: -3.2, n: 9 },
    ],
    boss: { z: 395, name: '幽灵将军', kind: 'brute', hpFactor: 5.6, pressure: 0.07 },
  },
  {
    id: 9,
    name: '云端天梯',
    theme: 'sky',
    length: 415,
    speed: 12,
    start: 24,
    desc: '踩着云梯冲上高空，风会把你的队伍吹散。',
    tip: '×4 门只出现在高空关，敢不敢把全部兵力押上去？',
    gates: [
      { z: 55, lanes: ['x3', '+80', '/2'] },
      { z: 125, lanes: ['x2', 'x3', '-40'] },
      { z: 195, lanes: ['x3', '+150', '/3'] },
      { z: 265, lanes: ['x4', 'x2', '+100'] },
      { z: 345, lanes: ['x3', '+200', '/2'] },
    ],
    enemies: [
      { z: 185, x: 0, count: 200 },
      { z: 285, x: -3.2, count: 280 },
      { z: 375, x: 3.2, count: 350 },
    ],
    hazards: [
      { z: 105, x: 3.2, type: 'saw' },
      { z: 210, x: -3.2, type: 'barrel' },
      { z: 315, x: 0, type: 'saw' },
      { z: 390, x: -3.2, type: 'barrel' },
    ],
    crates: [
      { z: 120, x: -3.2, buff: 'shield' },
      { z: 230, x: 3.2, buff: 'drone' },
      { z: 340, x: 0, buff: 'dash' },
    ],
    coinRuns: [
      { z: 70, x: 3.2, n: 9 },
      { z: 150, x: -3.2, n: 9 },
      { z: 245, x: 0, n: 9 },
      { z: 350, x: 3.2, n: 9 },
    ],
    boss: { z: 415, name: '天空霸主', kind: 'brute', hpFactor: 5.7, pressure: 0.075 },
  },
  {
    id: 10,
    name: '终焉王座',
    theme: 'throne',
    length: 445,
    speed: 12.5,
    start: 30,
    desc: '最后一战。穿过王座前的五道门，把终焉之王拉下马。',
    tip: '留一个护盾或复活兵符给最终 BOSS，三星就在眼前。',
    gates: [
      { z: 55, lanes: ['x3', 'x2', '/2'] },
      { z: 125, lanes: ['x3', '+200', '-100'] },
      { z: 195, lanes: ['x2', 'x4', '/2'] },
      { z: 270, lanes: ['x4', '+300', 'x2'] },
      { z: 350, lanes: ['x3', 'x3', '/3'] },
    ],
    enemies: [
      { z: 190, x: 0, count: 300 },
      { z: 290, x: -3.2, count: 400 },
      { z: 380, x: 3.2, count: 500 },
    ],
    hazards: [
      { z: 110, x: 3.2, type: 'saw' },
      { z: 220, x: -3.2, type: 'barrel' },
      { z: 320, x: 0, type: 'saw' },
      { z: 410, x: -3.2, type: 'barrel' },
    ],
    crates: [
      { z: 130, x: -3.2, buff: 'shield' },
      { z: 240, x: 3.2, buff: 'drone' },
      { z: 360, x: 0, buff: 'revive' },
    ],
    coinRuns: [
      { z: 75, x: -3.2, n: 10 },
      { z: 160, x: 3.2, n: 10 },
      { z: 255, x: 0, n: 10 },
      { z: 360, x: 3.2, n: 10 },
    ],
    boss: { z: 445, name: '终焉之王', kind: 'king', hpFactor: 6, pressure: 0.09 },
  },
];

/** 展开 coinRuns 为金币实体，返回 [{z,x}]。 */
export function expandCoins(level) {
  const coins = [];
  for (const run of level.coinRuns || []) {
    for (let i = 0; i < run.n; i += 1) {
      coins.push({
        z: run.z + i * 1.9,
        x: Math.max(-4.4, Math.min(4.4, run.x + Math.sin(i * 0.85 + run.z) * 0.35)),
      });
    }
  }
  return coins;
}

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) || null;
}

export function themeFor(level) {
  return THEMES[level.theme] || THEMES.meadow;
}
