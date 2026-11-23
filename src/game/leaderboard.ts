import { LEADERBOARD_STORAGE_KEY, MAX_LEADERBOARD_ENTRIES } from './constants';

export interface LeaderboardEntry {
  initials: string;
  score: number;
}

export function sanitizeInitials(raw: string): string {
  const letters = raw.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
  return letters.length > 0 ? letters : 'AAA';
}

export function normalizeLeaderboard(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .filter(
      (entry) =>
        entry &&
        typeof entry.initials === 'string' &&
        typeof entry.score === 'number' &&
        Number.isFinite(entry.score) &&
        entry.score > 0
    )
    .map((entry) => ({
      initials: sanitizeInitials(entry.initials),
      score: Math.floor(entry.score),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function qualifiesForLeaderboard(
  score: number,
  entries: readonly LeaderboardEntry[]
): boolean {
  const cleanScore = Math.floor(score);
  if (!Number.isFinite(cleanScore) || cleanScore <= 0) return false;
  const sorted = normalizeLeaderboard(entries);
  if (sorted.length < MAX_LEADERBOARD_ENTRIES) return true;
  return cleanScore > sorted[sorted.length - 1].score;
}

export function insertLeaderboardEntry(
  entries: readonly LeaderboardEntry[],
  initials: string,
  score: number
): { entries: LeaderboardEntry[]; insertedIndex: number | null } {
  const cleanScore = Math.floor(score);
  if (!qualifiesForLeaderboard(cleanScore, entries)) {
    return { entries: normalizeLeaderboard(entries), insertedIndex: null };
  }

  const newEntry: LeaderboardEntry = {
    initials: sanitizeInitials(initials),
    score: cleanScore,
  };

  const base = normalizeLeaderboard(entries);
  const combined = [...base, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);

  const insertedIndex = combined.indexOf(newEntry);
  return {
    entries: combined,
    insertedIndex: insertedIndex >= 0 ? insertedIndex : null,
  };
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeLeaderboard(parsed as LeaderboardEntry[]);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: readonly LeaderboardEntry[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = normalizeLeaderboard(entries);
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
