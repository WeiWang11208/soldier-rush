/** 界面编排：主页、关卡、出征准备、商店、HUD 与结算。 */

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { LEVELS, themeFor, levelById } from './levels.js';
import {
  ITEMS,
  UPGRADES,
  getItem,
  purchaseItem,
  purchaseUpgrade,
  startingSoldiers,
  toggleEquip,
} from './items.js';
import { loadSave, persistSave, totalStars, recordResult } from './save.js';
import { formatCoins, formatCount } from './combat.js';
import { Sfx } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const isDebug = params.has('debug');

const canvas = $('#scene');
const renderer = new Renderer(canvas);
const save = loadSave(window.localStorage);
const sfx = new Sfx();
sfx.setMuted(Boolean(save.mute));

const screens = {
  home: $('#screen-home'),
  levels: $('#screen-levels'),
  prep: $('#screen-prep'),
  shop: $('#screen-shop'),
};
const hud = $('#hud');
const hudCount = $('#hud-count');
const hudCoins = $('#hud-coins');
const hudProgress = $('#hud-progress');
const hudProgressLabel = $('#hud-progress-label');
const hudLevelName = $('#hud-level-name');
const hudBuffs = $('#hud-buffs');
const bossBar = $('#boss-bar');
const bossName = $('#boss-name');
const bossFill = $('#boss-fill');
const itemSlots = $('#item-slots');
const toastEl = $('#toast');

const modalPause = $('#modal-pause');
const modalResult = $('#modal-result');
const modalHelp = $('#modal-help');
const resultCard = modalResult.querySelector('.modal-card');

let game = null;
let idleOn = false;
let idleRaf = 0;
let currentScreen = 'home';
let selectedLevelId = Math.min(save.unlocked || 1, LEVELS.length);
let currentLevelId = selectedLevelId;
let prepReturn = 'home';
let shopReturn = 'home';
let resultData = null;
let toastTimer = 0;
let lastItemsSignature = '';
let lastHud = null;

startIdle();
showScreen('home');
refreshMute();

function persist() {
  persistSave(save, window.localStorage);
}

function startIdle() {
  if (idleOn) return;
  idleOn = true;
  const loop = (ts) => {
    if (!idleOn) return;
    renderer.resize();
    renderer.drawIdle(ts / 1000);
    idleRaf = requestAnimationFrame(loop);
  };
  idleRaf = requestAnimationFrame(loop);
}

function stopIdle() {
  idleOn = false;
  cancelAnimationFrame(idleRaf);
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
  currentScreen = name;
  if (name === 'home') renderHome();
  if (name === 'levels') renderLevels();
  if (name === 'prep') renderPrep();
  if (name === 'shop') renderShop();
}

function renderHome() {
  $('#home-coins').textContent = formatCoins(save.coins);
  $('#home-stars').textContent = `${totalStars(save)}/${LEVELS.length * 3}`;
  $('#home-progress').textContent = `第 ${Math.min(save.unlocked, LEVELS.length)} 关`;
  const level = levelById(Math.min(save.unlocked, LEVELS.length));
  $('#home-continue').textContent = `第 ${level.id} 关 · ${level.name}`;
  $('#btn-play-label').textContent = save.unlocked > 1 ? '继续冲锋' : '开始冲锋';
  $('#btn-mute').textContent = save.mute ? '✕' : '♪';
  $('#btn-mute').classList.toggle('muted', Boolean(save.mute));
}

function themeVars(theme) {
  return `--c1:${theme.sky[1]};--c2:${theme.near};--accent:${theme.accent}`;
}

function renderLevels() {
  const grid = $('#level-grid');
  grid.innerHTML = LEVELS.map((level) => {
    const theme = themeFor(level);
    const stars = save.stars[level.id] || 0;
    const unlocked = level.id <= save.unlocked;
    const starHtml = [1, 2, 3]
      .map((index) => `<span class="${index <= stars ? 'on' : ''}">★</span>`)
      .join('');
    return `
      <button class="level-card ${unlocked ? '' : 'locked'} ${level.id === Math.min(save.unlocked, 10) ? 'current' : ''}"
        data-level="${level.id}" style="${themeVars(theme)}" ${unlocked ? '' : 'aria-disabled="true"'}>
        <span class="level-no">${String(level.id).padStart(2, '0')}</span>
        ${unlocked ? '' : '<span class="level-lock">未解锁</span>'}
        <span class="level-card-body">
          <b>${level.name}</b>
          <small>${theme.name}</small>
        </span>
        <span class="level-stars">${starHtml}</span>
      </button>`;
  }).join('');
  $('#levels-stars').textContent = `${totalStars(save)}/${LEVELS.length * 3}`;
}

