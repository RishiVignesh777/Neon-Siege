import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_FIRE_RAMP_SECONDS,
  BOSS_INITIAL_FIRE_INTERVAL,
  BOSS_MAX_HP,
  BOSS_MIN_FIRE_INTERVAL,
  BOSS_RADIUS,
  BOSS_VOLLEY_SPREAD_RAD,
  DEATH_BEAT_SECONDS,
  ENEMY_RADIUS,
  ENEMY_TELEGRAPH_SECONDS,
  FIRE_COOLDOWN_SECONDS,
  GRAZE_BONUS_POINTS,
  INVULNERABILITY_SECONDS,
  LOWER_ZONE_TOP_RATIO,
  PLAYER_GRAZE_RADIUS,
  PLAYER_HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_SPREAD_ANGLE_RAD,
  POWERUP_DURATION_SECONDS,
  POWERUP_FALL_SPEED,
  WAVE_DURATION_SECONDS,
} from './constants';
import {
  clampPlayerPosition,
  createInitialSimulation,
  getBossFireInterval,
  getDifficultyParams,
  getKillPoints,
  getLowerZoneMinY,
  getSnapshot,
  getWaveFromTime,
  spawnBoss,
  spawnEnemy,
  spawnPowerUp,
  stepSimulation,
} from './engine';
import { getCameraShakeAmplitude } from './renderer';
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

