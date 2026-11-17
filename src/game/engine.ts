import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BEST_SCORE_STORAGE_KEY,
  COLORS,
  COMBO_WINDOW_SECONDS,
  DEATH_BEAT_SECONDS,
  ENEMY_BULLET_RADIUS,
  ENEMY_RADIUS,
  ENEMY_TELEGRAPH_SECONDS,
  FIRE_COOLDOWN_SECONDS,
  FIRE_INPUT_BUFFER_SECONDS,
  INVULNERABILITY_SECONDS,
  KILL_BASE_POINTS,
  LOWER_ZONE_TOP_RATIO,
  MAX_COMBO_MULTIPLIER,
  MAX_DELTA_TIME,
  MAX_LIVES,
  MAX_PARTICLES,
  PLAYER_BULLET_RADIUS,
  PLAYER_BULLET_SPEED,
  PLAYER_HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  TIME_BONUS_POINTS_PER_SECOND,
  WAVE_DURATION_SECONDS,
} from './constants';
import type {
  DifficultyParams,
  Enemy,
  GameSnapshot,
  InputState,
  Particle,
  SimulationState,
} from './types';

function createParticlePool(): Particle[] {
  const pool: Particle[] = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: COLORS.magenta,
      isShard: false,
      angle: 0,
      spin: 0,
    };
  }
  return pool;
}

export function loadBestScore(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = Math.max(0, Math.floor(score));
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(clean));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getWaveFromTime(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 1;
  return 1 + Math.floor(elapsedSeconds / WAVE_DURATION_SECONDS);
}

export function getDifficultyParams(elapsedSeconds: number): DifficultyParams {
  const t = Math.max(0, elapsedSeconds);
  const spawnInterval = 0.30 + 0.98 / (1 + t / 45);
  const enemySpeed = 95 + Math.min(215, t * 1.45);
  const enemyBulletSpeed = 240 + Math.min(280, t * 1.9);
  const enemyFireInterval = Math.max(1.05, 2.45 - t * 0.011);

  return {
    spawnInterval,
    enemySpeed,
    enemyBulletSpeed,
    enemyFireInterval,
  };
}

export function getKillPoints(wave: number, multiplier = 1): number {
  return KILL_BASE_POINTS * Math.max(1, wave) * Math.max(1, multiplier);
}

export function getLowerZoneMinY(height = ARENA_HEIGHT, radius = PLAYER_RADIUS): number {
  return height * LOWER_ZONE_TOP_RATIO + radius;
}

export function clampPlayerPosition(
  x: number,
  y: number,
  radius = PLAYER_RADIUS,
  width = ARENA_WIDTH,
  height = ARENA_HEIGHT
): { x: number; y: number } {
  const minX = radius + 10;
  const maxX = width - radius - 10;
  const minY = getLowerZoneMinY(height, radius);
  const maxY = height - radius - 12;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export function createInitialSimulation(bestScore = 0, phase: SimulationState['phase'] = 'title'): SimulationState {
  const startY = Math.round(ARENA_HEIGHT * 0.80);
  return {
    phase,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    player: {
      x: ARENA_WIDTH / 2,
      y: startY,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      hitRadius: PLAYER_HIT_RADIUS,
      fireCooldown: 0,
      fireBufferTimer: 0,
      muzzleFlashTimer: 0,
      invulnTimer: 0,
      squashX: 1,
      squashY: 1,
    },
    playerBullets: [],
    enemies: [],
    enemyBullets: [],
    particles: createParticlePool(),
    particleCursor: 0,
    nextEntityId: 1,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    killScore: 0,
    timeScore: 0,
    score: 0,
    bestScore: Math.max(0, Math.floor(bestScore)),
    isNewBest: false,
    multiplier: 1,
    comboTimer: 0,
    wave: 1,
    waveBannerTimer: 0,
    elapsedSeconds: 0,
    spawnTimer: 0.55, // First enemy arrives smoothly shortly after start
    kills: 0,
    hitstopTimer: 0,
    dyingTimer: 0,
    trauma: 0,
    gridOffset: 0,
    pendingEvents: [],
  };
}

export function spawnParticles(
  sim: SimulationState,
  x: number,
  y: number,
  count: number,
  colors: string[],
  speedMin: number,
  speedMax: number,
  rng: () => number = Math.random,
  includeShards = false
): void {
  for (let i = 0; i < count; i++) {
    const p = sim.particles[sim.particleCursor];
    sim.particleCursor = (sim.particleCursor + 1) % MAX_PARTICLES;

    const angle = rng() * Math.PI * 2;
    const speed = speedMin + rng() * (speedMax - speedMin);
    const maxLife = 0.25 + rng() * 0.35;

    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.size = 1.8 + rng() * 2.8;
    p.color = colors[Math.floor(rng() * colors.length)] ?? colors[0];
    p.isShard = includeShards && i % 3 === 0;
    p.angle = angle;
    p.spin = (rng() - 0.5) * 14;
  }
}

export function spawnEnemy(sim: SimulationState, rng: () => number = Math.random): Enemy {
  const diff = getDifficultyParams(sim.elapsedSeconds);
  const margin = ENEMY_RADIUS + 26;
  const x = margin + rng() * (sim.width - margin * 2);
  const speedVariance = 0.88 + rng() * 0.28;
  const weaveAmp = sim.wave >= 2 ? (rng() < 0.55 ? 24 + rng() * 28 : 0) : 0;

  const enemy: Enemy = {
    id: sim.nextEntityId++,
    x,
    y: -ENEMY_RADIUS - 4,
    vx: 0,
    vy: diff.enemySpeed * speedVariance,
    radius: ENEMY_RADIUS,
    weaveAmp,
    weaveFreq: 1.4 + rng() * 1.4,
    weavePhase: rng() * Math.PI * 2,
    fireTimer: diff.enemyFireInterval * (0.45 + rng() * 0.65),
    telegraphTimer: 0,
    isTelegraphing: false,
    hitFlashTimer: 0,
    spinAngle: 0,
    active: true,
  };

  sim.enemies.push(enemy);
  return enemy;
}

function updateParticles(sim: SimulationState, dt: number): void {
  const drag = Math.pow(0.06, dt);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = sim.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
  }
}

