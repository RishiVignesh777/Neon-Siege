import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  COLORS,
  ENEMY_TELEGRAPH_SECONDS,
  LOWER_ZONE_TOP_RATIO,
  MAX_GRAZE_POPUPS,
  MAX_PARTICLES,
} from './constants';
import type { Boss, Enemy, SimulationState } from './types';

interface BgMote {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  hue: 'cyan' | 'violet' | 'magenta';
}

const BG_MOTES: BgMote[] = Array.from({ length: 34 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const r1 = seed / 233280;
  const r2 = ((i * 7919 + 12347) % 233280) / 233280;
  const hues: BgMote['hue'][] = ['violet', 'cyan', 'magenta'];
  return {
    x: r1 * ARENA_WIDTH,
    y: r2 * ARENA_HEIGHT,
    size: 1.2 + (i % 3) * 0.7,
    speed: 14 + (i % 5) * 9,
    alpha: 0.16 + (i % 4) * 0.06,
    hue: hues[i % hues.length],
  };
});

let cachedBackdrop: HTMLCanvasElement | null = null;

function getBackdropCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedBackdrop && cachedBackdrop.width === width && cachedBackdrop.height === height) {
    return cachedBackdrop;
  }
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const octx = off.getContext('2d');
  if (!octx) return null;

  octx.fillStyle = COLORS.bg;
  octx.fillRect(0, 0, width, height);

  const topGlow = octx.createRadialGradient(
    width * 0.5,
    height * 0.18,
    20,
    width * 0.5,
    height * 0.18,
    width * 0.72
  );
  topGlow.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
  topGlow.addColorStop(0.55, 'rgba(0, 245, 255, 0.035)');
  topGlow.addColorStop(1, 'rgba(5, 6, 11, 0)');
  octx.fillStyle = topGlow;
  octx.fillRect(0, 0, width, height);

  cachedBackdrop = off;
  return off;
}

