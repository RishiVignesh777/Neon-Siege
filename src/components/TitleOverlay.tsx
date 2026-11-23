import type { LeaderboardEntry } from '../game/leaderboard';
import { LeaderboardList } from './LeaderboardList';

interface TitleOverlayProps {
  bestScore: number;
  leaderboard: readonly LeaderboardEntry[];
  onStart: () => void;
}

export function TitleOverlay({ bestScore, leaderboard, onStart }: TitleOverlayProps) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 py-3 text-center sm:px-6"
      role="region"
      aria-label="NEON SIEGE Title Screen"
    >
      {/* Subtle dark radial backdrop behind title text for crisp legibility over grid */}
      <div
        className="flex w-full max-w-xl flex-col items-center rounded-2xl px-4 py-3 sm:px-8 sm:py-6"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(5, 6, 11, 0.9) 0%, rgba(5, 6, 11, 0.55) 70%, rgba(5, 6, 11, 0) 100%)',
        }}
      >
        {/* Bespoke inline SVG Title Lockup */}
        <svg
          viewBox="0 0 540 132"
          className="mb-1.5 w-full max-w-[260px] overflow-visible sm:mb-2 sm:max-w-[400px]"
          role="img"
          aria-label="NEON SIEGE"
        >
          <defs>
            <filter id="neonGlowCyan" x="-20%" y="-30%" width="140%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#00f5ff" floodOpacity="0.65" />
            </filter>
            <filter id="neonGlowMagenta" x="-20%" y="-30%" width="140%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff1e8a" floodOpacity="0.65" />
            </filter>
          </defs>

          {/* Emblem diamond + ship chevron */}
          <polygon
            points="270,6 286,20 270,34 254,20"
            fill="rgba(255, 30, 138, 0.16)"
            stroke="#ff1e8a"
            strokeWidth="2"
            filter="url(#neonGlowMagenta)"
          />
          <polygon points="270,13 276,22 270,20 264,22" fill="#00f5ff" />

          {/* Main title typography */}
          <text
            x="270"
            y="88"
            textAnchor="middle"
            fill="#f2fbff"
            stroke="#00f5ff"
            strokeWidth="1.5"
            paintOrder="stroke fill"
            filter="url(#neonGlowCyan)"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '58px',
              fontWeight: 700,
              letterSpacing: '0.14em',
            }}
          >
            NEON SIEGE
          </text>

          {/* Crisp underline vector accent */}
          <line x1="90" y1="108" x2="235" y2="108" stroke="#00f5ff" strokeOpacity="0.7" strokeWidth="1.5" />
          <polygon points="270,103 275,108 270,113 265,108" fill="#8b5cf6" />
          <line x1="305" y1="108" x2="450" y2="108" stroke="#ff1e8a" strokeOpacity="0.7" strokeWidth="1.5" />
        </svg>

        {/* One-line control reminder */}
        <p className="mb-3 whitespace-nowrap text-xs font-medium tracking-[0.05em] text-[#a5b8d0] sm:mb-5 sm:text-base sm:tracking-[0.06em]">
          WASD / Arrows Move <span className="mx-1.5 text-[#8b5cf6] sm:mx-2">·</span> Space Fire{' '}
          <span className="mx-1.5 text-[#8b5cf6] sm:mx-2">·</span> P Pause
        </p>

        {/* Primary Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStart}
          className="animate-prompt-pulse cursor-pointer rounded-md border border-[#00f5ff]/80 bg-[#071a24]/90 px-6 py-2.5 text-sm font-bold tracking-[0.12em] text-[#e6fbff] shadow-[0_0_24px_rgba(0,245,255,0.28)] transition-all duration-150 hover:border-[#00f5ff] hover:bg-[#0b2a3a] hover:shadow-[0_0_32px_rgba(0,245,255,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f5ff] active:scale-[0.98] sm:px-8 sm:py-3 sm:text-base"
        >
          Press SPACE to start
        </button>

        {bestScore > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-[#8fa3bf] uppercase sm:mt-4">
            <span>Best Score</span>
            <span aria-hidden="true" className="text-[#8b5cf6]">
              ·
            </span>
            <span className="font-mono-num text-sm font-bold text-[#00f5ff]">{bestScore.toLocaleString()}</span>
          </div>
        )}

        <div className="mt-3 flex w-full justify-center sm:mt-4">
          <LeaderboardList entries={leaderboard} testId="title-leaderboard" />
        </div>
      </div>
    </div>
  );
}