function triggerPlayerDamage(sim: SimulationState, rng: () => number): void {
  sim.lives = Math.max(0, sim.lives - 1);
  sim.hitstopTimer = 0.055;
  sim.trauma = Math.min(1, sim.trauma + 0.78);
  sim.player.squashX = 1.32;
  sim.player.squashY = 0.72;

  spawnParticles(
    sim,
    sim.player.x,
    sim.player.y,
    24,
    [COLORS.cyan, COLORS.magenta, COLORS.white],
    80,
    340,
    rng,
    true
  );

  if (sim.lives <= 0) {
    sim.dyingTimer = DEATH_BEAT_SECONDS;
    sim.pendingEvents.push('playerHit');
    spawnParticles(
      sim,
      sim.player.x,
      sim.player.y,
      36,
      [COLORS.cyan, COLORS.violet, COLORS.magenta, COLORS.white],
      110,
      420,
      rng,
      true
    );
  } else {
    sim.player.invulnTimer = INVULNERABILITY_SECONDS;
    sim.pendingEvents.push('playerHit');
  }
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export function stepSimulation(
  sim: SimulationState,
  input: InputState,
  rawDt: number,
  rng: () => number = Math.random
): void {
  const dt = Math.max(0, Math.min(rawDt, MAX_DELTA_TIME));
  sim.pendingEvents.length = 0;

  // Background grid always scrolls subtly during title & playing
  if (sim.phase === 'title' || sim.phase === 'playing') {
    sim.gridOffset = (sim.gridOffset + dt * (sim.phase === 'playing' ? 68 : 28)) % 48;
  }

  // Always tick camera trauma decay and particles even during hitstop/death beat
  sim.trauma = Math.max(0, sim.trauma - dt * 2.1);

  if (sim.phase !== 'playing') {
    if (sim.phase === 'gameover') {
      updateParticles(sim, dt);
    }
    return;
  }

  updateParticles(sim, dt);

  if (sim.waveBannerTimer > 0) {
    sim.waveBannerTimer = Math.max(0, sim.waveBannerTimer - dt);
  }

  // Handle brief death shatter beat before showing SYSTEM BREACH modal
  if (sim.dyingTimer > 0) {
    sim.dyingTimer -= dt;
    if (sim.dyingTimer <= 0) {
      sim.dyingTimer = 0;
      sim.phase = 'gameover';
      if (sim.score > sim.bestScore) {
        sim.bestScore = sim.score;
        sim.isNewBest = true;
        saveBestScore(sim.bestScore);
      }
      sim.pendingEvents.push('gameOver');
    }
    return;
  }

  // Hitstop freeze for heavy impacts (particles & shake continue above)
  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }

  // Advance survival clock, combo decay, wave, and time bonus
  sim.elapsedSeconds += dt;
  if (sim.comboTimer > 0) {
    sim.comboTimer -= dt;
    if (sim.comboTimer <= 0) {
      sim.comboTimer = 0;
      sim.multiplier = 1;
    }
  }
  const nextWave = getWaveFromTime(sim.elapsedSeconds);
  if (nextWave > sim.wave) {
    sim.wave = nextWave;
    sim.waveBannerTimer = 1.65;
    sim.pendingEvents.push('waveUp');
  }
  sim.timeScore = Math.floor(sim.elapsedSeconds) * TIME_BONUS_POINTS_PER_SECOND;
  sim.score = Math.floor(sim.killScore + sim.timeScore);
  if (sim.score > sim.bestScore) {
    sim.bestScore = sim.score;
    sim.isNewBest = true;
    saveBestScore(sim.bestScore);
  }

  // Player movement (normalized 4-way/8-way)
  let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (moveX !== 0 && moveY !== 0) {
    const inv = Math.SQRT1_2;
    moveX *= inv;
    moveY *= inv;
  }

  sim.player.vx = moveX * PLAYER_SPEED;
  sim.player.vy = moveY * PLAYER_SPEED;
  const clamped = clampPlayerPosition(
    sim.player.x + sim.player.vx * dt,
    sim.player.y + sim.player.vy * dt,
    sim.player.radius,
    sim.width,
    sim.height
  );
  sim.player.x = clamped.x;
  sim.player.y = clamped.y;

  // Relax squash & stretch smoothly
  const relax = 1 - Math.pow(0.001, dt);
  sim.player.squashX += (1 - sim.player.squashX) * relax;
  sim.player.squashY += (1 - sim.player.squashY) * relax;

  if (sim.player.invulnTimer > 0) {
    sim.player.invulnTimer = Math.max(0, sim.player.invulnTimer - dt);
  }
  if (sim.player.muzzleFlashTimer > 0) {
    sim.player.muzzleFlashTimer = Math.max(0, sim.player.muzzleFlashTimer - dt);
  }

  // Player firing with ~220ms cooldown + input buffering
  if (sim.player.fireCooldown > 0) {
    sim.player.fireCooldown = Math.max(0, sim.player.fireCooldown - dt);
  }
  if (input.fireJustPressed) {
    sim.player.fireBufferTimer = FIRE_INPUT_BUFFER_SECONDS;
  } else if (sim.player.fireBufferTimer > 0) {
    sim.player.fireBufferTimer = Math.max(0, sim.player.fireBufferTimer - dt);
  }

  const wantsToFire = input.fireHeld || sim.player.fireBufferTimer > 0;
  if (wantsToFire && sim.player.fireCooldown <= 0) {
    sim.player.fireCooldown = FIRE_COOLDOWN_SECONDS;
    sim.player.fireBufferTimer = 0;
    sim.player.muzzleFlashTimer = 0.06;
    sim.player.squashX = 0.88;
    sim.player.squashY = 1.14;

    sim.playerBullets.push({
      id: sim.nextEntityId++,
      x: sim.player.x,
      y: sim.player.y - sim.player.radius - 4,
      vx: 0,
      vy: -PLAYER_BULLET_SPEED,
      radius: PLAYER_BULLET_RADIUS,
      active: true,
    });
    sim.pendingEvents.push('shoot');
  }

  // Enemy spawning
  const diff = getDifficultyParams(sim.elapsedSeconds);
  sim.spawnTimer -= dt;
  if (sim.spawnTimer <= 0) {
    spawnEnemy(sim, rng);
    sim.spawnTimer = diff.spawnInterval * (0.85 + rng() * 0.3);
  }

  // Update player bullets
  for (let i = 0; i < sim.playerBullets.length; i++) {
    const b = sim.playerBullets[i];
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20) {
      b.active = false;
    }
  }

  // Update enemies & aimed firing telegraph
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i];
    if (!e.active) continue;

    e.spinAngle += dt * 1.8;
    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    }

    const weaveVx = e.weaveAmp > 0 ? Math.cos(sim.elapsedSeconds * e.weaveFreq + e.weavePhase) * e.weaveAmp : 0;
    e.x += weaveVx * dt;
    const margin = e.radius + 12;
    if (e.x < margin) e.x = margin;
    if (e.x > sim.width - margin) e.x = sim.width - margin;

    e.y += e.vy * dt;

    if (e.y > sim.height + e.radius + 20) {
      e.active = false;
      continue;
    }

    // Periodically fire bullets aimed at the player's current position
    if (e.isTelegraphing) {
      e.telegraphTimer -= dt;
      if (e.telegraphTimer <= 0) {
        e.isTelegraphing = false;
        e.fireTimer = diff.enemyFireInterval * (0.8 + rng() * 0.4);

        const dx = sim.player.x - e.x;
        const dy = sim.player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        sim.enemyBullets.push({
          id: sim.nextEntityId++,
          x: e.x,
          y: e.y,
          vx: (dx / len) * diff.enemyBulletSpeed,
          vy: (dy / len) * diff.enemyBulletSpeed,
          radius: ENEMY_BULLET_RADIUS,
          active: true,
        });
      }
    } else {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.y > 24 && e.y < sim.height * 0.78) {
        e.isTelegraphing = true;
        e.telegraphTimer = ENEMY_TELEGRAPH_SECONDS;
        sim.pendingEvents.push('enemyTelegraph');
      }
    }
  }

  // Update enemy bullets
  for (let i = 0; i < sim.enemyBullets.length; i++) {
    const b = sim.enemyBullets[i];
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -30 || b.x > sim.width + 30 || b.y < -30 || b.y > sim.height + 30) {
      b.active = false;
    }
  }

  // Collisions: Player bullets vs Enemies
  for (let i = 0; i < sim.playerBullets.length; i++) {
    const b = sim.playerBullets[i];
    if (!b.active) continue;

    for (let j = 0; j < sim.enemies.length; j++) {
      const e = sim.enemies[j];
      if (!e.active) continue;

      if (circlesOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
        b.active = false;
        e.active = false;
        sim.kills += 1;
        if (sim.comboTimer > 0) {
          sim.multiplier = Math.min(MAX_COMBO_MULTIPLIER, sim.multiplier + 1);
        } else {
          sim.multiplier = 1;
        }
        sim.comboTimer = COMBO_WINDOW_SECONDS;
        sim.killScore += getKillPoints(sim.wave, sim.multiplier);
        sim.score = Math.floor(sim.killScore + sim.timeScore);
        if (sim.score > sim.bestScore) {
          sim.bestScore = sim.score;
          sim.isNewBest = true;
          saveBestScore(sim.bestScore);
        }

        sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.025);
        sim.trauma = Math.min(1, sim.trauma + 0.18);
        spawnParticles(
          sim,
          e.x,
          e.y,
          16,
          [COLORS.magenta, COLORS.magentaSoft, COLORS.violet, COLORS.white],
          65,
          260,
          rng,
          true
        );
        sim.pendingEvents.push('enemyDestroy');
        break;
      }
    }
  }

  // Collisions: Enemy bullets & Enemies vs Player
  if (sim.player.invulnTimer <= 0 && sim.dyingTimer <= 0) {
    let hit = false;

    for (let i = 0; i < sim.enemyBullets.length; i++) {
      const b = sim.enemyBullets[i];
      if (!b.active) continue;
      if (circlesOverlap(b.x, b.y, b.radius, sim.player.x, sim.player.y, sim.player.hitRadius)) {
        b.active = false;
        hit = true;
        break;
      }
    }

    if (!hit) {
      for (let i = 0; i < sim.enemies.length; i++) {
        const e = sim.enemies[i];
        if (!e.active) continue;
        if (circlesOverlap(e.x, e.y, e.radius * 0.82, sim.player.x, sim.player.y, sim.player.hitRadius)) {
          e.active = false;
          spawnParticles(
            sim,
            e.x,
            e.y,
            14,
            [COLORS.magenta, COLORS.violet, COLORS.white],
            70,
            240,
            rng,
            true
          );
          hit = true;
          break;
        }
      }
    }

    if (hit) {
      triggerPlayerDamage(sim, rng);
    }
  }

  // Compact inactive bullets/enemies cleanly
  if (sim.playerBullets.length > 0) {
    sim.playerBullets = sim.playerBullets.filter((b) => b.active);
  }
  if (sim.enemyBullets.length > 0) {
    sim.enemyBullets = sim.enemyBullets.filter((b) => b.active);
  }
  if (sim.enemies.length > 0) {
    sim.enemies = sim.enemies.filter((e) => e.active);
  }
}

export function getSnapshot(sim: SimulationState): GameSnapshot {
  return {
    phase: sim.phase,
    score: sim.score,
    bestScore: sim.bestScore,
    wave: sim.wave,
    lives: sim.lives,
    multiplier: sim.multiplier,
    elapsedSeconds: sim.elapsedSeconds,
    kills: sim.kills,
    isNewBest: sim.isNewBest,
  };
}
