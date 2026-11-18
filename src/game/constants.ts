export const ARENA_WIDTH = 900;
export const ARENA_HEIGHT = 720;

export const LOWER_ZONE_TOP_RATIO = 0.4; // Player confined to lower 60% of the screen

export const PLAYER_SPEED = 370;
export const PLAYER_RADIUS = 15;
export const PLAYER_HIT_RADIUS = 14;
export const PLAYER_GRAZE_RADIUS = 26;
export const FIRE_COOLDOWN_SECONDS = 0.22; // ~220ms
export const FIRE_INPUT_BUFFER_SECONDS = 0.09;
export const PLAYER_BULLET_SPEED = 820;
export const PLAYER_BULLET_RADIUS = 4;

export const MAX_LIVES = 3;
export const INVULNERABILITY_SECONDS = 1.4;
export const DEATH_BEAT_SECONDS = 0.48;

export const ENEMY_RADIUS = 17;
export const ENEMY_BULLET_RADIUS = 4.5;
export const ENEMY_TELEGRAPH_SECONDS = 0.28;

export const WAVE_DURATION_SECONDS = 15;
export const TIME_BONUS_POINTS_PER_SECOND = 10;
export const KILL_BASE_POINTS = 100;
export const COMBO_WINDOW_SECONDS = 1.5;
export const MAX_COMBO_MULTIPLIER = 10;
export const GRAZE_BONUS_POINTS = 2;

export const MAX_PARTICLES = 240;
export const MAX_GRAZE_POPUPS = 24;
export const MAX_DELTA_TIME = 0.05;

export const BEST_SCORE_STORAGE_KEY = 'neon_siege_best_score';

export const COLORS = {
  bg: '#05060b',
  bgDeep: '#070914',
  cyan: '#00f5ff',
  cyanSoft: '#67f9ff',
  magenta: '#ff1e8a',
  magentaSoft: '#ff70b8',
  violet: '#8b5cf6',
  violetDim: 'rgba(139, 92, 246, 0.14)',
  cyanDim: 'rgba(0, 245, 255, 0.16)',
  white: '#f4fbff',
} as const;
