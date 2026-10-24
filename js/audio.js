/** 无素材音效：WebAudio 实时合成，首次交互后解锁。 */

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
  }

  tone({ freq = 440, endFreq = null, dur = 0.12, type = 'sine', gain = 0.5, delay = 0, attack = 0.005 }) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.3, delay = 0, cutoff = 900 } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    src.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(now);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 520, endFreq: 760, dur: 0.06, type: 'square', gain: 0.18 });
        break;
      case 'gateGood':
        [523, 659, 784].forEach((freq, i) =>
          this.tone({ freq, dur: 0.11, type: 'triangle', gain: 0.3, delay: i * 0.055 }),
        );
        break;
      case 'gateBad':
        this.tone({ freq: 240, endFreq: 110, dur: 0.2, type: 'sawtooth', gain: 0.25 });
        break;
      case 'coin':
        this.tone({ freq: 1046, endFreq: 1568, dur: 0.07, type: 'sine', gain: 0.2 });
        break;
      case 'crate':
        [660, 880, 1180].forEach((freq, i) =>
          this.tone({ freq, dur: 0.1, type: 'square', gain: 0.16, delay: i * 0.05 }),
        );
        break;
      case 'item':
        this.tone({ freq: 320, endFreq: 980, dur: 0.22, type: 'triangle', gain: 0.35 });
        break;
      case 'hit':
        this.noise({ dur: 0.18, gain: 0.35, cutoff: 700 });
        this.tone({ freq: 120, endFreq: 70, dur: 0.18, type: 'sine', gain: 0.4 });
        break;
      case 'shoot':
        this.noise({ dur: 0.04, gain: 0.08, cutoff: 2400 });
        break;
      case 'bossHit':
        this.tone({ freq: 90, endFreq: 55, dur: 0.16, type: 'sawtooth', gain: 0.3 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((freq, i) =>
          this.tone({ freq, dur: 0.32, type: 'triangle', gain: 0.35, delay: i * 0.12 }),
        );
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((freq, i) =>
          this.tone({ freq, dur: 0.3, type: 'sawtooth', gain: 0.18, delay: i * 0.14 }),
        );
        break;
      case 'revive':
        [262, 392, 523, 784].forEach((freq, i) =>
          this.tone({ freq, dur: 0.26, type: 'square', gain: 0.16, delay: i * 0.1 }),
        );
        break;
      case 'tick':
        this.tone({ freq: 740, dur: 0.07, type: 'square', gain: 0.14 });
        break;
      case 'go':
        this.tone({ freq: 980, endFreq: 1320, dur: 0.2, type: 'triangle', gain: 0.3 });
        break;
      default:
        break;
    }
  }
}