test('wave 5 spawns a 20-HP boss, pauses normal enemy spawning, patrols upper third, and resumes wave 6 on defeat', () => {
  const sim = createInitialSimulation(0, 'playing');
  // Position right before wave 5 transition (4 * 15s = 60s)
  sim.elapsedSeconds = WAVE_DURATION_SECONDS * 4 - 0.02;
  sim.waveProgressSeconds = WAVE_DURATION_SECONDS * 4 - 0.02;
  sim.wave = 4;
  sim.spawnTimer = 0.01;

  // Step across wave 5 threshold -> boss spawns and normal spawning pauses
  stepSimulation(sim, emptyInput(), 0.04, () => 0.5);
  assert.equal(sim.wave, 5);
  assert.ok(sim.boss !== null);
  assert.equal(sim.boss.hp, BOSS_MAX_HP);
  assert.equal(sim.boss.maxHp, 20);
  assert.equal(sim.boss.radius, ENEMY_RADIUS * 2);
  assert.equal(sim.boss.radius, BOSS_RADIUS);
  assert.equal(sim.enemies.length, 0);

  // Patrol across 1.5s (before first 1.8s volley) -> stays in upper third, moves side to side, pauses enemies
  const initialX = sim.boss.x;
  let minX = initialX;
  let maxX = initialX;
  for (let i = 0; i < 160; i++) {
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
    assert.ok(sim.boss !== null);
    assert.ok(sim.boss.y <= ARENA_HEIGHT / 3, `boss y=${sim.boss.y} should stay in upper third`);
    assert.equal(sim.enemies.length, 0, 'normal enemy spawning must stay paused during boss');
    minX = Math.min(minX, sim.boss.x);
    maxX = Math.max(maxX, sim.boss.x);
    // Keep player alive if any boss volley bullet passes near center during patrol test
    sim.player.invulnTimer = 1.0;
  }
  assert.ok(maxX - minX > 200, 'boss should drift side to side across the upper third');
  assert.equal(sim.wave, 5, 'wave should stay at 5 while boss is alive');

  // Hit boss 19 times -> each bullet removes 1 HP and boss stays alive at 1 HP
  for (let hit = 1; hit <= 19; hit++) {
    sim.hitstopTimer = 0;
    sim.playerBullets.push({
      id: 4000 + hit,
      x: sim.boss!.x,
      y: sim.boss!.y,
      vx: 0,
      vy: -800,
      radius: 4,
      active: true,
    });
    stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
    assert.ok(sim.boss !== null);
    assert.equal(sim.boss.hp, BOSS_MAX_HP - hit);
  }

  // 20th hit -> removes boss, spawns destroy particles, advances to wave 6, and resumes enemy spawning
  sim.hitstopTimer = 0;
  sim.playerBullets.push({
    id: 4020,
    x: sim.boss!.x,
    y: sim.boss!.y,
    vx: 0,
    vy: -800,
    radius: 4,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.boss, null);
  assert.equal(sim.wave, 6);
  assert.ok(sim.particles.some((p) => p.active), 'boss defeat should trigger particle burst');

  // Advance ~0.6s -> normal enemy spawning resumes
  sim.hitstopTimer = 0;
  for (let i = 0; i < 16; i++) {
    stepSimulation(sim, emptyInput(), 0.04, () => 0.5);
  }
  assert.ok(sim.enemies.length >= 1, 'normal enemy spawning must resume after boss defeat');
});

test('boss fires 3-bullet narrow fan toward player, ramps interval from 1.8s to 0.8s over 15s, and uses standard player collision', () => {
  assert.equal(getBossFireInterval(0), BOSS_INITIAL_FIRE_INTERVAL);
  assert.ok(
    Math.abs(getBossFireInterval(BOSS_FIRE_RAMP_SECONDS / 2) - 1.3) < 0.001,
    'midpoint fire interval should interpolate linearly'
  );
  assert.equal(getBossFireInterval(BOSS_FIRE_RAMP_SECONDS), BOSS_MIN_FIRE_INTERVAL);
  assert.equal(getBossFireInterval(BOSS_FIRE_RAMP_SECONDS + 10), BOSS_MIN_FIRE_INTERVAL);

  const sim = createInitialSimulation(0, 'playing');
  sim.wave = 5;
  sim.elapsedSeconds = WAVE_DURATION_SECONDS * 4;
  sim.waveProgressSeconds = WAVE_DURATION_SECONDS * 4;
  const boss = spawnBoss(sim);

  // Before 1.8s -> no volley yet
  for (let i = 0; i < 34; i++) {
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5); // 1.70s
  }
  assert.equal(sim.enemyBullets.length, 0);

  // Cross 1.8s -> fires 3 bullets in a narrow fan aimed toward player
  for (let i = 0; i < 4 && sim.enemyBullets.length === 0; i++) {
    stepSimulation(sim, emptyInput(), 0.04, () => 0.5);
  }
  assert.equal(sim.enemyBullets.length, 3);

  const angles = sim.enemyBullets.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
  const spreadLeft = angles[1] - angles[0];
  const spreadRight = angles[2] - angles[1];
  assert.ok(Math.abs(spreadLeft - BOSS_VOLLEY_SPREAD_RAD) < 0.001);
  assert.ok(Math.abs(spreadRight - BOSS_VOLLEY_SPREAD_RAD) < 0.001);

  const toPlayerAngle = Math.atan2(sim.player.y - boss.y, sim.player.x - boss.x);
  assert.ok(Math.abs(angles[1] - toPlayerAngle) < 0.05, 'center bullet aims in player general direction');

  // After 15s of boss fight, fireTimer resets to ~0.8s floor
  sim.enemyBullets.length = 0;
  boss.fightElapsedSeconds = BOSS_FIRE_RAMP_SECONDS;
  boss.fireTimer = 0.02;
  stepSimulation(sim, emptyInput(), 0.03, () => 0.5);
  assert.equal(sim.enemyBullets.length, 3);
  assert.ok(
    Math.abs(boss.fireTimer - BOSS_MIN_FIRE_INTERVAL) < 0.001,
    `expected fireTimer near ${BOSS_MIN_FIRE_INTERVAL}, got ${boss.fireTimer}`
  );

  // Verify boss bullet triggers standard hit & 1.4s invulnerability when reaching player hit radius
  const hitBullet = sim.enemyBullets[1];
  hitBullet.x = sim.player.x;
  hitBullet.y = sim.player.y;
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 2);
  assert.ok(sim.player.invulnTimer > 1.3 && sim.player.invulnTimer <= INVULNERABILITY_SECONDS);
});