function openPrep(levelId) {
  selectedLevelId = Math.max(1, Math.min(LEVELS.length, levelId));
  currentLevelId = selectedLevelId;
  showScreen('prep');
}

function renderPrep() {
  const level = levelById(selectedLevelId) || LEVELS[0];
  const theme = themeFor(level);
  const banner = $('#prep-banner');
  banner.style.cssText = themeVars(theme);
  $('#prep-badge').textContent = `第 ${level.id} 关 · ${theme.name}`;
  $('#prep-level-name').textContent = level.name;
  $('#prep-desc').textContent = level.desc;
  $('#prep-theme-name').textContent = theme.name;
  $('#prep-tip').textContent = level.tip;
  $('#prep-start-count').textContent = formatCount(startingSoldiers(level, save));
  $('#prep-boss-name').textContent = level.boss.name;
  $('#prep-best').textContent = save.best[level.id] ? formatCount(save.best[level.id]) : '—';
  $('#prep-coins').textContent = formatCoins(save.coins);
  $('#btn-start').textContent = save.best[level.id] ? '再次冲锋' : '开始冲锋';

  const slots = $('#loadout-slots');
  slots.innerHTML = [0, 1]
    .map((index) => {
      const id = save.loadout[index];
      const item = id ? getItem(id) : null;
      if (!item) {
        return `<div class="loadout-slot"><span class="slot-ico">＋</span><div><b>空槽位</b><small>点击下方道具装备</small></div></div>`;
      }
      return `<div class="loadout-slot filled" style="--item:${item.color}">
        <span class="slot-ico">${item.icon}</span>
        <div><b>${item.name}</b><small>持有 ${save.items[id] || 0} · ${item.short}</small></div>
      </div>`;
    })
    .join('');

  $('#prep-items').innerHTML = ITEMS.map((item) => {
    const count = save.items[item.id] || 0;
    const equipped = save.loadout.includes(item.id);
    return `<button class="item-pick ${equipped ? 'equipped' : ''} ${count <= 0 ? 'empty' : ''}"
      data-item="${item.id}" style="--item:${item.color}">
      <span class="item-icon">${item.icon}</span>
      <span class="pick-main"><b>${item.name}</b><small>${item.short}</small></span>
      <span class="pick-count">×${count}</span>
    </button>`;
  }).join('');
}

function renderShop() {
  $('#shop-coins').textContent = formatCoins(save.coins);
  $('#shop-items').innerHTML = ITEMS.map((item) => {
    const count = save.items[item.id] || 0;
    const full = count >= 9;
    return `<article class="shop-card" style="--item:${item.color}">
      <span class="item-icon">${item.icon}</span>
      <div class="shop-info">
        <b>${item.name}</b>
        <p>${item.desc}</p>
        <span class="stock">持有 ${count} / 9</span>
      </div>
      <button class="buy-btn" data-buy="${item.id}" ${full ? 'disabled' : ''}>
        <span class="coin-dot"></span>${full ? '已满' : item.price}
      </button>
    </article>`;
  }).join('');

  $('#shop-upgrades').innerHTML = UPGRADES.map((upgrade) => {
    const rank = save.upgrades[upgrade.id] || 0;
    const cost = rank >= upgrade.max ? null : upgrade.costs[rank];
    const pips = Array.from({ length: upgrade.max }, (_, index) => `<i class="${index < rank ? 'on' : ''}"></i>`).join('');
    return `<article class="upgrade-card" style="--item:${upgrade.color}">
      <span class="item-icon">${upgrade.icon}</span>
      <div class="shop-info">
        <b>${upgrade.name} <small style="color:var(--muted-2);font-weight:600">Lv.${rank}</small></b>
        <p>${upgrade.desc}</p>
        <span class="rank">${pips}</span>
      </div>
      <button class="buy-btn" data-upgrade="${upgrade.id}" ${cost == null ? 'disabled' : ''}>
        <span class="coin-dot"></span>${cost == null ? '满级' : cost}
      </button>
    </article>`;
  }).join('');
}

