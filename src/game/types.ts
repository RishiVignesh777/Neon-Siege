export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type SoundEvent =
  | 'shoot'
  | 'enemyDestroy'
  | 'enemyTelegraph'
  | 'playerHit'
  | 'graze'
  | 'waveUp'
  | 'gameOver'
  | 'start';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hitRadius: number;
  grazeRadius: number;
  fireCooldown: number;
  fireBufferTimer: number;
  muzzleFlashTimer: number;
  invulnTimer: number;
  grazeFlashTimer: number;
  squashX: number;
  squashY: number;
}

export interface PlayerBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  weaveAmp: number;
  weaveFreq: number;
  weavePhase: number;
  fireTimer: number;
  telegraphTimer: number;
  isTelegraphing: boolean;
  hitFlashTimer: number;
  spinAngle: number;
  active: boolean;
}

export interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grazed: boolean;
  inGrazeRing: boolean;
  grazeX: number;
  grazeY: number;
  active: boolean;
}

export interface GrazePopup {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  amount: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  isShard: boolean;
  angle: number;
  spin: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fireHeld: boolean;
  fireJustPressed: boolean;
}

export interface DifficultyParams {
  spawnInterval: number;
  enemySpeed: number;
  enemyBulletSpeed: number;
  enemyFireInterval: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  score: number;
  bestScore: number;
  wave: number;
  lives: number;
  multiplier: number;
  elapsedSeconds: number;
  kills: number;
  isNewBest: boolean;
}

export interface SimulationState {
  phase: GamePhase;
  width: number;
  height: number;
  player: Player;
  playerBullets: PlayerBullet[];
  enemies: Enemy[];
  enemyBullets: EnemyBullet[];
  particles: Particle[];
  particleCursor: number;
  nextEntityId: number;
  lives: number;
  maxLives: number;
  killScore: number;
  timeScore: number;
  grazeScore: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  multiplier: number;
  comboTimer: number;
  wave: number;
  waveBannerTimer: number;
  elapsedSeconds: number;
  spawnTimer: number;
  kills: number;
  hitstopTimer: number;
  dyingTimer: number;
  trauma: number;
  gridOffset: number;
  grazePopups: GrazePopup[];
  grazePopupCursor: number;
  pendingEvents: SoundEvent[];
}
