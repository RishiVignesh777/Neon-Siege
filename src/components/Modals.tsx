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
  onRetry: () => void;
  onQuitToTitle: () => void;
}

export function GameOverModal({
  score,
  bestScore,
  wave,
  elapsedSeconds,
  isNewBest,
  onRetry,
  onQuitToTitle,
}: GameOverModalProps) {
  const survivedSec = Math.floor(elapsedSeconds);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#05060b]/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#ff1e8a]/55 bg-[#0a0914] p-8 text-center shadow-[0_0_50px_rgba(255,30,138,0.24)]">
        <h2
          id="gameover-title"
          className="text-3xl font-bold tracking-[0.14em] text-[#ff57a8] uppercase sm:text-4xl"
          style={{ textShadow: '0 0 18px rgba(255, 30, 138, 0.7)' }}
        >
          SYSTEM BREACH
        </h2>

        <div className="mt-6 grid grid-cols-2 gap-4 border-y border-[#8b5cf6]/25 py-5">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[#8ba1bd] uppercase">
              Final Score
            </span>
            <span
              data-testid="final-score"
              className="font-mono-num mt-1 text-3xl font-bold text-[#e8fbff]"
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
              className="font-mono-num mt-1 text-3xl font-bold text-[#00f5ff]"
              style={{ textShadow: '0 0 12px rgba(0, 245, 255, 0.45)' }}
            >
              {bestScore.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.12em] text-[#8ba1bd] uppercase">
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

        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="animate-prompt-pulse w-full cursor-pointer rounded-md border border-[#00f5ff]/85 bg-[#08222d] px-6 py-3.5 text-sm font-bold tracking-[0.12em] text-[#e8fbff] shadow-[0_0_24px_rgba(0,245,255,0.28)] transition-all duration-150 hover:border-[#00f5ff] hover:bg-[#0d3344] hover:shadow-[0_0_32px_rgba(0,245,255,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f5ff]"
          >
            Press SPACE to retry
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="cursor-pointer px-4 py-1.5 text-xs font-semibold tracking-[0.14em] text-[#8ba1bd] uppercase transition-colors hover:text-[#e6f7ff]"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
