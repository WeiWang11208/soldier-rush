/** Canvas 伪 3D 渲染器：道路、士兵方阵、倍数门、敌人、BOSS 与粒子特效。 */

import { ROAD_SCREEN_HALF, depthOf, perspective, screenX, screenY } from './camera.js';
import { THEMES, levelById } from './levels.js';
import { formatCount, gateLabel } from './combat.js';
import { getItem } from './items.js';

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function withAlpha(hex, alpha) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(255,255,255,${alpha})`;
  }
  let value = hex.slice(1);
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  const num = parseInt(value, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = 390;
    this.height = 844;
    this.dpr = 1;
    this.themeKey = null;
    this.levelId = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width || window.innerWidth || 390));
    const height = Math.max(480, Math.round(rect.height || window.innerHeight || 844));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.width === width && this.height === height && this.dpr === dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  prepare(level) {
    if (this.levelId === level.id && this.themeKey === level.theme) return;
    this.levelId = level.id;
    this.themeKey = level.theme;
    const theme = THEMES[level.theme] || THEMES.meadow;
    const rand = mulberry32(level.id * 997 + 31);
    this.scenery = {
      stars: Array.from({ length: 90 }, () => ({
        x: rand(),
        y: rand() * 0.5,
        r: 0.4 + rand() * 1.6,
        a: 0.25 + rand() * 0.7,
        tw: 0.4 + rand() * 2,
      })),
      buildings: Array.from({ length: 16 }, (_, i) => {
        const width = 0.04 + rand() * 0.09;
        return {
          x: (i / 16) * 1.12 - 0.06 + rand() * 0.02,
          w: width,
          h: 0.06 + rand() * 0.2,
          windows: Math.floor(2 + rand() * 5),
          tone: rand() > 0.5,
        };
      }),
      hills: Array.from({ length: 7 }, (_, i) => ({
        x: i / 6,
        h: 0.04 + rand() * 0.13,
        w: 0.18 + rand() * 0.16,
      })),
      clouds: Array.from({ length: 6 }, () => ({
        x: rand(),
        y: 0.06 + rand() * 0.24,
        s: 0.5 + rand() * 1.4,
        a: 0.06 + rand() * 0.16,
      })),
      ambient: Array.from({ length: 46 }, () => ({
        x: rand(),
        y: rand(),
        s: 0.6 + rand() * 2.2,
        v: 0.008 + rand() * 0.03,
        drift: (rand() - 0.5) * 0.02,
      })),
      towers: Array.from({ length: 9 }, (_, i) => ({
        x: i / 8,
        h: 0.1 + rand() * 0.24,
        w: 0.03 + rand() * 0.05,
      })),
    };
    void theme;
  }

  clear() {
    this.ctx.fillStyle = '#050a12';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawIdle(time = 0) {
    this.clear();
    const level = levelById(1);
    this.prepare(level);
    const theme = THEMES[level.theme];
    const z = (time * 2.2) % 1000;
    this.drawScenery(theme, z, time);
    this.drawRoad(theme, z, time, 0, 2);
    const fake = {
      theme,
      player: { x: Math.sin(time * 0.35) * 1.2, z, count: 15 },
      phase: 'idle',
      runTime: time,
      shake: 0,
    };
    this.drawCrowd(fake, time, 0.9);
    this.ctx.fillStyle = 'rgba(3, 8, 16, 0.46)';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  draw(game, time) {
    const { ctx, width: W, height: H } = this;
    this.prepare(game.level);
    const theme = game.theme;
    this.clear();

    ctx.save();
    if (game.shake > 0.01) {
      const amount = game.shake * 7;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    this.drawScenery(theme, game.player.z, time);
    this.drawRoad(theme, game.player.z, time, game.player.x, game.laneCount || 2);

    const entities = [];
    for (const gate of game.gates) {
      if (gate.z > game.player.z - 3 && gate.z < game.player.z + 75) {
        entities.push({ z: gate.z, draw: () => this.drawGate(gate, game, time) });
      }
    }
    for (const coin of game.coins) {
      if (!coin.collected && coin.z > game.player.z - 3 && coin.z < game.player.z + 70) {
        entities.push({ z: coin.z, draw: () => this.drawCoin(coin, game, time) });
      }
    }
    for (const crate of game.crates) {
      if (!crate.collected && crate.z > game.player.z - 3 && crate.z < game.player.z + 70) {
        entities.push({ z: crate.z, draw: () => this.drawCrate(crate, game, time) });
      }
    }
    for (const hazard of game.hazards) {
      if (!hazard.cleared && hazard.z > game.player.z - 2 && hazard.z < game.player.z + 60) {
        entities.push({ z: hazard.z, draw: () => this.drawHazard(hazard, game, time) });
      }
    }
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      if (enemy.z > game.player.z - 2 && enemy.z < game.player.z + 65) {
        entities.push({ z: enemy.z, draw: () => this.drawEnemy(enemy, game, time) });
      }
    }
    if (game.boss && (game.boss.active || game.boss.z < game.player.z + 70)) {
      entities.push({ z: game.boss.z, draw: () => this.drawBoss(game.boss, game, time) });
    }
    entities.sort((a, b) => b.z - a.z);
    for (const entity of entities) entity.draw();

    this.drawBossEffects(game, time);
    this.drawCrowd(game, time);
    this.drawParticles(game);
    this.drawFloaters(game);

    ctx.restore();

    if (game.hitFlash > 0) {
      const alpha = Math.min(0.5, game.hitFlash * 0.5);
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7);
      grad.addColorStop(0, 'rgba(255,40,60,0)');
      grad.addColorStop(1, `rgba(255,40,60,${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    if (game.countdown > 0) this.drawCountdown(game.countdown);
    if (game.bossIntro > 0 && game.boss) this.drawBossIntro(game);
  }

  drawScenery(theme, playerZ, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon + H * 0.1);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, theme.far);
    ground.addColorStop(0.35, theme.near);
    ground.addColorStop(1, theme.haze);
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);

    // 星点 / 光尘
    for (const star of this.scenery.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(time * star.tw + star.x * 20);
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = theme.particle;
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (theme.kind === 'space') this.drawSpace(theme, time);
    if (theme.kind === 'city') this.drawCity(theme, playerZ, time);
    if (theme.kind === 'factory') this.drawFactory(theme, playerZ, time);
    if (theme.kind === 'castle') this.drawCastle(theme, time);
    if (theme.kind === 'graveyard') this.drawGraveyard(theme, time);
    if (theme.kind === 'hills') this.drawHills(theme, playerZ);
    if (theme.kind === 'dunes') this.drawDunes(theme, playerZ);
    if (theme.kind === 'peaks') this.drawPeaks(theme, playerZ);
    if (theme.kind === 'volcano') this.drawVolcano(theme, time);
    if (theme.kind === 'sky') this.drawSky(theme, time);

    // 地平线雾
    const fog = ctx.createLinearGradient(0, horizon - H * 0.02, 0, horizon + H * 0.14);
    fog.addColorStop(0, withAlpha(theme.haze, 0.1));
    fog.addColorStop(1, withAlpha(theme.haze, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - H * 0.02, W, H * 0.16);

    this.drawAmbient(theme, time);
  }

  drawHills(theme, playerZ) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const offset = (playerZ * 1.4) % W;
    const ridge = (baseY, amp, color, alpha, speed) => {
      ctx.beginPath();
      ctx.moveTo(-40, baseY + 20);
      for (let x = -40; x <= W + 40; x += 12) {
        const y = baseY - Math.abs(Math.sin((x + offset * speed) * 0.011)) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 40, horizon + H * 0.1);
      ctx.lineTo(-40, horizon + H * 0.1);
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    ridge(horizon + 4, H * 0.11, theme.far, 0.9, 0.35);
    ridge(horizon + 16, H * 0.07, theme.near, 0.95, 0.7);
    for (const cloud of this.scenery.clouds) {
      const x = (((cloud.x + offset / W) % 1.2) - 0.1) * W;
      const y = cloud.y * horizon;
      ctx.globalAlpha = cloud.a;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(x + i * 18 * cloud.s, y, 26 * cloud.s, 11 * cloud.s, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawDunes(theme, playerZ) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const sunX = W * 0.74;
    const sunY = horizon - H * 0.16;
    const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, W * 0.35);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon + 40);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, W * 0.075, 0, TAU);
    ctx.fill();
    for (let layer = 0; layer < 2; layer += 1) {
      ctx.beginPath();
      ctx.moveTo(-20, horizon + H * 0.12);
      for (let x = -20; x <= W + 20; x += 10) {
        const y =
          horizon +
          8 +
          layer * 16 +
          Math.sin((x + playerZ * (4 + layer * 3)) * 0.008) * H * 0.035 +
          Math.sin(x * 0.021) * H * 0.012;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, horizon + H * 0.2);
      ctx.lineTo(-20, horizon + H * 0.2);
      ctx.closePath();
      ctx.fillStyle = layer === 0 ? theme.far : theme.near;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawPeaks(theme, playerZ) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const moonX = W * 0.22;
    const moonY = horizon - H * 0.18;
    ctx.fillStyle = 'rgba(226, 244, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, W * 0.06, 0, TAU);
    ctx.fill();
    const offset = (playerZ * 2) % 120;
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 0.18 * W - offset * 0.6 + W * 1.2) % (W * 1.2)) - W * 0.1;
      const peakH = H * (0.1 + (i % 3) * 0.035);
      ctx.beginPath();
      ctx.moveTo(x - W * 0.16, horizon + 10);
      ctx.lineTo(x, horizon + 10 - peakH);
      ctx.lineTo(x + W * 0.16, horizon + 10);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, horizon - peakH, 0, horizon + 10);
      grad.addColorStop(0, '#dbeafe');
      grad.addColorStop(0.35, theme.far);
      grad.addColorStop(1, theme.near);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.fillStyle = theme.near;
    ctx.fillRect(0, horizon + 6, W, H * 0.1);
  }

  drawCity(theme, playerZ, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const base = horizon + H * 0.06;
    const offset = (playerZ * 7) % 1;
    for (const b of this.scenery.buildings) {
      const x = ((b.x - offset * 0.12 + 1.2) % 1.2) * W - W * 0.1;
      const h = b.h * H;
      const bw = b.w * W;
      ctx.fillStyle = b.tone ? withAlpha(theme.far, 0.95) : withAlpha(theme.near, 0.98);
      ctx.fillRect(x, base - h, bw, h + H * 0.1);
      const rows = Math.max(2, Math.floor(h / 18));
      ctx.fillStyle = withAlpha(theme.accent, 0.34);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          if ((r + c + Math.floor(b.x * 10)) % 3 === 0) continue;
          ctx.fillRect(x + 4 + c * (bw - 10), base - h + 8 + r * 15, Math.max(2, bw * 0.18), 3);
        }
      }
    }
    // 霓虹招牌光带
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i += 1) {
      const y = horizon - 15 - i * 24 + Math.sin(time * 1.2 + i) * 3;
      const grad = ctx.createLinearGradient(0, y, W, y);
      grad.addColorStop(0, 'rgba(232,121,249,0)');
      grad.addColorStop(0.5, 'rgba(232,121,249,0.5)');
      grad.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, W, 2);
    }
    ctx.globalAlpha = 1;
  }

  drawFactory(theme, playerZ, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const offset = (playerZ * 5) % 60;
    for (const tower of this.scenery.towers) {
      const x = ((tower.x * W - offset + W) % (W * 1.1)) - W * 0.05;
      const h = tower.h * H;
      const w = tower.w * W;
      ctx.fillStyle = withAlpha(theme.far, 0.95);
      ctx.fillRect(x, horizon - h + 20, w, h);
      ctx.fillStyle = withAlpha(theme.accent, 0.55);
      ctx.fillRect(x + w * 0.2, horizon - h + 24, w * 0.6, 4);
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = withAlpha(theme.accent, 0.14 + (Math.sin(time * 2 + i + tower.x * 9) + 1) * 0.1);
        ctx.fillRect(x + w * 0.2, horizon - h + 40 + i * 14, w * 0.6, 5);
      }
    }
    ctx.strokeStyle = withAlpha(theme.accent, 0.12);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, horizon - 10 - i * 12);
      ctx.lineTo(W, horizon - 22 - i * 12);
      ctx.stroke();
    }
  }

  drawGraveyard(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const moonX = W * 0.26;
    const moonY = horizon - H * 0.2;
    const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, W * 0.28);
    glow.addColorStop(0, 'rgba(199, 210, 254, 0.4)');
    glow.addColorStop(1, 'rgba(199, 210, 254, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon + 30);
    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.arc(moonX, moonY, W * 0.075, 0, TAU);
    ctx.fill();
    ctx.fillStyle = withAlpha(theme.far, 0.9);
    ctx.fillRect(0, horizon + 4, W, H * 0.12);
    ctx.fillStyle = withAlpha(theme.near, 0.95);
    for (let i = 0; i < 10; i += 1) {
      const x = ((i * 0.11 + 0.03) * W + Math.sin(i * 7.3) * 12) % W;
      const h = 16 + (i % 4) * 5;
      ctx.fillRect(x, horizon + 12 - h, 9, h);
      ctx.beginPath();
      ctx.arc(x + 4.5, horizon + 12 - h, 4.5, Math.PI, 0);
      ctx.fill();
    }
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 0.17 + 0.08) * W + Math.sin(i * 3.1) * 20) % W;
      const y = horizon + 6 + (i % 3) * 9;
      ctx.globalAlpha = 0.1 + Math.sin(time * 1.5 + i) * 0.05;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + i * 2, 10, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawVolcano(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const grad = ctx.createLinearGradient(0, horizon - H * 0.22, 0, horizon + 20);
    grad.addColorStop(0, '#450a0a');
    grad.addColorStop(1, theme.near);
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, horizon + 20);
    ctx.lineTo(W * 0.28, horizon - H * 0.2);
    ctx.lineTo(W * 0.38, horizon - H * 0.19);
    ctx.lineTo(W * 0.52, horizon - H * 0.05);
    ctx.lineTo(W * 0.72, horizon - H * 0.16);
    ctx.lineTo(W * 1.05, horizon + 20);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    const lava = ctx.createLinearGradient(W * 0.28, horizon - H * 0.2, W * 0.34, horizon);
    lava.addColorStop(0, 'rgba(253, 186, 116, 0.9)');
    lava.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.strokeStyle = lava;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W * 0.31, horizon - H * 0.18);
    ctx.quadraticCurveTo(W * 0.27, horizon - H * 0.08, W * 0.34, horizon - H * 0.01);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + Math.sin(time * 3) * 0.2;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(W * 0.31, horizon - H * 0.2, 10, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawSky(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    for (const cloud of this.scenery.clouds) {
      const x = ((cloud.x + time * 0.008 * cloud.s) % 1.2) * W - W * 0.1;
      const y = (cloud.y * 0.8 + 0.08) * H;
      ctx.globalAlpha = 0.12 + cloud.a;
      ctx.fillStyle = '#e0f2fe';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.ellipse(x + i * 22 * cloud.s, y, 30 * cloud.s, 13 * cloud.s, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i += 1) {
      const x = W * (0.2 + i * 0.3) - ((time * 6) % 40);
      const y = horizon + 20 + i * 12;
      ctx.fillStyle = withAlpha(theme.far, 0.55);
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.1, 12, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawCastle(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const base = horizon + 8;
    const grad = ctx.createLinearGradient(0, base - H * 0.2, 0, base);
    grad.addColorStop(0, '#450a0a');
    grad.addColorStop(1, theme.near);
    ctx.fillStyle = grad;
    const blocks = [
      [-0.05, 0.16, 0.02],
      [0.04, 0.11, 0.12],
      [0.12, 0.19, 0.0],
      [0.22, 0.08, 0.16],
      [0.62, 0.1, 0.12],
      [0.7, 0.18, 0.02],
      [0.84, 0.13, 0.1],
    ];
    for (const [x, w, h] of blocks) {
      ctx.fillRect(x * W, base - (0.1 + h) * H * 0.6, w * W, (0.1 + h) * H * 0.6);
      // battlements
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(
          x * W + i * (w * W * 0.34),
          base - (0.1 + h) * H * 0.6 - 8,
          w * W * 0.18,
          8,
        );
      }
    }
    ctx.fillStyle = withAlpha(theme.accent, 0.3 + Math.sin(time * 2) * 0.1);
    ctx.beginPath();
    ctx.arc(W * 0.5, base - H * 0.28, W * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = withAlpha('#000000', 0.55);
    ctx.beginPath();
    ctx.arc(W * 0.5, base - H * 0.28, W * 0.1, 0, TAU);
    ctx.fill();
  }

  drawSpace(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    const planetX = W * 0.78;
    const planetY = horizon - H * 0.17;
    const grad = ctx.createRadialGradient(planetX - W * 0.03, planetY - W * 0.03, 2, planetX, planetY, W * 0.13);
    grad.addColorStop(0, '#7dd3fc');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(planetX, planetY, W * 0.11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,211,252,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, W * 0.19, W * 0.06, -0.3, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const y = horizon + 10 + i * 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    void time;
  }

  drawAmbient(theme, time) {
    const { ctx, width: W, height: H } = this;
    const horizon = H * 0.285;
    for (const p of this.scenery.ambient) {
      const y = ((p.y + time * p.v) % 1) * (H - horizon) + horizon;
      const x = ((p.x + time * p.drift) % 1) * W;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = theme.particle;
      if (theme.kind === 'space') {
        ctx.fillRect(x, y, p.s, p.s);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.s * 0.7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawRoad(theme, playerZ, time, playerX, laneCount = 2) {
    const { ctx, width: W, height: H } = this;
    const dNear = 0.35;
    const dFar = 90;
    const halfNear = W * ROAD_SCREEN_HALF * perspective(dNear);
    const halfFar = W * ROAD_SCREEN_HALF * perspective(dFar);
    const yNear = screenY(dNear, H);
    const yFar = screenY(dFar, H);

    // 路肩
    ctx.fillStyle = withAlpha(theme.roadEdge, 0.08);
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfNear * 1.28, yNear);
    ctx.lineTo(W / 2 + halfNear * 1.28, yNear);
    ctx.lineTo(W / 2 + halfFar * 1.28, yFar);
    ctx.lineTo(W / 2 - halfFar * 1.28, yFar);
    ctx.closePath();
    ctx.fill();

    const roadGrad = ctx.createLinearGradient(0, yFar, 0, yNear);
    roadGrad.addColorStop(0, withAlpha(theme.road, 0.9));
    roadGrad.addColorStop(1, theme.road);
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfNear, yNear);
    ctx.lineTo(W / 2 + halfNear, yNear);
    ctx.lineTo(W / 2 + halfFar, yFar);
    ctx.lineTo(W / 2 - halfFar, yFar);
    ctx.closePath();
    ctx.fill();

    // 车道虚线
    const separators = laneCount === 3 ? [-1.65, 1.65] : [0];
    ctx.strokeStyle = withAlpha(theme.roadEdge, 0.32);
    ctx.lineWidth = 1.5;
    for (const laneX of separators) {
      const start = Math.floor((playerZ - 4) / 4) * 4;
      for (let z = start; z < playerZ + 60; z += 4) {
        const d1 = depthOf(z, playerZ);
        const d2 = depthOf(z + 2, playerZ);
        const x1 = screenX(laneX, d1, W);
        const x2 = screenX(laneX, d2, W);
        ctx.beginPath();
        ctx.moveTo(x1, screenY(d1, H));
        ctx.lineTo(x2, screenY(d2, H));
        ctx.stroke();
      }
    }

    // 道路边缘光
    ctx.strokeStyle = withAlpha(theme.roadEdge, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfNear, yNear);
    ctx.lineTo(W / 2 - halfFar, yFar);
    ctx.moveTo(W / 2 + halfNear, yNear);
    ctx.lineTo(W / 2 + halfFar, yFar);
    ctx.stroke();

    // 路边灯柱
    for (let z = Math.floor(playerZ / 14) * 14; z < playerZ + 70; z += 14) {
      const d = depthOf(z, playerZ);
      const s = perspective(d) * (W / 400);
      const y = screenY(d, H);
      for (const side of [-1, 1]) {
        const x = screenX(side * 5.6, d, W);
        ctx.strokeStyle = withAlpha(theme.roadEdge, 0.25);
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 26 * s);
        ctx.stroke();
        ctx.fillStyle = withAlpha(theme.accent, 0.55);
        ctx.beginPath();
        ctx.arc(x, y - 28 * s, Math.max(1.2, 2.4 * s), 0, TAU);
        ctx.fill();
      }
    }
    void time;
  }

  drawGate(gate, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(gate.z, game.player.z);
    const p = perspective(d);
    if (p < 0.04) return;
    const y = screenY(d, H);
    const unit = (W * ROAD_SCREEN_HALF * p) / 5;
    const laneWidth = gate.lanes.length === 2 ? 2.42 : 1.52;
    const height = 2.75 * unit;
    const pulse = 1 + Math.sin(time * 4 + gate.z) * 0.02;

    gate.lanes.forEach((token, index) => {
      const laneX = gate.lanes.length === 3 ? [-3.2, 0, 3.2][index] : [-2.5, 2.5][index];
      const cx = screenX(laneX, d, W);
      const half = laneWidth * unit;
      const positive = token.startsWith('+') || token.startsWith('x');
      const color = positive ? '#34d399' : '#fb7185';
      const h = height * pulse;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.lineTo(cx + half * 0.99, y - h);
      ctx.lineTo(cx - half * 0.99, y - h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, y - h, 0, y);
      grad.addColorStop(0, withAlpha(color, 0.42));
      grad.addColorStop(0.55, withAlpha(color, 0.15));
      grad.addColorStop(1, withAlpha(color, 0.05));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.lineWidth = Math.max(1.2, 2.4 * p);
      ctx.stroke();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 * p;
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(Math.min(46, h * 0.47))}px "Noto Sans SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gateLabel(token), cx, y - h * 0.52);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // 门上方的横梁
    const laneXs = gate.lanes.length === 3 ? [-3.2, 0, 3.2] : [-2.5, 2.5];
    const left = screenX(laneXs[0] - laneWidth, d, W);
    const right = screenX(laneXs[laneXs.length - 1] + laneWidth, d, W);
    ctx.strokeStyle = withAlpha('#e2e8f0', 0.25);
    ctx.lineWidth = Math.max(1, 2 * p);
    ctx.beginPath();
    ctx.moveTo(left, y - height - 4 * p);
    ctx.lineTo(right, y - height - 4 * p);
    ctx.stroke();
  }

  drawCoin(coin, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(coin.z, game.player.z);
    const p = perspective(d);
    if (p < 0.03) return;
    const y = screenY(d, H) - 14 * p * (W / 400) - Math.sin(time * 5 + coin.z) * 4 * p;
    const x = screenX(coin.x, d, W);
    const r = Math.max(2, 7.5 * p * (W / 400));
    ctx.save();
    ctx.translate(x, y);
    const squash = 0.65 + Math.abs(Math.sin(time * 3 + coin.z)) * 0.35;
    ctx.scale(squash, 1);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    grad.addColorStop(0, '#fef9c3');
    grad.addColorStop(0.55, '#facc15');
    grad.addColorStop(1, '#b45309');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(0.5, r * 0.12);
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.font = `900 ${Math.max(4, r * 1.05)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('兵', 0, r * 0.05);
    ctx.restore();
  }

  drawCrate(crate, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(crate.z, game.player.z);
    const p = perspective(d);
    if (p < 0.03) return;
    const item = getItem(crate.buff);
    const color = item?.color || '#a78bfa';
    const x = screenX(crate.x, d, W);
    const y = screenY(d, H) - 20 * p * (W / 400) + Math.sin(time * 3 + crate.z) * 3 * p;
    const size = Math.max(8, 22 * p * (W / 400));
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * p;
    const grad = ctx.createLinearGradient(0, -size, 0, size);
    grad.addColorStop(0, withAlpha(color, 0.95));
    grad.addColorStop(1, withAlpha(color, 0.35));
    ctx.fillStyle = grad;
    roundRect(ctx, -size, -size, size * 2, size * 2, size * 0.28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(0.8, 1.6 * p);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#08131f';
    ctx.font = `900 ${Math.round(size * 1.0)}px "Noto Sans SC", system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item?.icon || '?', 0, 1);
    ctx.restore();
  }

  drawHazard(hazard, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(hazard.z, game.player.z);
    const p = perspective(d);
    if (p < 0.03) return;
    const x = screenX(hazard.x, d, W);
    const y = screenY(d, H);
    const s = p * (W / 400);
    ctx.save();
    ctx.translate(x, y);
    if (hazard.type === 'saw') {
      const r = 14 * s;
      ctx.rotate(time * 5 + hazard.z);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * TAU;
        const radius = i % 2 === 0 ? r : r * 0.72;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, TAU);
      ctx.fill();
    } else {
      const w = 15 * s;
      const h = 20 * s;
      const grad = ctx.createLinearGradient(-w, 0, w, 0);
      grad.addColorStop(0, '#7c2d12');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = grad;
      roundRect(ctx, -w, -h, w * 2, h, 4 * s);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = Math.max(0.8, 1.5 * s);
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.55);
      ctx.lineTo(w, -h * 0.55);
      ctx.moveTo(-w, -h * 0.15);
      ctx.lineTo(w, -h * 0.15);
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(0, -h * 0.85, 2.4 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemy(enemy, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(enemy.z, game.player.z);
    const p = perspective(d);
    if (p < 0.03) return;
    const x = screenX(enemy.x, d, W);
    const y = screenY(d, H);
    const s = p * (W / 400);
    const visible = Math.min(9, enemy.count);
    const cols = 3;
    const rows = Math.ceil(visible / cols);
    for (let i = visible - 1; i >= 0; i -= 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const offsetX = (col - (cols - 1) / 2) * 0.42;
      const offsetZ = (rows - row) * 0.28;
      const dd = d + offsetZ;
      const pp = perspective(dd);
      const ex = screenX(enemy.x + offsetX, dd, W);
      const ey = screenY(dd, H);
      this.drawSoldier(ex, ey, pp * (W / 400) * 0.8, '#fb7185', '#7f1d1d', time * 7 + i, true);
    }
    // 人数标签
    const label = formatCount(enemy.count);
    const ly = y - 34 * s - rows * 2;
    ctx.save();
    ctx.font = `800 ${Math.round(Math.max(8, 12 * s + 6))}px "Noto Sans SC", system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 14;
    const th = Math.max(12, 16 * s + 6);
    ctx.fillStyle = 'rgba(127, 29, 29, 0.72)';
    roundRect(ctx, x - tw / 2, ly - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffe4e6';
    ctx.fillText(label, x, ly + 0.5);
    ctx.restore();
  }

  drawBoss(boss, game, time) {
    const { ctx, width: W, height: H } = this;
    const d = depthOf(boss.z, game.player.z);
    const p = perspective(d);
    if (p < 0.02) return;
    const x = screenX(0, d, W);
    const y = screenY(d, H);
    const s = p * (W / 400) * 3.2;
    const bob = Math.sin(time * 2.2) * 2 * p;
    ctx.save();
    ctx.translate(x, y + bob);

    // 光环
    const aura = ctx.createRadialGradient(0, -30 * s, 2, 0, -30 * s, 70 * s);
    aura.addColorStop(0, boss.hitFlash > 0 ? 'rgba(255,255,255,0.45)' : 'rgba(248, 113, 113, 0.18)');
    aura.addColorStop(1, 'rgba(248, 113, 113, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -30 * s, 70 * s, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 26 * s, 7 * s, 0, 0, TAU);
    ctx.fill();

    const bodyColor = boss.hitFlash > 0 ? '#fecaca' : '#b91c1c';
    const trim = boss.kind === 'king' ? '#fbbf24' : '#fda4af';
    // 腿
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 6 * s, -10 * s);
      ctx.lineTo(side * 8 * s, 0);
      ctx.stroke();
    }
    // 身体
    ctx.fillStyle = bodyColor;
    roundRect(ctx, -11 * s, -30 * s, 22 * s, 24 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(-11 * s, -17 * s, 22 * s, 3 * s);
    // 头
    ctx.fillStyle = '#fecdd3';
    ctx.beginPath();
    ctx.arc(0, -38 * s, 8 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, -41 * s, 8.5 * s, Math.PI, 0);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fef08a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 3 * s, -38 * s, 1.4 * s, 0, TAU);
      ctx.fill();
    }
    // 武器
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(9 * s, -24 * s);
    ctx.lineTo(22 * s, -34 * s);
    ctx.stroke();
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.arc(23 * s, -35 * s, 5 * s, 0, TAU);
    ctx.fill();
    if (boss.kind === 'king') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-7 * s, -46 * s);
      ctx.lineTo(-5 * s, -54 * s);
      ctx.lineTo(0, -48 * s);
      ctx.lineTo(5 * s, -54 * s);
      ctx.lineTo(7 * s, -46 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawCrowd(game, time, alpha = 1) {
    const { ctx, width: W, height: H } = this;
    const player = game.player;
    const count = Math.floor(player.count);
    if (count <= 0) return;
    const visible = Math.min(34, count);
    const cols = count >= 12 ? 5 : 4;
    const rows = Math.ceil(visible / cols);
    const phase = (game.runTime || time) * 9;
    ctx.save();
    ctx.globalAlpha = alpha;

    for (let i = visible - 1; i >= 0; i -= 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const offsetX = (col - (cols - 1) / 2) * 0.58;
      const dBack = row * 0.62;
      const bob = Math.sin(phase + i * 0.7) * 0.12;
      const dd = 1.2 + dBack;
      const p = perspective(dd);
      const x = screenX(player.x + offsetX, dd, W) + Math.sin(phase * 0.7 + i) * 1.2;
      const y = screenY(dd, H) + bob * 8;
      const s = p * (W / 400) * (row === 0 ? 1.06 : 1);
      this.drawSoldier(
        x,
        y,
        s,
        i % 7 === 0 ? '#67e8f9' : '#38bdf8',
        i % 7 === 0 ? '#0e7490' : '#075985',
        phase + i,
        false,
      );
    }

    // 队伍人数
    const d = 1.2;
    const p = perspective(d);
    const x = screenX(player.x, d, W);
    const y = screenY(d, H) - (rows + 1) * 7 - 42 * p * (W / 400);
    const label = formatCount(count);
    const fontSize = Math.round(Math.max(16, 26 * p * (W / 400) + 8));
    ctx.font = `900 ${fontSize}px "Noto Sans SC", system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 26;
    const th = fontSize + 12;
    const grad = ctx.createLinearGradient(0, y - th / 2, 0, y + th / 2);
    grad.addColorStop(0, 'rgba(8, 47, 73, 0.9)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.82)');
    ctx.fillStyle = grad;
    roundRect(ctx, x - tw / 2, y - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f0f9ff';
    ctx.fillText(label, x, y + 1);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawSoldier(x, y, scale, color, dark, phase, enemy) {
    const { ctx } = this;
    if (scale <= 0.01) return;
    const s = scale * 34;
    const bob = Math.sin(phase * 1.3) * s * 0.05;
    const leg = Math.sin(phase * 1.3) * s * 0.16;
    ctx.save();
    ctx.translate(x, y + bob);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.2, s * 0.07, 0, 0, TAU);
    ctx.fill();

    // 腿
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, s * 0.11);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, -s * 0.3);
    ctx.lineTo(-s * 0.07 - leg, -s * 0.02);
    ctx.moveTo(s * 0.07, -s * 0.3);
    ctx.lineTo(s * 0.07 + leg, -s * 0.02);
    ctx.stroke();

    // 身体
    const bodyGrad = ctx.createLinearGradient(0, -s * 0.72, 0, -s * 0.24);
    bodyGrad.addColorStop(0, color);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, -s * 0.17, -s * 0.68, s * 0.34, s * 0.4, s * 0.1);
    ctx.fill();

    // 背包
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -s * 0.12, -s * 0.58, s * 0.24, s * 0.2, s * 0.05);
    ctx.fill();

    // 头
    ctx.fillStyle = enemy ? '#fecdd3' : '#fde7c8';
    ctx.beginPath();
    ctx.arc(0, -s * 0.82, s * 0.15, 0, TAU);
    ctx.fill();

    // 头盔
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, -s * 0.84, s * 0.16, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.fillRect(-s * 0.16, -s * 0.86, s * 0.32, s * 0.035);

    // 枪
    ctx.strokeStyle = enemy ? '#fecaca' : '#e2e8f0';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.56);
    ctx.lineTo(s * 0.3, -s * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  drawParticles(game) {
    const { ctx } = this;
    for (const p of game.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(game) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of game.floaters) {
      const alpha = Math.max(0, f.life / f.maxLife);
      ctx.globalAlpha = Math.min(1, alpha * 1.6);
      ctx.font = `900 ${f.size}px "Noto Sans SC", system-ui`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawBossEffects(game, time) {
    const { ctx, width: W, height: H } = this;
    const boss = game.boss;
    if (!boss || !boss.active) return;
    const d = depthOf(boss.z, game.player.z);
    const bossX = screenX(0, d, W);
    const bossY = screenY(d, H) - 70 * perspective(d) * (W / 400);

    for (const shot of game.bossShots || []) {
      ctx.fillStyle = shot.color || '#fb7185';
      ctx.shadowColor = shot.color || '#fb7185';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const tracer of game.tracers || []) {
      ctx.strokeStyle = withAlpha(tracer.color || '#7dd3fc', Math.min(1, tracer.life * 5));
      ctx.lineWidth = tracer.width || 1.4;
      ctx.beginPath();
      ctx.moveTo(tracer.x1, tracer.y1);
      ctx.lineTo(tracer.x2, tracer.y2);
      ctx.stroke();
    }
    void time;
  }

  drawCountdown(value) {
    const { ctx, width: W, height: H } = this;
    const seconds = Math.ceil(value);
    const text = seconds >= 2 ? String(seconds - 1) : '冲!';
    const frac = value - Math.floor(value);
    const scale = 1 + frac * 0.5;
    ctx.save();
    ctx.translate(W / 2, H * 0.44);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, frac * 2.2);
    ctx.font = `900 ${Math.round(W * 0.2)}px "Noto Sans SC", system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.7)';
    ctx.strokeText(text, 0, 0);
    const grad = ctx.createLinearGradient(0, -W * 0.1, 0, W * 0.1);
    grad.addColorStop(0, '#fef9c3');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  drawBossIntro(game) {
    const { ctx, width: W, height: H } = this;
    const alpha = Math.min(1, game.bossIntro * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    const y = H * 0.36;
    ctx.fillStyle = 'rgba(69, 10, 10, 0.72)';
    ctx.fillRect(0, y - 34, W, 68);
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y - 34);
    ctx.lineTo(W, y - 34);
    ctx.moveTo(0, y + 34);
    ctx.lineTo(W, y + 34);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fda4af';
    ctx.font = '700 12px "Noto Sans SC", system-ui';
    ctx.fillText('— 最终决战 —', W / 2, y - 16);
    ctx.fillStyle = '#fff1f2';
    ctx.font = `900 ${Math.round(W * 0.085)}px "Noto Sans SC", system-ui`;
    ctx.fillText(game.boss.name, W / 2, y + 12);
    ctx.restore();
  }
}
