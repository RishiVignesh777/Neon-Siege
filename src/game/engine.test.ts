import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DEATH_BEAT_SECONDS,
  ENEMY_TELEGRAPH_SECONDS,
  FIRE_COOLDOWN_SECONDS,
  GRAZE_BONUS_POINTS,
  INVULNERABILITY_SECONDS,
  LOWER_ZONE_TOP_RATIO,
  PLAYER_GRAZE_RADIUS,
  PLAYER_HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from './constants';
import {
  clampPlayerPosition,
  createInitialSimulation,
  getDifficultyParams,
  getKillPoints,
  getLowerZoneMinY,
  getWaveFromTime,
  spawnEnemy,
  stepSimulation,
} from './engine';
import type { InputState } from './types';

function emptyInput(overrides: Partial<InputState> = {}): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    fireHeld: false,
    fireJustPressed: false,
    ...overrides,
  };
}

test('player stays confined to the lower 60% of the screen and arena bounds', () => {
  const minY = getLowerZoneMinY(ARENA_HEIGHT, PLAYER_RADIUS);
  assert.equal(minY, ARENA_HEIGHT * LOWER_ZONE_TOP_RATIO + PLAYER_RADIUS);

  const clampedTop = clampPlayerPosition(ARENA_WIDTH / 2, 0);
  assert.equal(clampedTop.y, minY);

  const clampedCorners = clampPlayerPosition(-100, 9999);
  assert.equal(clampedCorners.x, PLAYER_RADIUS + 10);
  assert.equal(clampedCorners.y, ARENA_HEIGHT - PLAYER_RADIUS - 12);
});

test('movement is framerate-independent and diagonal speed is normalized', () => {
  const sim60 = createInitialSimulation(0, 'playing');
  const sim30 = createInitialSimulation(0, 'playing');
  const input = emptyInput({ right: true, up: true });

  for (let i = 0; i < 6; i++) {
    stepSimulation(sim60, input, 1 / 60, () => 0.5);
  }
  for (let i = 0; i < 3; i++) {
    stepSimulation(sim30, input, 1 / 30, () => 0.5);
  }

  assert.ok(Math.abs(sim60.player.x - sim30.player.x) < 0.001);
  assert.ok(Math.abs(sim60.player.y - sim30.player.y) < 0.001);

  const dx = sim60.player.x - ARENA_WIDTH / 2;
  const dy = Math.round(ARENA_HEIGHT * 0.8) - sim60.player.y;
  const dist = Math.hypot(dx, dy);
  assert.ok(Math.abs(dist - PLAYER_SPEED * 0.1) < 0.1);
});

test('space fires upward bullets respecting ~220ms cooldown', () => {
  const sim = createInitialSimulation(0, 'playing');
  const fireInput = emptyInput({ fireHeld: true, fireJustPressed: true });

  stepSimulation(sim, fireInput, 0.016, () => 0.5);
  assert.equal(sim.playerBullets.length, 1);
  assert.equal(sim.playerBullets[0].vx, 0);
  assert.ok(sim.playerBullets[0].vy < 0);

  // Too soon -> no second bullet yet
  stepSimulation(sim, emptyInput({ fireHeld: true }), 0.05, () => 0.5);
  assert.equal(sim.playerBullets.length, 1);

  // Advance past cooldown in frame-clamped steps -> fires second bullet
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, emptyInput({ fireHeld: true }), 0.02, () => 0.5);
  }
  assert.equal(sim.playerBullets.length, 2);
});

