/** 游戏主循环：奔跑、选门、歼敌、BOSS 战与道具使用。 */

import { Renderer } from './renderer.js';
import { themeFor, expandCoins } from './levels.js';
import {
  applyGateCount,
  bossModel,
  gateLabel,
  hazardLoss,
  isPositiveGate,
  resolveEnemy,
  runReward,
  starsFor,
} from './combat.js';
import { nearestLane, perspective, screenX, screenY, depthOf } from './camera.js';
import { getItem, consumeItem, coinMultiplier, durationMultiplier, startingSoldiers } from './items.js';
import { levelById as getLevel } from './levels.js';

const HUD_KEYS = ['shield', 'magnet', 'dash', 'drone'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class Game {
  constructor({ canvas, levelId, save, sfx, callbacks = {} }) {
    this.canvas = canvas;
    this.level = getLevel(levelId);
    if (!this.level) throw new Error(`关卡不存在: ${levelId}`);
    this.theme = themeFor(this.level);
    this.save = save;
    this.sfx = sfx;
    this.callbacks = callbacks;
    this.renderer = new Renderer(canvas);
    this.laneCount = this.level.gates[0]?.lanes.length || 2;
    this.paused = false;
    this.finished = false;
    this.destroyed = false;
    this.phase = 'countdown';
    this.countdown = 3.2;
    this.lastCountdownTick = 4;
    this.runTime = 0;
    this.speedMult = 1;
    this.hitFlash = 0;
    this.shake = 0;
    this.bossIntro = 0;
    this.finishTimer = 0;
    this.finishData = null;
    this.onFinish = callbacks.onFinish || (() => {});
    this.onHud = callbacks.onHud || (() => {});
    this.onEvent = callbacks.onEvent || (() => {});
    this.onInventory = callbacks.onInventory || (() => {});
    this.hudTimer = 0;
    this.lastFrame = 0;
    this.raf = 0;
    this.pointerActive = false;

    this.player = {
      x: 0,
      targetX: 0,
      z: 0,
      count: startingSoldiers(this.level, save),
    };
    this.peak = this.player.count;

    this.gates = this.level.gates.map((gate) => ({ ...gate, applied: false }));
    this.coins = expandCoins(this.level).map((coin) => ({ ...coin, collected: false }));
    this.crates = (this.level.crates || []).map((crate) => ({ ...crate, collected: false }));
    this.hazards = (this.level.hazards || []).map((hazard) => ({
      ...hazard,
      cleared: false,
      spin: Math.random() * Math.PI,
    }));
    this.enemies = (this.level.enemies || []).map((enemy) => ({
      ...enemy,
      alive: true,
      defeated: false,
    }));
    this.boss = {
      ...this.level.boss,
      active: false,
      defeated: false,
      hp: 0,
      maxHp: 0,
      hitFlash: 0,
    };
    this.bossEntry = 0;

    this.particles = [];
    this.floaters = [];
    this.tracers = [];
    this.bossShots = [];
    this.buffs = { shield: 0, magnet: 0, dash: 0, drone: 0 };
    this.doubleCoins = false;
    this.reviveAvailable = false;
    this.freeRevive = false;
    this.revived = false;
    this.collectedCoins = 0;
    this.killCoins = 0;
    this.droneCooldown = 0;
    this.bossTick = 0;
    this.tracerTick = 0;

    this.applyPassiveLoadout();
    this.bindInput();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud(true);
    this.onEvent('start', { level: this.level });
  }

  applyPassiveLoadout() {
    const loadout = this.save.loadout || [];
    if (loadout.includes('double') && (this.save.items.double || 0) > 0) {
      if (consumeItem(this.save, 'double')) {
        this.doubleCoins = true;
        this.onEvent('toast', { text: '双倍金币生效', tone: 'gold' });
      }
    }
    if (loadout.includes('revive') && (this.save.items.revive || 0) > 0) {
      this.reviveAvailable = true;
    }
    this.onInventory();
  }

  get coinFactor() {
    return coinMultiplier(this.save) * (this.doubleCoins ? 2 : 1);
  }

  get runningCoins() {
    return Math.round((this.collectedCoins + this.killCoins) * this.coinFactor);
  }

  bindInput() {
    this.onPointerDown = (event) => {
      if (this.phase === 'result') return;
      this.pointerActive = true;
      this.setTargetFromClientX(event.clientX);
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {}
      event.preventDefault();
    };
    this.onPointerMove = (event) => {
      if (!this.pointerActive) return;
      this.setTargetFromClientX(event.clientX);
      event.preventDefault();
    };
    this.onPointerUp = () => {
      this.pointerActive = false;
    };
    this.onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        this.player.targetX = clamp(this.player.targetX - 0.9, -4.3, 4.3);
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        this.player.targetX = clamp(this.player.targetX + 0.9, -4.3, 4.3);
      }
    };
    this.onResize = () => this.renderer.resize();

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize);
  }

  setTargetFromClientX(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const maxHalf = rect.width * 0.465;
    const world = ((clientX - rect.left - rect.width / 2) / maxHalf) * 5;
    this.player.targetX = clamp(world, -4.3, 4.3);
  }

  start() {}

  pause() {
    if (this.finished) return;
    this.paused = true;
    this.emitHud(true);
  }

  resume() {
    this.paused = false;
    this.lastFrame = performance.now();
    this.emitHud(true);
  }

  useItem(id) {
    if (this.paused || this.finished || this.phase === 'countdown' || this.phase === 'result') {
      return { ok: false, reason: '现在不能使用' };
    }
    const item = getItem(id);
    if (!item) return { ok: false, reason: '未知道具' };
    if ((this.save.items[id] || 0) <= 0) return { ok: false, reason: '数量不足' };
    if (item.type === 'passive') return { ok: false, reason: '该道具自动生效' };
    if (!consumeItem(this.save, id)) return { ok: false, reason: '数量不足' };
    this.applyBuff(id, item.duration || 0);
    this.onInventory();
    this.sfx.play('item');
    this.onEvent('toast', { text: `${item.name} 已启用`, tone: 'cyan' });
    this.emitHud(true);
    return { ok: true };
  }

  applyBuff(id, duration) {
    const item = getItem(id);
    const mult = durationMultiplier(this.save);
    const seconds = duration * mult;
    const player = this.player;
    switch (id) {
      case 'airdrop':
        player.count += 15;
        this.peak = Math.max(this.peak, player.count);
        this.spawnFloater('+15 兵', '#6ee7b7', 1.4);
        this.burstAtPlayer('#34d399', 22);
        break;
      case 'shield':
        this.buffs.shield = Math.max(this.buffs.shield, seconds);
        break;
      case 'magnet':
        this.buffs.magnet = Math.max(this.buffs.magnet, seconds);
        break;
      case 'dash':
        this.buffs.dash = Math.max(this.buffs.dash, seconds);
        break;
      case 'drone':
        this.buffs.drone = Math.max(this.buffs.drone, seconds);
        break;
      case 'double':
        this.doubleCoins = true;
        this.onEvent('toast', { text: '本关金币 ×2', tone: 'gold' });
        break;
      case 'revive':
        this.reviveAvailable = true;
        this.freeRevive = true;
        this.onEvent('toast', { text: '复活兵符已就绪', tone: 'rose' });
        break;
      default:
        break;
    }
    if (item?.name) this.onEvent('buff', { id, name: item.name });
  }

  update(dt) {
    if (this.paused || this.destroyed) return;
    this.runTime += dt;
    this.updateEffects(dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const tick = Math.ceil(this.countdown);
      if (tick < this.lastCountdownTick) {
        this.lastCountdownTick = tick;
        this.sfx.play(tick <= 0 ? 'go' : 'tick');
      }
      if (this.countdown <= 0) {
        this.phase = 'running';
        this.onEvent('running');
      }
      this.player.x += (this.player.targetX - this.player.x) * Math.min(1, dt * 9);
      return;
    }

    if (this.phase === 'result') {
      if (this.finishTimer > 0) {
        this.finishTimer -= dt;
        if (this.finishTimer <= 0 && !this.finished) {
          this.finished = true;
          this.onFinish(this.finishData);
        }
      }
      return;
    }

    if (this.phase === 'boss') {
      this.updateBoss(dt);
      this.updateBuffTimers(dt);
      return;
    }

    if (this.phase !== 'running') return;

    for (const key of HUD_KEYS) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }

    const dashing = this.buffs.dash > 0;
    const speed = this.level.speed * (dashing ? 1.7 : 1) * (this.debugSpeed || 1);
    const lastZ = this.player.z;
    this.player.z += speed * dt;
    this.player.x += (this.player.targetX - this.player.x) * Math.min(1, dt * 11);
    this.player.x = clamp(this.player.x, -4.5, 4.5);

    this.droneCooldown -= dt;
    if (this.buffs.drone > 0 && this.droneCooldown <= 0) {
      this.droneCooldown = 1.4;
      this.fireDrone();
    }

    for (const gate of this.gates) {
      if (!gate.applied && lastZ < gate.z && this.player.z >= gate.z) {
        this.applyGate(gate);
      }
    }

    for (const hazard of this.hazards) {
      if (hazard.cleared) continue;
      if (this.crossed(lastZ, hazard.z, 0.9) && Math.abs(this.player.x - hazard.x) < 1.15) {
        this.hitHazard(hazard);
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (this.crossed(lastZ, enemy.z, 1.3) && Math.abs(this.player.x - enemy.x) < 1.75) {
        this.hitEnemy(enemy);
        if (this.phase !== 'running') return;
      }
    }

    this.collectPickups();

    if (!this.boss.active && this.player.z >= this.boss.z - 7) {
      this.startBoss();
    }

    this.hudTimer += dt;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  crossed(lastZ, z, radius) {
    return lastZ < z && this.player.z >= z - radius;
  }

  updateBuffTimers(dt) {
    for (const key of HUD_KEYS) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  applyGate(gate) {
    gate.applied = true;
    const index = nearestLane(this.player.x, gate.lanes.length);
    const token = gate.lanes[index];
    const before = this.player.count;
    this.player.count = applyGateCount(before, token);
    this.peak = Math.max(this.peak, this.player.count);
    const positive = isPositiveGate(token);
    this.sfx.play(positive ? 'gateGood' : 'gateBad');
    this.spawnFloater(
      `${gateLabel(token)}  ${positive ? '+' : ''}${Math.floor(this.player.count - before)}`,
      positive ? '#5eead4' : '#fda4af',
      1.3,
    );
    this.burstAt(gate.z, [gate.lanes.length === 3 ? [-3.2, 0, 3.2][index] : [-2.5, 2.5][index]], positive ? '#34d399' : '#fb7185', 18);
    this.shake = Math.max(this.shake, positive ? 0.2 : 0.35);
  }

  hitHazard(hazard) {
    hazard.cleared = true;
    const immune = this.buffs.shield > 0 || this.buffs.dash > 0;
    if (immune) {
      this.spawnFloater('免疫', '#7dd3fc', 1.1);
      this.burstAt(hazard.z, [hazard.x], '#38bdf8', 16);
      return;
    }
    const loss = hazardLoss(this.player.count);
    this.player.count = Math.max(1, this.player.count - loss);
    this.spawnFloater(`-${loss}`, '#fb7185', 1.2);
    this.burstAt(hazard.z, [hazard.x], '#fb923c', 24);
    this.hitFlash = 0.6;
    this.shake = 0.7;
    this.sfx.play('hit');
  }

  hitEnemy(enemy) {
    const result = resolveEnemy(this.player.count, enemy.count);
    if (result.win) {
      this.player.count = result.remaining;
      this.killCoins += result.coins;
      enemy.alive = false;
      enemy.defeated = true;
      this.spawnFloater(`歼敌 +${result.coins}`, '#fde68a', 1.2);
      this.spawnFloater(`-${result.lost}`, '#fb7185', 1.1);
      this.burstAt(enemy.z, [enemy.x], '#fb7185', 28);
      this.shake = 0.55;
      this.sfx.play('hit');
      return;
    }
    if (this.tryRevive('enemy')) {
      enemy.alive = false;
      enemy.defeated = true;
      this.player.z = Math.max(this.player.z, enemy.z + 1.5);
      return;
    }
    this.player.count = 0;
    this.finish(false, '队伍被打散了');
  }

  tryRevive(source) {
    if (!this.reviveAvailable || this.revived) return false;
    if (this.freeRevive) {
      this.freeRevive = false;
    } else {
      if ((this.save.items.revive || 0) <= 0) {
        this.reviveAvailable = false;
        return false;
      }
      if (!consumeItem(this.save, 'revive')) return false;
    }
    this.revived = true;
    this.reviveAvailable = false;
    this.player.count = Math.max(2, Math.floor(this.peak * 0.4));
    this.hitFlash = 0.5;
    this.shake = 0.8;
    this.sfx.play('revive');
    this.spawnFloater('兵符生效!', '#fbbf24', 1.8);
    this.burstAtPlayer('#fbbf24', 40);
    this.onInventory();
    this.onEvent('toast', { text: '复活兵符生效，继续冲锋！', tone: 'gold' });
    if (source === 'boss') this.buffs.shield = Math.max(this.buffs.shield, 2);
    return true;
  }

  collectPickups() {
    const magnet = this.buffs.magnet > 0;
    const pz = this.player.z;
    const px = this.player.x;
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dz = coin.z - pz;
      if (dz < -1.5 || dz > (magnet ? 14 : 1.6)) continue;
      if (Math.abs(coin.x - px) > (magnet ? 4.5 : 1.25)) continue;
      coin.collected = true;
      this.collectedCoins += 1;
      this.sfx.play('coin');
      this.burstAt(coin.z, [coin.x], '#facc15', 7, 0.5);
    }
    for (const crate of this.crates) {
      if (crate.collected) continue;
      const dz = crate.z - pz;
      if (dz < -1.5 || dz > (magnet ? 14 : 1.6)) continue;
      if (Math.abs(crate.x - px) > (magnet ? 4.5 : 1.3)) continue;
      crate.collected = true;
      const item = getItem(crate.buff);
      if (item) {
        this.applyBuff(crate.buff, item.duration || 0);
        this.sfx.play('crate');
        this.spawnFloater(`${item.name}!`, item.color, 1.5);
        this.onEvent('toast', { text: `获得补给：${item.name}`, tone: 'cyan' });
      }
    }
  }

  fireDrone() {
    const pz = this.player.z;
    const targets = [
      ...this.hazards.filter((h) => !h.cleared && h.z > pz && h.z < pz + 32).map((h) => ({ ...h, kind: 'hazard', ref: h })),
      ...this.enemies.filter((e) => e.alive && e.z > pz && e.z < pz + 32).map((e) => ({ ...e, kind: 'enemy', ref: e })),
    ].sort((a, b) => a.z - b.z);
    if (!targets.length) return;
    const target = targets[0];
    if (target.kind === 'hazard') {
      target.ref.cleared = true;
      this.burstAt(target.z, [target.x], '#f472b6', 18);
    } else {
      this.player.count += Math.ceil(target.ref.count * 0.5);
      this.killCoins += target.ref.count;
      target.ref.alive = false;
      target.ref.defeated = true;
      this.burstAt(target.z, [target.x], '#f472b6', 24);
      this.spawnFloater('无人机支援', '#f9a8d4', 1.1);
    }
    this.sfx.play('shoot');
  }

  startBoss() {
    this.phase = 'boss';
    this.player.z = this.boss.z - 6.5;
    this.player.targetX = 0;
    this.boss.active = true;
    this.bossEntry = Math.max(1, Math.floor(this.player.count));
    const model = bossModel(this.boss, this.bossEntry);
    this.boss.maxHp = model.maxHp;
    this.boss.hp = model.maxHp;
    this.bossIntro = 2.2;
    this.shake = 0.5;
    this.sfx.play('bossHit');
    this.onEvent('boss', { name: this.boss.name, hp: this.boss.hp });
    this.emitHud(true);
  }

  updateBoss(dt) {
    const boss = this.boss;
    boss.hitFlash = Math.max(0, boss.hitFlash - dt * 3);
    const droneBoost = this.buffs.drone > 0 ? 1.25 : 1;
    boss.hp -= this.player.count * 0.95 * droneBoost * dt;
    const immune = this.buffs.shield > 0 || this.buffs.dash > 0;
    if (!immune) {
      this.player.count -= this.player.count * (boss.pressure || 0.05) * dt;
    }

    this.bossTick -= dt;
    if (this.bossTick <= 0) {
      this.bossTick = 0.85;
      boss.hitFlash = 0.35;
      this.hitFlash = immune ? 0 : 0.25;
      this.shake = Math.max(this.shake, immune ? 0.12 : 0.3);
      this.sfx.play('bossHit');
      this.spawnBossShot();
    }
    this.tracerTick -= dt;
    if (this.tracerTick <= 0) {
      this.tracerTick = 0.09;
      this.spawnTracer();
    }
    if (this.buffs.drone > 0 && Math.random() < 0.25) {
      this.spawnTracer('#f472b6');
    }

    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.defeated = true;
      this.burstAt(boss.z, [0], '#fbbf24', 60, 1.3);
      this.finish(true, 'BOSS 已被击破');
      return;
    }
    if (this.player.count <= 0.5) {
      this.player.count = 0;
      if (this.tryRevive('boss')) {
        this.bossTick = 1;
        return;
      }
      this.finish(false, '兵力耗尽');
      return;
    }
    this.emitHud();
  }

  spawnBossShot() {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const d = depthOf(this.boss.z, this.player.z);
    const sx = screenX(0, d, W);
    const sy = screenY(d, H) - 60 * perspective(d) * (W / 400);
    this.bossShots.push({
      x: sx,
      y: sy,
      tx: W / 2 + (Math.random() - 0.5) * W * 0.3,
      ty: screenY(1.2, H) - 20,
      r: Math.max(2, W * 0.012),
      color: '#fb7185',
      t: 0,
      speed: 1.5 + Math.random() * 0.8,
    });
  }

  spawnTracer(color = '#7dd3fc') {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const d = depthOf(this.boss.z, this.player.z);
    const bossX = screenX(0, d, W);
    const bossY = screenY(d, H) - 70 * perspective(d) * (W / 400);
    this.tracers.push({
      x1: W / 2 + (Math.random() - 0.5) * W * 0.34,
      y1: screenY(1.2, H) - 18,
      x2: bossX + (Math.random() - 0.5) * 30,
      y2: bossY + (Math.random() - 0.5) * 34,
      life: 0.12,
      maxLife: 0.12,
      width: 1.2,
      color,
    });
  }

  updateEffects(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    if (this.bossIntro > 0) this.bossIntro = Math.max(0, this.bossIntro - dt);

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.bossShots.length - 1; i >= 0; i -= 1) {
      const shot = this.bossShots[i];
      shot.t += dt * shot.speed;
      shot.x += (shot.tx - shot.x) * Math.min(1, dt * 2.4);
      shot.y += (shot.ty - shot.y) * Math.min(1, dt * 2.4);
      if (shot.t > 1.2) this.bossShots.splice(i, 1);
    }
  }

  screenOf(z, x) {
    const d = depthOf(z, this.player.z);
    return {
      x: screenX(x, d, this.renderer.width),
      y: screenY(d, this.renderer.height),
      p: perspective(d),
    };
  }

  burstAt(z, xs, color, count, scale = 1) {
    const W = this.renderer.width;
    for (let i = 0; i < count; i += 1) {
      const x = xs[i % xs.length];
      const point = this.screenOf(z, x);
      this.particles.push({
        x: point.x,
        y: point.y - 12,
        vx: (Math.random() - 0.5) * 260 * scale,
        vy: (Math.random() - 0.9) * 230 * scale,
        gravity: 420,
        life: 0.35 + Math.random() * 0.5,
        maxLife: 0.85,
        size: (1.5 + Math.random() * 3.2) * Math.max(0.5, point.p * 1.4) * scale,
        color,
      });
    }
  }

  burstAtPlayer(color, count) {
    const W = this.renderer.width;
    const H = this.renderer.height;
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x: W / 2 + (Math.random() - 0.5) * 90,
        y: H * 0.74 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 280,
        vy: (Math.random() - 0.8) * 240,
        gravity: 380,
        life: 0.4 + Math.random() * 0.6,
        maxLife: 1,
        size: 1.5 + Math.random() * 3,
        color,
      });
    }
  }

  spawnFloater(text, color, size = 1.2) {
    this.floaters.push({
      text,
      x: this.renderer.width / 2 + (Math.random() - 0.5) * this.renderer.width * 0.3,
      y: this.renderer.height * 0.6,
      life: 1.1,
      maxLife: 1.1,
      size: Math.round(16 * size + 4),
      color,
    });
  }

  tapScreen() {
    if (this.phase === 'countdown') this.countdown = Math.min(this.countdown, 0.3);
  }

  finish(won, reason) {
    if (this.finishData || this.phase === 'result') return;
    const survivors = won ? Math.max(1, Math.floor(this.player.count)) : 0;
    const stars = starsFor({ won, survivors, bossEntry: this.bossEntry || this.peak });
    const reward = runReward({
      collected: this.collectedCoins,
      kills: this.killCoins,
      level: this.level.id,
      won,
      stars,
    });
    const earned = Math.round(reward.total * this.coinFactor);
    this.finishData = {
      levelId: this.level.id,
      levelName: this.level.name,
      won,
      stars,
      survivors,
      bossEntry: this.bossEntry,
      peak: Math.floor(this.peak),
      coinsEarned: earned,
      baseCoins: Math.round(reward.base * this.coinFactor),
      bonusCoins: Math.round(reward.bonus * this.coinFactor),
      collected: this.collectedCoins,
      kills: this.killCoins,
      factor: this.coinFactor,
      reason,
    };
    this.phase = 'result';
    this.finishTimer = won ? 1.5 : 1.1;
    this.sfx.play(won ? 'win' : 'lose');
    this.shake = won ? 0.6 : 0.8;
    if (won) {
      this.burstAtPlayer('#fbbf24', 70);
      this.burstAtPlayer('#5eead4', 40);
    }
    this.emitHud(true);
    this.onEvent('result', this.finishData);
  }

  emitHud(force = false) {
    if (this.destroyed) return;
    void force;
    const activeItems = (this.save.loadout || [])
      .map((id) => getItem(id))
      .filter((item) => item && item.type !== 'passive')
      .map((item) => ({ id: item.id, icon: item.icon, color: item.color, name: item.name, count: this.save.items[item.id] || 0 }));
    this.onHud({
      level: this.level,
      phase: this.phase,
      count: Math.max(0, Math.floor(this.player.count)),
      peak: Math.floor(this.peak),
      coins: this.runningCoins,
      progress: clamp(this.player.z / this.boss.z, 0, 1),
      bossActive: this.boss.active,
      bossHp: this.boss.maxHp ? clamp(this.boss.hp / this.boss.maxHp, 0, 1) : 1,
      bossName: this.boss.name,
      buffs: {
        shield: this.buffs.shield,
        magnet: this.buffs.magnet,
        dash: this.buffs.dash,
        drone: this.buffs.drone,
      },
      doubleCoins: this.doubleCoins,
      reviveAvailable: this.reviveAvailable && !this.revived,
      items: activeItems,
      paused: this.paused,
    });
  }

  loop(ts) {
    if (this.destroyed) return;
    if (!this.lastFrame) this.lastFrame = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - this.lastFrame) / 1000));
    this.lastFrame = ts;
    this.update(dt);
    this.renderer.draw(this, ts / 1000);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this.onResize);
  }
}

export { bossModel };
