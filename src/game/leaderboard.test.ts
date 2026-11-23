import assert from 'node:assert/strict';
import test from 'node:test';
import {
  insertLeaderboardEntry,
  normalizeLeaderboard,
  qualifiesForLeaderboard,
  sanitizeInitials,
  type LeaderboardEntry,
} from './leaderboard';

test('sanitizeInitials uppercases letters, strips invalid chars, and defaults empty input to AAA', () => {
  assert.equal(sanitizeInitials(''), 'AAA');
  assert.equal(sanitizeInitials('   '), 'AAA');
  assert.equal(sanitizeInitials('123!'), 'AAA');
  assert.equal(sanitizeInitials('max'), 'MAX');
  assert.equal(sanitizeInitials('z9a1b'), 'ZAB');
  assert.equal(sanitizeInitials('abcdef'), 'ABC');
});

test('qualifiesForLeaderboard checks top-5 threshold and positive scores', () => {
  assert.equal(qualifiesForLeaderboard(0, []), false);
  assert.equal(qualifiesForLeaderboard(10, []), true);

  const partial: LeaderboardEntry[] = [
    { initials: 'ACE', score: 1500 },
    { initials: 'NEO', score: 900 },
  ];
  assert.equal(qualifiesForLeaderboard(50, partial), true);

  const full: LeaderboardEntry[] = [
    { initials: 'ACE', score: 5000 },
    { initials: 'NEO', score: 4000 },
    { initials: 'CYB', score: 3000 },
    { initials: 'VEX', score: 2000 },
    { initials: 'ZED', score: 1000 },
  ];
  assert.equal(qualifiesForLeaderboard(999, full), false);
  assert.equal(qualifiesForLeaderboard(1000, full), false);
  assert.equal(qualifiesForLeaderboard(1001, full), true);
});

test('insertLeaderboardEntry sorts highest first, caps at top 5, and tracks inserted rank', () => {
  const initial: LeaderboardEntry[] = [
    { initials: 'ACE', score: 5000 },
    { initials: 'NEO', score: 4000 },
    { initials: 'CYB', score: 3000 },
    { initials: 'VEX', score: 2000 },
    { initials: 'ZED', score: 1000 },
  ];

  const { entries, insertedIndex } = insertLeaderboardEntry(initial, 'max', 3500);
  assert.equal(entries.length, 5);
  assert.equal(insertedIndex, 2);
  assert.deepEqual(entries, [
    { initials: 'ACE', score: 5000 },
    { initials: 'NEO', score: 4000 },
    { initials: 'MAX', score: 3500 },
    { initials: 'CYB', score: 3000 },
    { initials: 'VEX', score: 2000 },
  ]);

  // Empty initials default to AAA
  const { entries: withDefault, insertedIndex: idx2 } = insertLeaderboardEntry(entries, '', 9000);
  assert.equal(idx2, 0);
  assert.equal(withDefault[0].initials, 'AAA');
  assert.equal(withDefault[0].score, 9000);

  // Normalize drops invalid/zero entries and sorts descending
  const normalized = normalizeLeaderboard([
    { initials: 'low', score: 100 },
    { initials: 'bad', score: 0 },
    { initials: 'top', score: 8800 },
  ]);
  assert.deepEqual(normalized, [
    { initials: 'TOP', score: 8800 },
    { initials: 'LOW', score: 100 },
  ]);
});