test('boss defeat drops a random power-up that falls straight down and removes offscreen if missed', () => {
  const sim = createInitialSimulation(0, 'playing');
  sim.wave = 5;
  const boss = spawnBoss(sim);
  boss.x = 340;
  boss.y = 152;
  boss.hp = 1;

  sim.playerBullets.push({
    id: 5001,
    x: 340,
    y: 152,
    vx: 0,
    vy: -800,
    radius: 4,
    active: true,
  });

  // rng = 0.0 -> 'shield', 0.4 -> 'rapid_fire', 0.8 -> 'spread_shot'
  stepSimulation(sim, emptyInput(), 0.016, () => 0.4);
  assert.equal(sim.boss, null);
  assert.equal(sim.powerUps.length, 1);
  assert.equal(sim.powerUps[0].type, 'rapid_fire');
  const dropX = sim.powerUps[0].x;
  assert.ok(Math.abs(dropX - 340) < 3, 'pickup spawns at boss x');
  assert.equal(sim.powerUps[0].vy, POWERUP_FALL_SPEED);

  // Move player away and step until pickup drifts off bottom (x stays unchanged)
  sim.player.x = 800;
  sim.hitstopTimer = 0;
  for (let i = 0; i < 200 && sim.powerUps.length > 0; i++) {
    if (sim.powerUps[0]) {
      assert.equal(sim.powerUps[0].x, dropX, 'pickup falls straight down');
    }
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  assert.equal(sim.powerUps.length, 0);
  assert.equal(sim.activePowerUp, null);
});

test('power-ups: shield absorbs next hit, rapid fire halves cooldown for 10s, spread shot fires 3 bullets for 10s, and new pickup replaces old', () => {
  const sim = createInitialSimulation(0, 'playing');

  // 1. Collect shield and absorb a direct bullet hit without losing a life
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'shield');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.powerUps.length, 0);
  assert.equal(sim.activePowerUp, 'shield');

  sim.enemyBullets.push({
    id: 6001,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 150,
    radius: 4.5,
    grazed: false,
    inGrazeRing: false,
    grazeX: sim.player.x,
    grazeY: sim.player.y,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.lives, 3, 'shield should absorb hit without losing life');
  assert.equal(sim.activePowerUp, null, 'shield should be consumed on hit');
  assert.ok(sim.player.invulnTimer > 1.3);

  // 2. Collect rapid_fire -> halves cooldown (~0.11s) for 10s, then expires
  sim.hitstopTimer = 0;
  sim.player.invulnTimer = 0;
  sim.player.fireCooldown = 0;
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'rapid_fire');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.activePowerUp, 'rapid_fire');

  stepSimulation(sim, emptyInput({ fireHeld: true, fireJustPressed: true }), 0.016, () => 0.5);
  assert.ok(Math.abs(sim.player.fireCooldown - FIRE_COOLDOWN_SECONDS * 0.5) < 0.001);

  // Wait 0.12s -> fires again (normal 0.22s cooldown would block this)
  for (let i = 0; i < 6; i++) {
    stepSimulation(sim, emptyInput({ fireHeld: true }), 0.02, () => 0.5);
  }
  assert.equal(sim.playerBullets.length, 2);

  // 3. Collect spread_shot while rapid_fire is still active -> replaces rapid_fire!
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'spread_shot');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  assert.equal(sim.activePowerUp, 'spread_shot');
  assert.ok(sim.powerUpTimer > 9.9 && sim.powerUpTimer <= POWERUP_DURATION_SECONDS);

  // Fire spread shot -> 3 bullets in narrow fan and normal cooldown restored (no longer halved)
  sim.playerBullets.length = 0;
  sim.player.fireCooldown = 0;
  stepSimulation(sim, emptyInput({ fireHeld: true, fireJustPressed: true }), 0.016, () => 0.5);
  assert.equal(sim.playerBullets.length, 3);
  assert.ok(Math.abs(sim.player.fireCooldown - FIRE_COOLDOWN_SECONDS) < 0.001);

  const spreadAngles = sim.playerBullets
    .map((b) => Math.atan2(b.vx, -b.vy))
    .sort((a, b) => a - b);
  assert.ok(Math.abs(spreadAngles[0] + PLAYER_SPREAD_ANGLE_RAD) < 0.001);
  assert.ok(Math.abs(spreadAngles[1]) < 0.001);
  assert.ok(Math.abs(spreadAngles[2] - PLAYER_SPREAD_ANGLE_RAD) < 0.001);

  // Advance past 10s -> spread_shot expires back to single shot
  for (let i = 0; i < 210; i++) {
    sim.player.invulnTimer = 1.0;
    sim.hitstopTimer = 0;
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  assert.equal(sim.activePowerUp, null);
  sim.enemies.length = 0;
  sim.hitstopTimer = 0;
  sim.playerBullets.length = 0;
  stepSimulation(sim, emptyInput({ fireHeld: true, fireJustPressed: true }), 0.016, () => 0.5);
  assert.equal(sim.playerBullets.length, 1);
});