test('enemy telegraphs and fires bullet aimed at player current position', () => {
  const sim = createInitialSimulation(0, 'playing');
  sim.player.x = 620;
  sim.player.y = 600;
  const enemy = spawnEnemy(sim, () => 0.5);
  enemy.x = 300;
  enemy.y = 180;
  enemy.fireTimer = 0.01;

  // Trigger telegraph
  stepSimulation(sim, emptyInput(), 0.02, () => 0.5);
  assert.equal(enemy.isTelegraphing, true);
  assert.equal(sim.enemyBullets.length, 0);

  // Finish telegraph in frame-clamped steps and stop on the frame the bullet spawns
  for (let i = 0; i < 16 && sim.enemyBullets.length === 0; i++) {
    stepSimulation(sim, emptyInput(), 0.02, () => 0.5);
  }
  assert.equal(sim.enemyBullets.length, 1);

  const b = sim.enemyBullets[0];
  const expectedDx = sim.player.x - enemy.x;
  const expectedDy = sim.player.y - enemy.y;
  const bLen = Math.hypot(b.vx, b.vy);
  const eLen = Math.hypot(expectedDx, expectedDy);
  const dot = (b.vx / bLen) * (expectedDx / eLen) + (b.vy / bLen) * (expectedDy / eLen);
  assert.ok(dot > 0.999, 'enemy bullet velocity should aim straight toward player');
  assert.ok(b.vx > 0 && b.vy > 0);
});

test('destroying an enemy removes it, spawns particles, and awards wave-scaled points', () => {
  const sim = createInitialSimulation(0, 'playing');
  sim.elapsedSeconds = 31; // Wave 3
  sim.wave = 3;

  const enemy = spawnEnemy(sim, () => 0.5);
  enemy.x = 450;
  enemy.y = 400;

  sim.playerBullets.push({
    id: 999,
    x: 450,
    y: 405,
    vx: 0,
    vy: -800,
    radius: 4,
    active: true,
  });

  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.enemies.length, 0);
  assert.equal(sim.kills, 1);
  assert.equal(sim.killScore, getKillPoints(3));
  assert.ok(sim.particles.some((p) => p.active));
});

test('player hit reduces lives, grants 1.4s invulnerability, and triggers gameover at 0 lives', () => {
  const sim = createInitialSimulation(0, 'playing');
  assert.equal(sim.lives, 3);

  const pushHitBullet = (id: number) => {
    sim.enemyBullets.push({
      id,
      x: sim.player.x,
      y: sim.player.y,
      vx: 0,
      vy: 100,
      radius: 5,
      grazed: false,
      inGrazeRing: false,
      grazeX: sim.player.x,
      grazeY: sim.player.y,
      active: true,
    });
  };

  // Hit #1
  pushHitBullet(1001);
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 2);
  assert.ok(sim.player.invulnTimer > 1.3 && sim.player.invulnTimer <= INVULNERABILITY_SECONDS);

  // Immediate second bullet while invulnerable should NOT deal damage
  pushHitBullet(1002);
  stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  assert.equal(sim.lives, 2);

  // Expire invulnerability and take hits 2 and 3
  sim.player.invulnTimer = 0;
  sim.hitstopTimer = 0;
  pushHitBullet(1003);
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 1);

  sim.player.invulnTimer = 0;
  sim.hitstopTimer = 0;
  pushHitBullet(1004);
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 0);
  assert.equal(sim.phase, 'playing');

  // Advance through death beat -> gameover
  for (let i = 0; i < 15; i++) {
    stepSimulation(sim, emptyInput(), DEATH_BEAT_SECONDS / 10, () => 0.5);
  }
  assert.equal(sim.phase, 'gameover');
});

test('difficulty ramps continuously and wave increments every 15 seconds', () => {
  assert.equal(getWaveFromTime(0), 1);
  assert.equal(getWaveFromTime(14.9), 1);
  assert.equal(getWaveFromTime(15), 2);
  assert.equal(getWaveFromTime(45.5), 4);

  const d0 = getDifficultyParams(0);
  const d30 = getDifficultyParams(30);
  const d90 = getDifficultyParams(90);

  assert.ok(d30.spawnInterval < d0.spawnInterval);
  assert.ok(d90.spawnInterval < d30.spawnInterval);

  assert.ok(d30.enemySpeed > d0.enemySpeed);
  assert.ok(d90.enemySpeed > d30.enemySpeed);

  assert.ok(d30.enemyBulletSpeed > d0.enemyBulletSpeed);
  assert.ok(d90.enemyBulletSpeed > d30.enemyBulletSpeed);
});

