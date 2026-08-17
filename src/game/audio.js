// Procedural sound effects via Web Audio API — no external audio files needed.
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone({ freq = 440, duration = 0.12, type = "square", gain = 0.15, slideTo = null, delay = 0 }) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), ctx.currentTime + delay + duration);
    }
    amp.gain.setValueAtTime(gain, ctx.currentTime + delay);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  shoot() {
    this.tone({ freq: 880, slideTo: 440, duration: 0.08, type: "square", gain: 0.06 });
  }

  enemyShoot() {
    this.tone({ freq: 220, slideTo: 120, duration: 0.1, type: "sawtooth", gain: 0.05 });
  }

  explosion() {
    this.tone({ freq: 180, slideTo: 30, duration: 0.35, type: "sawtooth", gain: 0.18 });
    this.tone({ freq: 90, slideTo: 20, duration: 0.4, type: "square", gain: 0.1, delay: 0.02 });
  }

  hit() {
    this.tone({ freq: 140, slideTo: 60, duration: 0.25, type: "triangle", gain: 0.2 });
  }

  powerup() {
    this.tone({ freq: 440, slideTo: 880, duration: 0.12, type: "triangle", gain: 0.12 });
    this.tone({ freq: 660, slideTo: 1320, duration: 0.14, type: "triangle", gain: 0.1, delay: 0.08 });
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.14, type: "triangle", gain: 0.12, delay: i * 0.08 });
    });
  }

  gameOver() {
    [400, 340, 280, 200].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.3, type: "sawtooth", gain: 0.15, delay: i * 0.12 });
    });
  }
}