test('power-up HUD snapshot exposes activePowerUp and timed countdowns accurately', () => {
  const sim = createInitialSimulation(0, 'playing');

  let snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, null);
  assert.equal(snap.powerUpSeconds, null);

  // Shield: activePowerUp === 'shield', powerUpSeconds === null (no timer), clears immediately on hit
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'shield');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, 'shield');
  assert.equal(snap.powerUpSeconds, null);

  sim.enemyBullets.push({
    id: 7001,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 150,
    radius: 4.5,
    grazed: false,
    inGrazeRing: false,
    grazeX: sim.player.x,
    grazeY: sim.player.y,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, null);
  assert.equal(snap.powerUpSeconds, null);

  // Rapid fire: shows 10s countdown, ticks down, clears immediately when timer hits 0
  sim.hitstopTimer = 0;
  sim.player.invulnTimer = 0;
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'rapid_fire');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, 'rapid_fire');
  assert.equal(snap.powerUpSeconds, 10);

  // Advance 5.5s -> remaining ~4.5s -> ceil = 5s
  for (let i = 0; i < 110; i++) {
    sim.player.invulnTimer = 1.0;
    sim.hitstopTimer = 0;
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, 'rapid_fire');
  assert.equal(snap.powerUpSeconds, 5);

  // Advance remaining ~4.6s -> expires and clears immediately
  for (let i = 0; i < 95; i++) {
    sim.player.invulnTimer = 1.0;
    sim.hitstopTimer = 0;
    stepSimulation(sim, emptyInput(), 0.05, () => 0.5);
  }
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, null);
  assert.equal(snap.powerUpSeconds, null);

  // Spread shot: shows 10s countdown and clears when expired
  spawnPowerUp(sim, sim.player.x, sim.player.y, () => 0, 'spread_shot');
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  snap = getSnapshot(sim);
  assert.equal(snap.activePowerUp, 'spread_shot');
  assert.equal(snap.powerUpSeconds, 10);
});

test('impact feedback: enemy kill triggers single-frame hitstop and subtle ~100ms shake; player hit uses stronger longer shake', () => {
  const sim = createInitialSimulation(0, 'playing');
  const enemy = spawnEnemy(sim, () => 0.5);
  enemy.x = 450;
  enemy.y = 320;

  sim.playerBullets.push({
    id: 8001,
    x: 450,
    y: 325,
    vx: 0,
    vy: -800,
    radius: 4,
    active: true,
  });

  // Kill enemy
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  const killShake = getCameraShakeAmplitude(sim.trauma);
  assert.ok(killShake >= 2.5 && killShake <= 5, `expected subtle kill shake (2.5..5px), got ${killShake}`);
  assert.ok(sim.hitstopTimer > 0 && sim.hitstopTimer <= 0.016, 'expected single-frame hitstop');

  // Next frame (60fps ~16ms) freezes player movement (hit-stop) while trauma decays slightly
  const frozenPlayerX = sim.player.x;
  const frozenElapsed = sim.elapsedSeconds;
  stepSimulation(sim, emptyInput({ right: true }), 0.016, () => 0.5);
  assert.equal(sim.player.x, frozenPlayerX, 'player stays frozen during single-frame hit-stop');
  assert.equal(sim.elapsedSeconds, frozenElapsed, 'simulation clock freezes during hit-stop');
  assert.equal(sim.hitstopTimer, 0, 'hit-stop clears after a single frame');

  // Following frame resumes normal movement immediately
  stepSimulation(sim, emptyInput({ right: true }), 0.016, () => 0.5);
  assert.ok(sim.player.x > frozenPlayerX, 'player resumes moving on frame after hit-stop');

  // After ~110ms total from kill, kill shake has decayed back to 0
  for (let i = 0; i < 6; i++) {
    stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  }
  assert.equal(getCameraShakeAmplitude(sim.trauma), 0, 'kill shake ends cleanly around ~100ms');

  // Player taking a hit triggers stronger and longer shake than an enemy kill
  sim.enemies.length = 0;
  sim.enemyBullets.push({
    id: 8002,
    x: sim.player.x,
    y: sim.player.y,
    vx: 0,
    vy: 150,
    radius: 4.5,
    grazed: false,
    inGrazeRing: false,
    grazeX: sim.player.x,
    grazeY: sim.player.y,
    active: true,
  });
  stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  const hitShake = getCameraShakeAmplitude(sim.trauma);
  assert.ok(hitShake > killShake + 2, `expected player hit shake (${hitShake}) > kill shake (${killShake})`);

  // At ~120ms after player hit, shake is still active (> kill duration), then settles by ~250ms
  for (let i = 0; i < 7; i++) {
    stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  }
  assert.ok(getCameraShakeAmplitude(sim.trauma) > 0, 'player hit shake lasts longer than kill shake');
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, emptyInput(), 0.016, () => 0.5);
  }
  assert.equal(getCameraShakeAmplitude(sim.trauma), 0, 'player hit shake settles cleanly');
});