function drawBackground(ctx: CanvasRenderingContext2D, sim: SimulationState, timeSec: number): void {
  const { width, height } = sim;

  const backdrop = getBackdropCanvas(width, height);
  if (backdrop) {
    ctx.drawImage(backdrop, 0, 0);
  } else {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);
  }

  // Faint scrolling grid
  const cell = 48;
  const offsetY = sim.gridOffset;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.13)';
  ctx.beginPath();
  for (let x = cell; x < width; x += cell) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = offsetY - cell; y < height + cell; y += cell) {
    const py = Math.round(y) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }
  ctx.stroke();

  // Subtle brighter cyan grid intersections
  ctx.fillStyle = 'rgba(0, 245, 255, 0.2)';
  for (let x = cell; x < width; x += cell * 2) {
    for (let y = offsetY - cell; y < height + cell; y += cell * 2) {
      ctx.fillRect(x - 1, Math.round(y) - 1, 2, 2);
    }
  }

  // Drifting ambient motes
  for (let i = 0; i < BG_MOTES.length; i++) {
    const m = BG_MOTES[i];
    const y = (m.y + timeSec * m.speed) % height;
    ctx.fillStyle =
      m.hue === 'cyan'
        ? `rgba(0, 245, 255, ${m.alpha})`
        : m.hue === 'magenta'
          ? `rgba(255, 30, 138, ${m.alpha * 0.85})`
          : `rgba(139, 92, 246, ${m.alpha})`;
    ctx.fillRect(m.x, y, m.size, m.size);
  }

  // On title screen, draw subtle peripheral neon diamond silhouettes & ship patrol hint
  if (sim.phase === 'title') {
    const ghosts = [
      { x: 140, y: 150, s: 16, speed: 18, phase: 0.2 },
      { x: 760, y: 210, s: 14, speed: 22, phase: 1.7 },
      { x: 195, y: 560, s: 12, speed: 15, phase: 3.1 },
      { x: 715, y: 540, s: 15, speed: 20, phase: 4.5 },
    ];
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const gy = ((g.y + timeSec * g.speed) % (height + 60)) - 30;
      const gx = g.x + Math.sin(timeSec * 0.8 + g.phase) * 14;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.strokeStyle = 'rgba(255, 30, 138, 0.28)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -g.s);
      ctx.lineTo(g.s * 0.85, 0);
      ctx.lineTo(0, g.s);
      ctx.lineTo(-g.s * 0.85, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 112, 184, 0.65)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Lower ~60% play-zone upper boundary marker
  if (sim.phase === 'playing' || sim.phase === 'paused') {
    const zoneY = Math.round(height * LOWER_ZONE_TOP_RATIO) + 0.5;
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.22)';
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(18, zoneY);
    ctx.lineTo(width - 18, zoneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0, 245, 255, 0.45)';
    ctx.fillRect(8, zoneY - 1, 8, 2);
    ctx.fillRect(width - 16, zoneY - 1, 8, 2);
  }

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, sim: SimulationState, timeSec: number): void {
  if (sim.dyingTimer > 0 || sim.phase === 'gameover') return;
  const p = sim.player;

  // Blinking effect during 1.4s invulnerability
  const isInvuln = p.invulnTimer > 0;
  const flashOff = isInvuln && Math.floor(p.invulnTimer * 18) % 2 === 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.squashX, p.squashY);

  // Protective invulnerability ring
  if (isInvuln) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.rotate(timeSec * 3.5);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Subtle 26px graze ring + brief bright flash on near-miss
  ctx.save();
  if (p.grazeFlashTimer > 0) {
    const flashRatio = Math.min(1, p.grazeFlashTimer / 0.16);
    ctx.strokeStyle = `rgba(103, 249, 255, ${0.22 + flashRatio * 0.65})`;
    ctx.lineWidth = 1.4 + flashRatio * 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, p.grazeRadius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.grazeRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (flashOff) {
    ctx.globalAlpha = 0.28;
  }

  // Soft cyan aura behind ship (zero-blur neon bloom)
  ctx.fillStyle = 'rgba(0, 245, 255, 0.14)';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
  ctx.fill();

  // Thruster exhaust flame
  const flameLen = 10 + Math.sin(timeSec * 42) * 3.5;
  ctx.fillStyle = COLORS.violet;
  ctx.beginPath();
  ctx.moveTo(-5, p.radius - 2);
  ctx.lineTo(0, p.radius + flameLen + 3);
  ctx.lineTo(5, p.radius - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.cyanSoft;
  ctx.beginPath();
  ctx.moveTo(-2.5, p.radius - 2);
  ctx.lineTo(0, p.radius + flameLen * 0.65);
  ctx.lineTo(2.5, p.radius - 2);
  ctx.closePath();
  ctx.fill();

  // Ship silhouette path
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 3);
  ctx.lineTo(p.radius + 1, p.radius - 2);
  ctx.lineTo(5, p.radius - 6);
  ctx.lineTo(0, p.radius - 3);
  ctx.lineTo(-5, p.radius - 6);
  ctx.lineTo(-p.radius - 1, p.radius - 2);
  ctx.closePath();

  ctx.fillStyle = '#07222b';
  ctx.fill();

  // Multi-pass neon hull stroke
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.28)';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Wing accent ribs
  ctx.strokeStyle = COLORS.violet;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(-3, -4);
  ctx.moveTo(9, 6);
  ctx.lineTo(3, -4);
  ctx.stroke();

  // Bright cockpit core
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.moveTo(0, -p.radius + 5);
  ctx.lineTo(3.5, 3);
  ctx.lineTo(0, 6);
  ctx.lineTo(-3.5, 3);
  ctx.closePath();
  ctx.fill();

  // Muzzle flash
  if (p.muzzleFlashTimer > 0) {
    ctx.fillStyle = 'rgba(0, 245, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, -p.radius - 4, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(0, -p.radius - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  ctx.save();
  ctx.translate(e.x, e.y);

  // Soft magenta radial glow
  ctx.fillStyle = e.isTelegraphing ? 'rgba(255, 30, 138, 0.24)' : 'rgba(255, 30, 138, 0.13)';
  ctx.beginPath();
  ctx.arc(0, 0, e.radius + 9, 0, Math.PI * 2);
  ctx.fill();

  // Telegraph ring before aimed shot
  if (e.isTelegraphing) {
    const progress = 1 - Math.max(0, e.telegraphTimer) / ENEMY_TELEGRAPH_SECONDS;
    const ringRadius = e.radius + 13 - progress * 9;
    ctx.strokeStyle = `rgba(255, 112, 184, ${0.4 + progress * 0.6})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const r = e.radius;

  // Outer glowing magenta diamond
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.88, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.88, 0);
  ctx.closePath();

  ctx.fillStyle = e.isTelegraphing ? '#3a0b28' : '#24071a';
  ctx.fill();

  // Multi-pass neon stroke
  ctx.strokeStyle = 'rgba(255, 30, 138, 0.32)';
  ctx.lineWidth = 6.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = e.isTelegraphing ? COLORS.white : COLORS.magenta;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Inner counter-rotating facet
  ctx.save();
  ctx.rotate(e.spinAngle);
  const ir = r * 0.42;
  ctx.strokeStyle = COLORS.magentaSoft;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -ir);
  ctx.lineTo(ir, 0);
  ctx.lineTo(0, ir);
  ctx.lineTo(-ir, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Bright core
  ctx.fillStyle = e.isTelegraphing ? COLORS.white : COLORS.magentaSoft;
  ctx.beginPath();
  ctx.arc(0, 0, e.isTelegraphing ? 3.5 : 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function traceHexagonPath(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const vx = Math.cos(angle) * radius;
    const vy = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss): void {
  ctx.save();
  ctx.translate(boss.x, boss.y);

  const r = boss.radius;
  const hitFlash = boss.hitFlashTimer > 0;

  // Soft violet ambient aura (no shadowBlur)
  ctx.fillStyle = hitFlash ? 'rgba(216, 180, 254, 0.28)' : 'rgba(139, 92, 246, 0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 16, 0, Math.PI * 2);
  ctx.fill();

  // Outer violet hexagon body
  traceHexagonPath(ctx, r);
  ctx.fillStyle = hitFlash ? '#4c1d95' : '#1b0d38';
  ctx.fill();

  // Multi-pass brighter violet glow outline
  ctx.strokeStyle = hitFlash ? 'rgba(244, 251, 255, 0.45)' : 'rgba(168, 85, 247, 0.36)';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = hitFlash ? COLORS.white : '#c084fc';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = hitFlash ? COLORS.white : '#e9d5ff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Inner rotating hexagon core
  ctx.save();
  ctx.rotate(boss.spinAngle);
  traceHexagonPath(ctx, r * 0.54);
  ctx.strokeStyle = hitFlash ? COLORS.white : COLORS.violet;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  // Central bright core
  ctx.fillStyle = hitFlash ? COLORS.white : '#e9d5ff';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullets(ctx: CanvasRenderingContext2D, sim: SimulationState): void {
  // Player bullets (cyan vertical laser bolts)
  for (let i = 0; i < sim.playerBullets.length; i++) {
    const b = sim.playerBullets[i];
    if (!b.active) continue;

    ctx.fillStyle = 'rgba(0, 245, 255, 0.28)';
    ctx.fillRect(b.x - 4, b.y - 10, 8, 20);

    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(b.x - 2, b.y - 8, 4, 16);

    ctx.fillStyle = COLORS.white;
    ctx.fillRect(b.x - 1, b.y - 6, 2, 10);
  }

  // Enemy bullets (glowing magenta-violet orbs)
  for (let i = 0; i < sim.enemyBullets.length; i++) {
    const b = sim.enemyBullets[i];
    if (!b.active) continue;

    ctx.fillStyle = 'rgba(255, 30, 138, 0.28)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.magenta;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: SimulationState): void {
  ctx.save();
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = sim.particles[i];
    if (!p.active) continue;

    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.isShard) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const s = p.size * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const r = p.size * (0.45 + alpha * 0.55);
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}

function drawWaveBanner(ctx: CanvasRenderingContext2D, sim: SimulationState): void {
  if (sim.waveBannerTimer <= 0 || sim.phase !== 'playing') return;
  const alpha = Math.min(1, sim.waveBannerTimer / 0.45) * Math.min(1, (1.65 - sim.waveBannerTimer) / 0.2);
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 22px "Chakra Petch", sans-serif';
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.38)';
  ctx.lineWidth = 4;
  ctx.strokeText(`WAVE ${String(sim.wave).padStart(2, '0')}`, sim.width / 2, sim.height * 0.24);
  ctx.fillStyle = COLORS.cyanSoft;
  ctx.fillText(`WAVE ${String(sim.wave).padStart(2, '0')}`, sim.width / 2, sim.height * 0.24);
  ctx.restore();
}

function drawGrazePopups(ctx: CanvasRenderingContext2D, sim: SimulationState): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  for (let i = 0; i < MAX_GRAZE_POPUPS; i++) {
    const popup = sim.grazePopups[i];
    if (!popup.active) continue;
    const alpha = Math.max(0, Math.min(1, popup.life / popup.maxLife));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(5, 6, 11, 0.85)';
    ctx.lineWidth = 3;
    const label = `+${popup.amount}`;
    ctx.strokeText(label, popup.x, popup.y);
    ctx.fillStyle = COLORS.cyanSoft;
    ctx.fillText(label, popup.x, popup.y);
  }
  ctx.restore();
}

export function renderSimulation(
  ctx: CanvasRenderingContext2D,
  sim: SimulationState,
  timeSec: number,
  rng: () => number = Math.random
): void {
  ctx.save();

  // Apply decaying camera trauma shake
  if (sim.trauma > 0.005) {
    const shake = sim.trauma * sim.trauma * 9;
    const ox = (rng() * 2 - 1) * shake;
    const oy = (rng() * 2 - 1) * shake;
    ctx.translate(ox, oy);
  }

  drawBackground(ctx, sim, timeSec);

  if (sim.phase !== 'title') {
    drawBullets(ctx, sim);
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i];
      if (e.active) drawEnemy(ctx, e);
    }
    if (sim.boss && sim.boss.active) {
      drawBoss(ctx, sim.boss);
    }
    drawPlayer(ctx, sim, timeSec);
    drawParticles(ctx, sim);
    drawGrazePopups(ctx, sim);
    drawWaveBanner(ctx, sim);
  }

  ctx.restore();
}
