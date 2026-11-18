import type { RefObject } from 'react';

interface GameHudProps {
  score: number;
  scoreRef?: RefObject<HTMLSpanElement | null>;
  multiplier: number;
  wave: number;
  bossHp: number | null;
  bossMaxHp: number | null;
  lives: number;
  maxLives: number;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 sm:h-7 sm:w-7"
      aria-hidden="true"
    >
      {filled && (
        <path
          d="M12 20.6C11.7 20.6 11.4 20.5 11.2 20.3C6.1 16.1 3 12.9 3 8.9C3 6.1 5.2 4 7.9 4C9.5 4 11 4.8 12 6C13 4.8 14.5 4 16.1 4C18.8 4 21 6.1 21 8.9C21 12.9 17.9 16.1 12.8 20.3C12.6 20.5 12.3 20.6 12 20.6Z"
          fill="none"
          stroke="rgba(255, 30, 138, 0.35)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
      )}
      <path
        d="M12 20.6C11.7 20.6 11.4 20.5 11.2 20.3C6.1 16.1 3 12.9 3 8.9C3 6.1 5.2 4 7.9 4C9.5 4 11 4.8 12 6C13 4.8 14.5 4 16.1 4C18.8 4 21 6.1 21 8.9C21 12.9 17.9 16.1 12.8 20.3C12.6 20.5 12.3 20.6 12 20.6Z"
        fill={filled ? '#ff1e8a' : 'rgba(139, 92, 246, 0.08)'}
        stroke={filled ? '#ff70b8' : 'rgba(139, 92, 246, 0.42)'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {filled && (
        <path
          d="M7.6 7.4C6.6 7.8 6.1 8.6 6.1 9.6"
          stroke="#ffe4f2"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function GameHud({
  score,
  scoreRef,
  multiplier,
  wave,
  bossHp,
  bossMaxHp,
  lives,
  maxLives,
  muted,
  onToggleMute,
  onTogglePause,
}: GameHudProps) {
  const showBossBar = bossHp !== null && bossMaxHp !== null && bossMaxHp > 0;
  const bossPct = showBossBar ? Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100)) : 0;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-start px-3 pt-2.5 sm:px-6 sm:pt-4"
      aria-label="Game HUD"
    >
      {/* Left: Score + Combo Multiplier */}
      <div className="flex flex-col items-start justify-self-start">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-[#8ba1bd] uppercase sm:text-[11px]">
          Score
        </span>
        <div className="flex items-baseline gap-2">
          <span
            ref={scoreRef}
            data-testid="hud-score"
            className="font-mono-num text-xl leading-none font-bold text-[#e8fbff] sm:text-3xl"
            style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.45)' }}
          >
            {score.toLocaleString()}
          </span>
          {multiplier > 1 && (
            <span
              key={multiplier}
              data-testid="hud-multiplier"
              className="font-mono-num animate-combo-pulse text-sm leading-none font-bold text-[#ff70b8] sm:text-lg"
              style={{ textShadow: '0 0 12px rgba(255, 30, 138, 0.65)' }}
            >
              ×{multiplier}
            </span>
          )}
        </div>
      </div>

      {/* Center: Wave + Boss Health Bar when active */}
      <div className="flex flex-col items-center justify-self-center">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-[#8ba1bd] uppercase sm:text-[11px]">
          Wave
        </span>
        <span
          data-testid="hud-wave"
          className="font-mono-num text-xl leading-none font-bold text-[#00f5ff] sm:text-3xl"
          style={{ textShadow: '0 0 14px rgba(0, 245, 255, 0.55)' }}
        >
          {String(wave).padStart(2, '0')}
        </span>

        {showBossBar && (
          <div
            data-testid="boss-health-bar"
            className="mt-1 flex w-24 flex-col items-center sm:mt-1.5 sm:w-44"
            aria-label={`Boss health: ${bossHp} of ${bossMaxHp}`}
          >
            <div className="mb-0.5 flex w-full items-center justify-between text-[9px] font-semibold tracking-[0.14em] text-[#d8b4fe] uppercase sm:mb-1 sm:text-[10px]">
              <span>Boss</span>
              <span className="font-mono-num" data-testid="boss-hp-text">
                {bossHp}/{bossMaxHp}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm border border-[#a855f7]/60 bg-[#0b0818] sm:h-2">
              <div
                data-testid="boss-health-fill"
                className="h-full bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#e9d5ff] transition-[width] duration-75"
                style={{ width: `${bossPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right: Lives (Hearts) + compact Mute/Pause */}
      <div className="flex items-center gap-2 justify-self-end sm:gap-4">
        <div
          className="flex items-center gap-1 sm:gap-1.5"
          data-testid="hud-lives"
          aria-label={`Lives remaining: ${lives} of ${maxLives}`}
        >
          {Array.from({ length: maxLives }, (_, idx) => (
            <HeartIcon key={idx} filled={idx < lives} />
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute [M]' : 'Mute [M]'}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#8b5cf6]/35 bg-[#0a0d1a]/80 text-[#b6c8e0] transition-colors hover:border-[#00f5ff]/70 hover:text-[#00f5ff] sm:h-8 sm:w-8"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
                <path d="M22 9l-6 6M16 9l6 6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            aria-label="Pause game"
            title="Pause [P]"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[#8b5cf6]/35 bg-[#0a0d1a]/80 text-[#b6c8e0] transition-colors hover:border-[#00f5ff]/70 hover:text-[#00f5ff] sm:h-8 sm:w-8"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
