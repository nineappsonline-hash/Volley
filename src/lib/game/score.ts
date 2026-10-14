import type { GameStats } from "./types";

export interface ScoreInput {
  playerPoints: number;
  opponentPoints: number;
  perfectHits: number;
  longestWinningStreak: number;
}

/**
 * Challenge score — a stable, explicitly versioned formula.
 *   score = 100 * playerPoints + 20 * perfectHits
 *         + 30 * longestWinningStreak + (won ? 150 : 0)
 * Never change this inside the same leaderboard; bump RULES_VERSION instead.
 */
export function calculateScore(input: ScoreInput): GameStats {
  const won = input.playerPoints > input.opponentPoints;
  const draw = input.playerPoints === input.opponentPoints;
  const score =
    100 * input.playerPoints +
    20 * input.perfectHits +
    30 * input.longestWinningStreak +
    (won ? 150 : 0);
  return {
    playerPoints: input.playerPoints,
    opponentPoints: input.opponentPoints,
    perfectHits: input.perfectHits,
    longestWinningStreak: input.longestWinningStreak,
    score,
    won,
    draw,
  };
}

/** Tie-break for leaderboards (phase B): score desc, points desc, time asc. */
export function compareScores(
  a: { score: number; playerPoints: number; achievedAt: number },
  b: { score: number; playerPoints: number; achievedAt: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.playerPoints !== a.playerPoints) return b.playerPoints - a.playerPoints;
  return a.achievedAt - b.achievedAt;
}

export interface StoredBest {
  score: number;
  playerPoints: number;
  opponentPoints: number;
  perfectHits: number;
  longestWinningStreak: number;
  achievedAt: number;
}

export function betterBest(
  existing: StoredBest | undefined,
  candidate: StoredBest,
): StoredBest {
  if (!existing) return candidate;
  return compareScores(candidate, existing) < 0 ? candidate : existing;
}
