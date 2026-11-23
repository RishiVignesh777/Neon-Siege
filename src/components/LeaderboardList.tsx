import type { LeaderboardEntry } from '../game/leaderboard';

interface LeaderboardListProps {
  entries: readonly LeaderboardEntry[];
  highlightIndex?: number | null;
  testId?: string;
}

export function LeaderboardList({
  entries,
  highlightIndex = null,
  testId = 'leaderboard',
}: LeaderboardListProps) {
  return (
    <div
      data-testid={testId}
      className="w-full max-w-[270px] sm:max-w-[300px]"
      aria-label="Top 5 High Scores"
    >
      <div className="mb-1.5 text-center text-[10px] font-semibold tracking-[0.18em] text-[#8ba1bd] uppercase sm:text-[11px]">
        High Scores
      </div>

      {entries.length === 0 ? (
        <div
          data-testid="leaderboard-empty"
          className="rounded border border-[#8b5cf6]/20 bg-[#070914]/70 py-2 text-center text-[11px] font-medium tracking-[0.14em] text-[#6d829f] uppercase"
        >
          No records yet
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.map((entry, idx) => {
            const isHighlighted = highlightIndex === idx;
            const isFirst = idx === 0;
            return (
              <li
                key={`${idx}-${entry.initials}-${entry.score}`}
                data-testid="leaderboard-row"
                className={`flex items-center justify-between rounded border px-3 py-1 text-xs sm:text-sm ${
                  isHighlighted
                    ? 'border-[#00f5ff]/75 bg-[#08222d]/90 shadow-[0_0_14px_rgba(0,245,255,0.2)]'
                    : 'border-[#8b5cf6]/20 bg-[#070914]/75'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono-num w-5 text-left text-[11px] font-bold ${
                      isHighlighted || isFirst ? 'text-[#00f5ff]' : 'text-[#8b5cf6]'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    data-testid="leaderboard-initials"
                    className={`font-mono-num font-bold tracking-[0.2em] ${
                      isHighlighted ? 'text-[#ffffff]' : 'text-[#e8fbff]'
                    }`}
                  >
                    {entry.initials}
                  </span>
                </div>
                <span
                  data-testid="leaderboard-score"
                  className={`font-mono-num font-bold ${
                    isHighlighted
                      ? 'text-[#00f5ff]'
                      : isFirst
                        ? 'text-[#67f9ff]'
                        : 'text-[#cde4f5]'
                  }`}
                  style={
                    isHighlighted || isFirst
                      ? { textShadow: '0 0 10px rgba(0, 245, 255, 0.45)' }
                      : undefined
                  }
                >
                  {entry.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