function toast(text, tone = '') {
  if (!text) return;
  toastEl.textContent = text;
  toastEl.className = `toast show ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 1900);
}

function refreshMute() {
  sfx.setMuted(Boolean(save.mute));
  $('#btn-mute').textContent = save.mute ? '✕' : '♪';
  $('#btn-mute').classList.toggle('muted', Boolean(save.mute));
}

function startGame(levelId) {
  const level = levelById(levelId);
  if (!level) return;
  closeModals();
  stopIdle();
  if (game) {
    game.destroy();
    game = null;
  }
  for (const el of Object.values(screens)) el.classList.add('hidden');
  currentScreen = 'game';
  hud.classList.remove('hidden');
  lastItemsSignature = '';
  lastHud = null;
  selectedLevelId = level.id;
  currentLevelId = level.id;
  sfx.init();
  game = new Game({
    canvas,
    levelId: level.id,
    save,
    sfx,
    callbacks: {
      onFinish: finishGame,
      onHud: updateHud,
      onEvent: handleGameEvent,
      onInventory: () => persist(),
    },
  });
}

function closeModals() {
  modalPause.classList.add('hidden');
  modalResult.classList.add('hidden');
  modalHelp.classList.add('hidden');
}

function finishGame(data) {
  resultData = data;
  const result = recordResult(save, data.levelId, {
    won: data.won,
    stars: data.stars,
    coinsEarned: data.coinsEarned,
    survivors: data.survivors,
  });
  persist();
  showResult(data, result);
  renderHome();
}

function showResult(data, record) {
  resultCard.classList.toggle('lost', !data.won);
  $('#result-emblem').textContent = data.won ? '★' : '✕';
  $('#result-kicker').textContent = data.won ? 'VICTORY' : 'DEFEAT';
  $('#result-title').textContent = data.won
    ? data.levelId === LEVELS.length
      ? '全关卡制霸'
      : '关卡完成'
    : '冲锋失败';
  $('#result-sub').textContent = data.won
    ? `${data.reason} · 保留 ${formatCount(data.survivors)} 名士兵`
    : `${data.reason} · 兵力峰值 ${formatCount(data.peak)} 人`;

  const starEls = document.querySelectorAll('#result-stars i');
  starEls.forEach((el, index) => el.classList.toggle('on', data.won && index < data.stars));

  $('#result-stats').innerHTML = `
    <div><small>存活</small><b>${formatCount(data.survivors)}</b></div>
    <div><small>BOSS 进场</small><b>${formatCount(data.bossEntry || data.peak)}</b></div>
    <div><small>兵力峰值</small><b>${formatCount(data.peak)}</b></div>`;

  $('#result-coins').textContent = `+${formatCoins(data.coinsEarned)}`;
  $('#result-breakdown').textContent =
    `沿途 ${data.collected} + 歼敌 ${data.kills} + 通关 ${data.bonusCoins}，倍率 ×${data.factor.toFixed(1)}`;
  if (record?.unlockedNext) {
    $('#result-sub').textContent += ' · 已解锁下一关';
  }
  if (data.levelId === LEVELS.length && data.won) {
    $('#result-breakdown').textContent += ' · 全部 10 关完成！';
  }

  const nextButton = $('#btn-next');
  if (data.won && data.levelId < LEVELS.length) {
    const next = levelById(data.levelId + 1);
    nextButton.classList.remove('hidden');
    nextButton.textContent = `下一关 · ${next.name}`;
  } else {
    nextButton.classList.add('hidden');
  }
  $('#btn-retry').textContent = data.won && data.levelId === LEVELS.length ? '再战终焉' : '再来一次';
  modalResult.classList.remove('hidden');
  renderLevels();
  renderPrep();
}

function updateHud(state) {
  lastHud = state;
  hudCount.textContent = formatCount(state.count);
  hudCoins.textContent = formatCoins(state.coins);
  hudProgress.style.width = `${(state.progress * 100).toFixed(1)}%`;
  hudProgressLabel.textContent = `${Math.round(state.progress * 100)}%`;
  hudLevelName.textContent = `第 ${state.level.id} 关 · ${state.level.name}`;

  bossBar.classList.toggle('hidden', !state.bossActive);
  if (state.bossActive) {
    bossName.textContent = state.bossName;
    bossFill.style.width = `${Math.max(0, state.bossHp * 100).toFixed(1)}%`;
  }

  const chips = [];
  if (state.buffs.shield > 0) chips.push(['#38bdf8', `盾 ${state.buffs.shield.toFixed(1)}s`]);
  if (state.buffs.dash > 0) chips.push(['#a78bfa', `冲 ${state.buffs.dash.toFixed(1)}s`]);
  if (state.buffs.magnet > 0) chips.push(['#fbbf24', `磁 ${state.buffs.magnet.toFixed(1)}s`]);
  if (state.buffs.drone > 0) chips.push(['#f472b6', `机 ${state.buffs.drone.toFixed(1)}s`]);
  if (state.doubleCoins) chips.push(['#facc15', '金币 ×2']);
  if (state.reviveAvailable) chips.push(['#fb7185', '复活就绪']);
  hudBuffs.innerHTML = chips
    .map(([color, text]) => `<span class="buff-chip" style="--c:${color}">${text}</span>`)
    .join('');

  const signature = state.items.map((item) => `${item.id}:${item.count}`).join('|');
  if (signature !== lastItemsSignature) {
    lastItemsSignature = signature;
    itemSlots.innerHTML = state.items
      .map(
        (item) => `<button class="item-slot-btn ${item.count <= 0 ? 'used-up' : ''}" data-use="${item.id}" style="--item:${item.color}" aria-label="使用${item.name}">
          <span class="slot-icon">${item.icon}</span>
          <span class="slot-name">${item.name}</span>
          <span class="slot-count">${item.count}</span>
        </button>`,
      )
      .join('');
  }
}

function handleGameEvent(type, payload) {
  if (type === 'toast') toast(payload?.text || '', payload?.tone || '');
  if (type === 'boss') toast(`${payload?.name || 'BOSS'} 登场！`, 'rose');
  if (type === 'result') {
    if (payload?.won) toast('BOSS 击破！', 'gold');
  }
}

function endGameToHome() {
  closeModals();
  if (game) {
    game.destroy();
    game = null;
  }
  hud.classList.add('hidden');
  for (const el of Object.values(screens)) el.classList.add('hidden');
  showScreen('home');
  startIdle();
}

/* ---------------- events ---------------- */

$('#btn-play').addEventListener('click', () => {
  sfx.init();
  sfx.play('click');
  prepReturn = 'home';
  openPrep(Math.min(save.unlocked, LEVELS.length));
});

$('#btn-levels').addEventListener('click', () => {
  sfx.play('click');
  showScreen('levels');
});

$('#btn-shop').addEventListener('click', () => {
  sfx.play('click');
  shopReturn = 'home';
  showScreen('shop');
});

$('#btn-help').addEventListener('click', () => {
  sfx.play('click');
  modalHelp.classList.remove('hidden');
});

$('#btn-help-close').addEventListener('click', () => {
  sfx.play('click');
  modalHelp.classList.add('hidden');
});

$('#btn-mute').addEventListener('click', () => {
  save.mute = !save.mute;
  persist();
  sfx.init();
  refreshMute();
  sfx.play('click');
});

$('#btn-levels-back').addEventListener('click', () => {
  sfx.play('click');
  showScreen('home');
});

$('#level-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-level]');
  if (!card) return;
  const id = Number(card.dataset.level);
  if (id > save.unlocked) {
    toast('先通关上一关才能解锁', 'rose');
    return;
  }
  sfx.play('click');
  prepReturn = 'levels';
  openPrep(id);
});

$('#btn-prep-back').addEventListener('click', () => {
  sfx.play('click');
  if (prepReturn === 'levels') showScreen('levels');
  else showScreen('home');
});

$('#btn-prep-shop').addEventListener('click', () => {
  sfx.play('click');
  shopReturn = 'prep';
  showScreen('shop');
});

$('#prep-items').addEventListener('click', (event) => {
  const card = event.target.closest('[data-item]');
  if (!card) return;
  const id = card.dataset.item;
  const result = toggleEquip(save, id);
  if (!result.ok) {
    if (result.reason === '先去商店购买') {
      toast('道具数量不足，去商店补货', 'rose');
      shopReturn = 'prep';
      showScreen('shop');
    } else {
      toast(result.reason, 'rose');
    }
    return;
  }
  sfx.play('click');
  persist();
  renderPrep();
});

$('#btn-start').addEventListener('click', () => {
  sfx.play('click');
  startGame(selectedLevelId);
});

$('#btn-shop-back').addEventListener('click', () => {
  sfx.play('click');
  if (shopReturn === 'prep') {
    showScreen('prep');
  } else {
    showScreen('home');
  }
});

$('#shop-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-buy]');
  if (!button) return;
  const id = button.dataset.buy;
  const result = purchaseItem(save, id);
  if (!result.ok) {
    toast(result.reason, 'rose');
    return;
  }
  persist();
  sfx.play('coin');
  toast(`已购买 ${result.item.name}`, 'gold');
  renderShop();
  renderHome();
});

$('#shop-upgrades').addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade]');
  if (!button) return;
  const id = button.dataset.upgrade;
  const result = purchaseUpgrade(save, id);
  if (!result.ok) {
    toast(result.reason, 'rose');
    return;
  }
  persist();
  sfx.play('gateGood');
  toast(`${result.upgrade.name} 升到 Lv.${result.rank}`, 'gold');
  renderShop();
  renderHome();
});

$('#btn-pause').addEventListener('click', () => {
  if (!game || game.phase === 'result') return;
  sfx.play('click');
  game.pause();
  modalPause.classList.remove('hidden');
});

$('#btn-resume').addEventListener('click', () => {
  sfx.play('click');
  modalPause.classList.add('hidden');
  game?.resume();
});

$('#btn-restart').addEventListener('click', () => {
  sfx.play('click');
  modalPause.classList.add('hidden');
  startGame(currentLevelId);
});

$('#btn-quit').addEventListener('click', () => {
  sfx.play('click');
  endGameToHome();
});

$('#btn-next').addEventListener('click', () => {
  sfx.play('click');
  if (!resultData || resultData.levelId >= LEVELS.length) {
    endGameToHome();
    return;
  }
  modalResult.classList.add('hidden');
  endGameToHome();
  prepReturn = 'levels';
  openPrep(resultData.levelId + 1);
});

$('#btn-retry').addEventListener('click', () => {
  sfx.play('click');
  if (!resultData) return;
  const id = resultData.levelId;
  modalResult.classList.add('hidden');
  startGame(id);
});

$('#btn-result-home').addEventListener('click', () => {
  sfx.play('click');
  endGameToHome();
});

itemSlots.addEventListener('click', (event) => {
  const button = event.target.closest('[data-use]');
  if (!button || !game) return;
  const result = game.useItem(button.dataset.use);
  if (!result.ok && result.reason) toast(result.reason, 'rose');
});

document.addEventListener(
  'pointerdown',
  () => {
    sfx.init();
  },
  { passive: true },
);

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 120));
window.addEventListener('pagehide', () => persist());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persist();
    if (game && game.phase !== 'result' && !game.paused) {
      game.pause();
      modalPause.classList.remove('hidden');
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && game && !game.paused && game.phase !== 'result') {
    game.pause();
    modalPause.classList.remove('hidden');
  }
});

/* ---------------- PWA ---------------- */

if ('serviceWorker' in navigator && location.protocol === 'https:' && !isDebug) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ---------------- 调试接口（?debug=1） ---------------- */

if (isDebug) {
  window.__SR = {
    version: '1.0.0',
    get save() {
      return save;
    },
    get game() {
      return game;
    },
    state() {
      return {
        screen: currentScreen,
        hasGame: Boolean(game),
        phase: game?.phase || null,
        levelId: game?.level.id || currentLevelId,
        count: game ? Math.floor(game.player.count) : 0,
        paused: Boolean(game?.paused),
        resultVisible: !modalResult.classList.contains('hidden'),
        hudVisible: !hud.classList.contains('hidden'),
        hudCount: hudCount.textContent,
        canvas: { width: renderer.width, height: renderer.height },
        save: JSON.parse(JSON.stringify(save)),
      };
    },
    start(levelId) {
      startGame(levelId);
    },
    prep(levelId) {
      prepReturn = 'levels';
      openPrep(levelId);
    },
    screen(name) {
      showScreen(name);
    },
    setCount(count) {
      if (!game) return false;
      game.player.count = Math.max(1, Number(count) || 1);
      game.peak = Math.max(game.peak, game.player.count);
      game.emitHud(true);
      return true;
    },
    setSpeed(speed) {
      if (!game) return false;
      game.debugSpeed = Math.max(1, Number(speed) || 1);
      return true;
    },
    skipCountdown() {
      if (!game) return false;
      game.countdown = 0.05;
      return true;
    },
    toBoss() {
      if (!game) return false;
      game.player.z = game.boss.z - 7.2;
      game.phase = 'running';
      game.countdown = 0;
      game.emitHud(true);
      return true;
    },
    finish(won = true) {
      if (!game) return false;
      if (won) {
        game.player.count = Math.max(50, game.player.count);
        game.peak = Math.max(game.peak, game.player.count);
      } else {
        game.player.count = 0;
      }
      game.finish(Boolean(won), won ? '调试通关' : '调试失败');
      return true;
    },
    useItem(id) {
      return game ? game.useItem(id) : { ok: false };
    },
    buy(id) {
      return purchaseItem(save, id);
    },
    lastHud() {
      return lastHud;
    },
  };
}
