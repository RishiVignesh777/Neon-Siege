import { useState, type FormEvent } from 'react';
import type { LeaderboardEntry } from '../game/leaderboard';
import { LeaderboardList } from './LeaderboardList';

interface PauseModalProps {
  score: number;
  wave: number;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({
  score,
  wave,
  onResume,
  onRestart,
  onQuitToTitle,
}: PauseModalProps) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#05060b]/75 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-[#8b5cf6]/45 bg-[#090c18] p-7 text-center shadow-[0_0_40px_rgba(139,92,246,0.22)]">
        <h2
          id="pause-title"
          className="text-2xl font-bold tracking-[0.14em] text-[#e6f7ff] uppercase"
          style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.4)' }}
        >
          Paused
        </h2>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.12em] text-[#8ba1bd] uppercase">
          <span>
            Score <strong className="font-mono-num text-[#e6f7ff]">{score.toLocaleString()}</strong>
          </span>
          <span aria-hidden="true" className="text-[#8b5cf6]">
            ·
          </span>
          <span>
            Wave <strong className="font-mono-num text-[#00f5ff]">{String(wave).padStart(2, '0')}</strong>
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full cursor-pointer rounded border border-[#00f5ff]/75 bg-[#08222d] px-4 py-2.5 text-sm font-bold tracking-[0.1em] text-[#e8fbff] uppercase transition-colors hover:bg-[#0d3344] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f5ff]"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full cursor-pointer rounded border border-[#8b5cf6]/40 bg-[#101426] px-4 py-2.5 text-sm font-semibold tracking-[0.1em] text-[#cdd9ea] uppercase transition-colors hover:border-[#00f5ff]/50 hover:text-white"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full cursor-pointer rounded border border-transparent bg-transparent px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[#8ba1bd] uppercase transition-colors hover:text-[#e6f7ff]"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  score: number;
  bestScore: number;
  wave: number;
  elapsedSeconds: number;
  isNewBest: boolean;
  leaderboard: readonly LeaderboardEntry[];
  highlightIndex: number | null;
  needsInitials: boolean;
  onSubmitInitials: (initials: string) => void;
  onRetry: () => void;
  onQuitToTitle: () => void;
}

function InitialsOverlay({
  score,
  onSubmit,
}: {
  score: number;
  onSubmit: (initials: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(draft.trim() || 'AAA');
  };

  return (
    <div
      data-testid="initials-overlay"
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#05060b]/85 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initials-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-lg border border-[#00f5ff]/70 bg-[#090c18] p-6 text-center shadow-[0_0_50px_rgba(0,245,255,0.28)]"
      >
        <div
          id="initials-title"
          className="text-xs font-bold tracking-[0.2em] text-[#00f5ff] uppercase"
          style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.55)' }}
        >
          Top 5 Qualifier
        </div>
        <div className="font-mono-num mt-1.5 text-3xl font-bold text-[#e8fbff]">
          {score.toLocaleString()}
        </div>
        <label
          htmlFor="initials-tag-input"
          className="mt-4 block text-[11px] font-semibold tracking-[0.14em] text-[#a5b8d0] uppercase"
        >
          Enter 3-Letter Initials
        </label>
        <input
          id="initials-tag-input"
          data-testid="initials-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoFocus
          maxLength={3}
          placeholder="AAA"
          value={draft}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
            setDraft(clean);
          }}
          className="font-mono-num mt-2.5 w-36 rounded-md border border-[#8b5cf6]/65 bg-[#05060b] px-3 py-2 text-center text-2xl font-bold tracking-[0.3em] text-[#00f5ff] uppercase placeholder:text-[#4e6280] focus:border-[#00f5ff] focus:outline-none"
        />
        <p className="mt-2 text-[10px] tracking-[0.1em] text-[#7c92b0] uppercase">
          Leave blank for AAA · Press ENTER to save
        </p>
        <button
          type="submit"
          data-testid="initials-submit"
          className="mt-4 w-full cursor-pointer rounded-md border border-[#00f5ff]/85 bg-[#08222d] px-4 py-2.5 text-sm font-bold tracking-[0.12em] text-[#e8fbff] uppercase shadow-[0_0_20px_rgba(0,245,255,0.24)] transition-colors hover:bg-[#0d3344] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f5ff]"
        >
          Save Score
        </button>
      </form>
    </div>
  );
}

export function GameOverModal({
  score,
  bestScore,
  wave,
  elapsedSeconds,
  isNewBest,
  leaderboard,
  highlightIndex,
  needsInitials,
  onSubmitInitials,
  onRetry,
  onQuitToTitle,
}: GameOverModalProps) {
  const survivedSec = Math.floor(elapsedSeconds);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#05060b]/80 px-4 py-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#ff1e8a]/55 bg-[#0a0914] px-5 py-5 text-center shadow-[0_0_50px_rgba(255,30,138,0.24)] sm:px-8 sm:py-6">
        <h2
          id="gameover-title"
          className="text-2xl font-bold tracking-[0.14em] text-[#ff57a8] uppercase sm:text-3xl"
          style={{ textShadow: '0 0 18px rgba(255, 30, 138, 0.7)' }}
        >
          SYSTEM BREACH
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4 border-y border-[#8b5cf6]/25 py-3.5">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[#8ba1bd] uppercase">
              Final Score
            </span>
            <span
              data-testid="final-score"
              className="font-mono-num mt-0.5 text-2xl font-bold text-[#e8fbff] sm:text-3xl"
            >
              {score.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[#8ba1bd] uppercase">
              {isNewBest ? 'New Best Score' : 'Best Score'}
            </span>
            <span
              data-testid="best-score"
              className="font-mono-num mt-0.5 text-2xl font-bold text-[#00f5ff] sm:text-3xl"
              style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.45)' }}
            >
              {bestScore.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.12em] text-[#8ba1bd] uppercase">
          <span>
            Wave <strong className="font-mono-num text-[#e6f7ff]">{String(wave).padStart(2, '0')}</strong>
          </span>
          <span aria-hidden="true" className="text-[#8b5cf6]">
            ·
          </span>
          <span>
            Survived <strong className="font-mono-num text-[#e6f7ff]">{survivedSec}s</strong>
          </span>
        </div>

        <div className="mt-3.5 flex justify-center">
          <LeaderboardList
            entries={leaderboard}
            highlightIndex={highlightIndex}
            testId="gameover-leaderboard"
          />
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="animate-prompt-pulse w-full cursor-pointer rounded-md border border-[#00f5ff]/85 bg-[#08222d] px-6 py-3 text-sm font-bold tracking-[0.12em] text-[#e8fbff] shadow-[0_0_24px_rgba(0,245,255,0.28)] transition-all duration-150 hover:border-[#00f5ff] hover:bg-[#0d3344] hover:shadow-[0_0_32px_rgba(0,245,255,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f5ff]"
          >
            Press SPACE to retry
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="cursor-pointer px-4 py-1 text-xs font-semibold tracking-[0.14em] text-[#8ba1bd] uppercase transition-colors hover:text-[#e6f7ff]"
          >
            Return to Title
          </button>
        </div>
      </div>

      {needsInitials && <InitialsOverlay score={score} onSubmit={onSubmitInitials} />}
    </div>
  );
}
