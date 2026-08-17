import { rand } from "./utils";

export function createPlayer(canvasWidth, canvasHeight) {
  return {
    width: 34,
    height: 34,
    x: canvasWidth / 2 - 17,
    y: canvasHeight - 90,
    speed: 420,
    lives: 3,
    cooldown: 0,
    baseCooldown: 0.26,
    rapidTimer: 0,
    spreadTimer: 0,
    shieldTimer: 0,
    invulnTimer: 1.2,
    hitFlash: 0,
  };
}

export const ENEMY_TYPES = {
  drone: { hp: 1, speed: 120, size: 26, score: 10, color: "#ff2fd0", shoots: false },
  zigzag: { hp: 1, speed: 150, size: 24, score: 15, color: "#26e0ff", shoots: false },
  shooter: { hp: 2, speed: 90, size: 30, score: 25, color: "#ffb02e", shoots: true },
  tank: { hp: 5, speed: 60, size: 44, score: 60, color: "#a259ff", shoots: true },
};

export function createEnemy(type, canvasWidth, level) {
  const def = ENEMY_TYPES[type];
  const speedMul = 1 + level * 0.06;
  return {
    type,
    x: rand(20, canvasWidth - def.size - 20),
    y: -def.size,
    width: def.size,
    height: def.size,
    vx: 0,
    vy: def.speed * speedMul,
    hp: def.hp,
    maxHp: def.hp,
    color: def.color,
    scoreValue: def.score,
    shoots: def.shoots,
    shootTimer: rand(0.8, 2.2),
    t: 0,
  };
}

export function createBullet(x, y, vx, vy, fromPlayer, color = "#7dfcff") {
  return {
    x,
    y,
    vx,
    vy,
    width: fromPlayer ? 4 : 5,
    height: fromPlayer ? 14 : 10,
    fromPlayer,
    color,
  };
}

export function createParticle(x, y, color) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(40, 260);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: rand(0.3, 0.7),
    maxLife: 0.7,
    size: rand(1.5, 4),
    color,
  };
}

export const POWERUP_TYPES = {
  rapid: { color: "#ffe93b", label: "R" },
  spread: { color: "#26e0ff", label: "S" },
  shield: { color: "#7dff9c", label: "SH" },
  life: { color: "#ff5c7a", label: "+1" },
};

export function createPowerUp(x, y, type) {
  return {
    x,
    y,
    width: 22,
    height: 22,
    vy: 90,
    type,
    color: POWERUP_TYPES[type].color,
    label: POWERUP_TYPES[type].label,
    t: 0,
  };
}
