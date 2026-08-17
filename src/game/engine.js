import {
  createPlayer,
  createEnemy,
  createBullet,
  createParticle,
  createPowerUp,
  ENEMY_TYPES,
  POWERUP_TYPES,
} from "./entities";
import { rand, randInt, clamp, weightedChoice, rectsOverlap } from "./utils";
import { SoundManager } from "./audio";

const HIGH_SCORE_KEY = "neon-blaster-highscore";
const MAX_DT = 1 / 30;

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;
    this.sound = new SoundManager();

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.state = "menu";
    this.keys = new Set();
    this.pointer = { active: false, x: 0, y: 0, firing: false };

    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

    this._initStars();
    this._resetRun();

    this.rafId = null;
    this.lastTime = 0;
    this.shake = 0;
    this.levelUpFlash = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._loop = this._loop.bind(this);

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
  }

  resize(cssWidth, cssHeight) {
    this.width = cssWidth;
    this.height = cssHeight;
    this.canvas.width = cssWidth * this.dpr;
    this.canvas.height = cssHeight * this.dpr;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.player) {
      this.player.x = clamp(this.player.x, 0, this.width - this.player.width);
      this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
    }
  }

  _initStars() {
    this.stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: rand(0.2, 1),
      size: rand(0.6, 2),
    }));
  }

  _resetRun() {
    this.player = createPlayer(this.width || 400, this.height || 600);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.score = 0;
    this.level = 1;
    this.nextLevelScore = 150;
    this.spawnTimer = 1;
    this.combo = 0;
    this.comboTimer = 0;
  }

  start() {
    this.sound.ensureContext();
    this._resetRun();
    this.state = "playing";
    this._emitHud();
    this._emitState();
    this.lastTime = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this._loop);
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
    } else if (this.state === "paused") {
      this.state = "playing";
      this.lastTime = performance.now();
    }
    this._emitState();
  }

  toggleMute() {
    const muted = this.sound.toggleMute();
    this._emitState();
    return muted;
  }

  _gameOver() {
    this.state = "gameover";
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
    }
    this.sound.gameOver();
    this._emitHud();
    this._emitState();
  }

  _emitHud() {
    this.callbacks.onHudUpdate?.({
      score: this.score,
      level: this.level,
      lives: this.player?.lives ?? 0,
      highScore: this.highScore,
      combo: this.combo,
      rapid: this.player?.rapidTimer > 0,
      spread: this.player?.spreadTimer > 0,
      shield: this.player?.shieldTimer > 0,
    });
  }

  _emitState() {
    this.callbacks.onStateChange?.({ state: this.state, muted: this.sound.muted });
  }

  _onKeyDown(e) {
    this.keys.add(e.code);
    if (e.code === "Escape" && (this.state === "playing" || this.state === "paused")) {
      this.togglePause();
    }
    if (e.code === "KeyM") this.toggleMute();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _canvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onPointerDown(e) {
    this.pointer.active = true;
    this.pointer.firing = true;
    const p = this._canvasPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
  }

  _onPointerMove(e) {
    if (!this.pointer.active) return;
    const p = this._canvasPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
  }

  _onPointerUp() {
    this.pointer.active = false;
    this.pointer.firing = false;
  }

  _loop(now) {
    this.rafId = requestAnimationFrame(this._loop);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    if (this.state === "playing") {
      this.update(dt);
    }
    this.draw();
  }

  update(dt) {
    const p = this.player;

    // movement
    let dx = 0;
    let dy = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      p.x += (dx / len) * p.speed * dt;
      p.y += (dy / len) * p.speed * dt;
    } else if (this.pointer.active) {
      const targetX = this.pointer.x - p.width / 2;
      const targetY = this.pointer.y - p.height / 2;
      p.x += (targetX - p.x) * clamp(dt * 10, 0, 1);
      p.y += (targetY - p.y) * clamp(dt * 10, 0, 1);
    }
    p.x = clamp(p.x, 0, this.width - p.width);
    p.y = clamp(p.y, 0, this.height - p.height);

    // timers
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.rapidTimer = Math.max(0, p.rapidTimer - dt);
    p.spreadTimer = Math.max(0, p.spreadTimer - dt);
    p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - dt * 4);
    this.levelUpFlash = Math.max(0, this.levelUpFlash - dt);

    const wantsFire = this.keys.has("Space") || this.pointer.firing;
    if (wantsFire && p.cooldown === 0) {
      this._playerShoot();
    }

    // spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnEnemy();
      const base = clamp(1.1 - this.level * 0.06, 0.28, 1.1);
      this.spawnTimer = rand(base * 0.6, base * 1.2);
    }

    this._updateBullets(dt);
    this._updateEnemies(dt);
    this._updateParticles(dt);
    this._updatePowerups(dt);
    this._handleCollisions();

    if (this.score >= this.nextLevelScore) {
      this.level += 1;
      this.nextLevelScore += 150 + this.level * 40;
      this.levelUpFlash = 1.4;
      this.sound.levelUp();
    }

    if (p.lives <= 0) {
      this._gameOver();
    }

    this._emitHud();
  }

  _playerShoot() {
    const p = this.player;
    const cooldown = p.rapidTimer > 0 ? p.baseCooldown * 0.4 : p.baseCooldown;
    p.cooldown = cooldown;
    const cx = p.x + p.width / 2;
    const top = p.y;
    if (p.spreadTimer > 0) {
      this.bullets.push(createBullet(cx - 2, top, -110, -620, true));
      this.bullets.push(createBullet(cx - 2, top, 0, -640, true));
      this.bullets.push(createBullet(cx - 2, top, 110, -620, true));
    } else {
      this.bullets.push(createBullet(cx - 2, top, 0, -640, true));
    }
    this.sound.shoot();
  }

  _spawnEnemy() {
    const weights = [
      { value: "drone", weight: 10 },
      { value: "zigzag", weight: 6 + this.level },
      { value: "shooter", weight: this.level >= 2 ? 5 + this.level : 0 },
      { value: "tank", weight: this.level >= 3 ? 2 + this.level * 0.5 : 0 },
    ].filter((e) => e.weight > 0);
    const type = weightedChoice(weights);
    this.enemies.push(createEnemy(type, this.width, this.level));
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter((b) => b.y > -20 && b.y < this.height + 20);

    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.y > -20 && b.y < this.height + 20);
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      e.t += dt;
      e.y += e.vy * dt;
      if (e.type === "zigzag") {
        e.x += Math.sin(e.t * 3.2) * 140 * dt;
      }
      e.x = clamp(e.x, 0, this.width - e.width);

      if (e.shoots) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 0 && e.y < this.height * 0.75) {
          e.shootTimer = rand(1.4, 2.6);
          const cx = e.x + e.width / 2;
          const cy = e.y + e.height;
          const dx = this.player.x + this.player.width / 2 - cx;
          const dy = this.player.y + this.player.height / 2 - cy;
          const len = Math.hypot(dx, dy) || 1;
          const speed = 260;
          this.enemyBullets.push(
            createBullet(cx - 2, cy, (dx / len) * speed, (dy / len) * speed, false, "#ff5c7a")
          );
          this.sound.enemyShoot();
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < this.height + 60 && e.hp > 0);
  }

  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - dt * 2;
      pt.vy *= 1 - dt * 2;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      pu.y += pu.vy * dt;
      pu.t += dt;
    }
    this.powerups = this.powerups.filter((pu) => pu.y < this.height + 30);
  }

  _explode(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      this.particles.push(createParticle(x, y, color));
    }
  }

  _maybeDropPowerup(x, y) {
    if (Math.random() > 0.16) return;
    const types = Object.keys(POWERUP_TYPES);
    const type = types[randInt(0, types.length - 1)];
    this.powerups.push(createPowerUp(x, y, type));
  }

  _handleCollisions() {
    const p = this.player;

    // player bullets vs enemies
    for (const b of this.bullets) {
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(b, e)) {
          e.hp -= 1;
          b.hit = true;
          this._explode(b.x, b.y, e.color, 4);
          if (e.hp <= 0) {
            this.combo += 1;
            this.comboTimer = 1.6;
            const comboMul = 1 + Math.min(this.combo - 1, 8) * 0.15;
            this.score += Math.round(e.scoreValue * comboMul);
            this._explode(e.x + e.width / 2, e.y + e.height / 2, e.color, 22);
            this._maybeDropPowerup(e.x + e.width / 2, e.y + e.height / 2);
            this.shake = Math.min(this.shake + 0.15, 0.6);
            this.sound.explosion();
          } else {
            this.sound.hit();
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.hit);

    // enemy bullets vs player
    if (p.shieldTimer <= 0 && p.invulnTimer <= 0) {
      for (const b of this.enemyBullets) {
        if (rectsOverlap(b, p)) {
          b.hit = true;
          this._playerHit();
        }
      }
      this.enemyBullets = this.enemyBullets.filter((b) => !b.hit);
    }

    // enemies vs player
    if (p.shieldTimer <= 0 && p.invulnTimer <= 0) {
      for (const e of this.enemies) {
        if (rectsOverlap(e, p)) {
          e.hp = 0;
          this._explode(e.x + e.width / 2, e.y + e.height / 2, e.color, 18);
          this._playerHit();
        }
      }
    }

    // powerups vs player
    for (const pu of this.powerups) {
      if (rectsOverlap(pu, p)) {
        pu.hit = true;
        this._applyPowerup(pu.type);
      }
    }
    this.powerups = this.powerups.filter((pu) => !pu.hit);
  }

  _playerHit() {
    const p = this.player;
    p.lives -= 1;
    p.invulnTimer = 1.4;
    p.hitFlash = 0.5;
    this.shake = Math.min(this.shake + 0.4, 0.9);
    this.combo = 0;
    this.sound.hit();
    this._explode(p.x + p.width / 2, p.y + p.height / 2, "#ff5c7a", 14);
  }

  _applyPowerup(type) {
    const p = this.player;
    this.sound.powerup();
    if (type === "rapid") p.rapidTimer = 8;
    if (type === "spread") p.spreadTimer = 8;
    if (type === "shield") p.shieldTimer = 5;
    if (type === "life") p.lives = Math.min(p.lives + 1, 9);
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 8;
      ctx.translate(rand(-s, s), rand(-s, s));
    }

    this._drawBackground();

    if (this.state !== "menu") {
      this._drawPowerups();
      this._drawParticles();
      this._drawBullets();
      this._drawEnemies();
      this._drawPlayer();
    }

    ctx.restore();

    if (this.levelUpFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.levelUpFlash, 0, 1);
      ctx.fillStyle = "#7dfcff";
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#7dfcff";
      ctx.shadowBlur = 20;
      ctx.fillText(`LEVEL ${this.level}`, width / 2, height / 2 - 60);
      ctx.restore();
    }
  }

  _drawBackground() {
    const { ctx, width, height } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0620");
    grad.addColorStop(1, "#160b2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (const s of this.stars) {
      s.y += 0.0006 + s.z * 0.0015;
      if (s.y > 1) s.y = 0;
      const sx = s.x * width;
      const sy = s.y * height;
      ctx.globalAlpha = 0.4 + s.z * 0.6;
      ctx.fillStyle = "#bda9ff";
      ctx.fillRect(sx, sy, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  _glow(color, blur, fn) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn();
    ctx.restore();
  }

  _drawPlayer() {
    const { ctx } = this;
    const p = this.player;
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 12) % 2 === 0) return;

    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;

    if (p.shieldTimer > 0) {
      this._glow("#7dff9c", 18, () => {
        ctx.strokeStyle = "#7dff9c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, p.width * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    const color = p.hitFlash > 0 ? "#ffffff" : "#7dfcff";
    this._glow(color, 16, () => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, p.y);
      ctx.lineTo(p.x + p.width, p.y + p.height);
      ctx.lineTo(cx, p.y + p.height * 0.7);
      ctx.lineTo(p.x, p.y + p.height);
      ctx.closePath();
      ctx.fill();
    });

    // engine trail
    this._glow("#ff8bd6", 12, () => {
      ctx.fillStyle = "rgba(255,139,214,0.7)";
      ctx.beginPath();
      ctx.moveTo(cx - 5, p.y + p.height * 0.65);
      ctx.lineTo(cx + 5, p.y + p.height * 0.65);
      ctx.lineTo(cx, p.y + p.height + rand(6, 16));
      ctx.closePath();
      ctx.fill();
    });
  }

  _drawEnemies() {
    const { ctx } = this;
    for (const e of this.enemies) {
      const cx = e.x + e.width / 2;
      const cy = e.y + e.height / 2;
      this._glow(e.color, 14, () => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(cx, e.y + e.height);
        ctx.lineTo(e.x + e.width, e.y);
        ctx.lineTo(cx, e.y + e.height * 0.3);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
      });
      if (e.maxHp > 1) {
        const w = e.width;
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(e.x, e.y - 8, w, 3);
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x, e.y - 8, w * (e.hp / e.maxHp), 3);
      }
    }
  }

  _drawBullets() {
    const { ctx } = this;
    for (const b of this.bullets) {
      this._glow(b.color, 10, () => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
      });
    }
    for (const b of this.enemyBullets) {
      this._glow(b.color, 10, () => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.width, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  _drawParticles() {
    const { ctx } = this;
    for (const pt of this.particles) {
      const alpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawPowerups() {
    const { ctx } = this;
    for (const pu of this.powerups) {
      const bob = Math.sin(pu.t * 6) * 3;
      this._glow(pu.color, 16, () => {
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.arc(pu.x + pu.width / 2, pu.y + pu.height / 2 + bob, pu.width / 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#0a0620";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.label, pu.x + pu.width / 2, pu.y + pu.height / 2 + bob + 1);
    }
  }
}