test('combo multiplier increments on kills within 1.5s, caps at x10, multiplies kill points, and resets after 1.5s', () => {
  const sim = createInitialSimulation(0, 'playing');
  assert.equal(sim.multiplier, 1);

  const spawnHitPair = (idBase: number) => {
    const enemy = spawnEnemy(sim, () => 0.5);
    enemy.x = 450;
    enemy.y = 320;
    sim.playerBullets.push({
      id: idBase,
      x: 450,
      y: 325,
      vx: 0,
      vy: -800,
      radius: 4,
      active: true,
    });
  };

  // Kill 1 -> stays x1, awards 100 * 1 * 1 = 100
  spawnHitPair(2001);
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.multiplier, 1);
  assert.equal(sim.killScore, 100);

  // Advance 0.5s (< 1.5s), then Kill 2 -> x2, awards 100 * 1 * 2 = 200 (total 300)
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  spawnHitPair(2002);
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.multiplier, 2);
  assert.equal(sim.killScore, 300);

  // Chain 10 more rapid kills -> caps at x10
  for (let k = 0; k < 10; k++) {
    sim.hitstopTimer = 0;
    spawnHitPair(2010 + k);
    stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  }
  assert.equal(sim.multiplier, 10);

  // Wait > 1.5s without a kill -> resets back to x1
  sim.hitstopTimer = 0;
  for (let i = 0; i < 32; i++) {
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  assert.equal(sim.multiplier, 1);
  assert.equal(sim.comboTimer, 0);
});

test('graze ring (26px vs 14px hit radius) awards +2 once on near miss and never on direct hit', () => {
  const sim = createInitialSimulation(0, 'playing');
  assert.equal(PLAYER_HIT_RADIUS, 14);
  assert.equal(PLAYER_GRAZE_RADIUS, 26);

  // Near-miss bullet passing vertically at x = player.x + 22 (outside 14+4.5=18.5 hit, inside 26+4.5=30.5 graze)
  sim.enemyBullets.push({
    id: 3001,
    x: sim.player.x + 22,
    y: sim.player.y - 34,
    vx: 0,
    vy: 260,
    radius: 4.5,
    grazed: false,
    inGrazeRing: false,
    grazeX: sim.player.x + 22,
    grazeY: sim.player.y - 34,
    active: true,
  });

  // Step through graze ring entry -> inside -> clean exit (~0.32s total)
  for (let i = 0; i < 16; i++) {
    stepSimulation(sim, emptyInput(), 0.02, () => 0.5);
  }

  assert.equal(sim.lives, 3);
  assert.equal(sim.grazeScore, GRAZE_BONUS_POINTS);
  assert.equal(sim.score, GRAZE_BONUS_POINTS);
  assert.ok(sim.grazePopups.some((p) => p.active && p.amount === GRAZE_BONUS_POINTS));

  // Continue advancing -> same bullet must NEVER award graze points a second time
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, emptyInput(), 0.02, () => 0.5);
  }
  assert.equal(sim.grazeScore, GRAZE_BONUS_POINTS);

  // Direct hit bullet passing straight into 14px hit radius must NOT award graze points
  sim.enemyBullets.push({
    id: 3002,
    x: sim.player.x,
    y: sim.player.y - 24,
    vx: 0,
    vy: 260,
    radius: 4.5,
    grazed: false,
    inGrazeRing: false,
    grazeX: sim.player.x,
    grazeY: sim.player.y - 24,
    active: true,
  });

  for (let i = 0; i < 10; i++) {
    sim.hitstopTimer = 0;
    stepSimulation(sim, emptyInput(), 0.02, () => 0.5);
  }
  assert.equal(sim.lives, 2);
  assert.equal(sim.grazeScore, GRAZE_BONUS_POINTS);
});
