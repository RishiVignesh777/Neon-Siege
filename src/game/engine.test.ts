import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DEATH_BEAT_SECONDS,
  ENEMY_TELEGRAPH_SECONDS,
  FIRE_COOLDOWN_SECONDS,
  INVULNERABILITY_SECONDS,
  LOWER_ZONE_TOP_RATIO,
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

  // Hit #1
  sim.enemyBullets.push({
    id: 1001,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 100,
    radius: 5,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 2);
  assert.ok(sim.player.invulnTimer > 1.3 && sim.player.invulnTimer <= INVULNERABILITY_SECONDS);

  // Immediate second bullet while invulnerable should NOT deal damage
  sim.enemyBullets.push({
    id: 1002,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 100,
    radius: 5,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  assert.equal(sim.lives, 2);

  // Expire invulnerability and take hits 2 and 3
  sim.player.invulnTimer = 0;
  sim.hitstopTimer = 0;
  sim.enemyBullets.push({
    id: 1003,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 100,
    radius: 5,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 1);

  sim.player.invulnTimer = 0;
  sim.hitstopTimer = 0;
  sim.enemyBullets.push({
    id: 1004,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 100,
    radius: 5,
    active: true,
  });
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
