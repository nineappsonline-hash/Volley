import type { Difficulty } from "./types";

/**
 * Central tuning for Playza Beach Challenge.
 *
 * All values are logical world units. The world is a fixed 1280x720 space that
 * is scaled to fit the viewport, so physics never change with device resolution.
 * Bump RULES_VERSION whenever physics, scoring or rules change; leaderboard
 * buckets depend on it (see the product spec).
 */
export const RULES_VERSION = 3;

export const WORLD = {
  width: 1280,
  height: 720,
  groundY: 610,
  minX: 80,
  maxX: 1200,
  netX: 640,
  netHalf: 6,
  netTop: 345,
  ballRadius: 16,
  humanStartX: 300,
  aiStartX: 980,
} as const;

export const PLAYER = {
  halfWidth: 29,
  height: 104,
  /** Hand line is offset toward the net by this many units. */
  reachOffset: 24,
  reachLow: 30,
  reachHigh: 138,
} as const;

// Scale launch velocities and gravity together to preserve the familiar arcs.
export const BALL_PACE = 0.85;

export const PHYSICS = {
  gravity: 1500,
  ballGravity: 1500 * BALL_PACE * BALL_PACE,
  playerMaxSpeed: 360,
  playerAccel: 2200,
  playerDecel: 2600,
  airControl: 0.85,
  jumpVelocity: -680,
  jumpBufferTime: 0.1,
  coyoteTime: 0.08,
  hitCooldown: 0.22,
  hitBufferTime: 0.13,
  contactCooldown: 0.18,
  ballMaxSpeed: 1000 * BALL_PACE,
  ballRestitution: 0.55,
  netRestitution: 0.6,
  groundFriction: 0.86,
} as const;

export const HIT = {
  radius: 74,
  perfectRadius: 30,
} as const;

export const TIMING = {
  countdown: 3,
  activeMatch: 90,
  extraTime: 10,
  pointFreeze: 1,
  humanServeDelay: 2,
  aiServeDelay: 0.8,
  tutorialRespawn: 1,
} as const;

export const MAX_TOUCHES = 3;

export const DIFFICULTIES: Record<
  Difficulty,
  {
    reaction: number;
    error: number;
    missChance: number;
    /** Extra delay before the AI commits to a hit, in seconds. */
    hitDelay: number;
    /** Chance the AI goes for a tip instead of a full set. */
    tipChance: number;
    label: { en: string; ar: string };
  }
> = {
  easy: {
    reaction: 0.3,
    error: 80,
    missChance: 0.22,
    hitDelay: 0.18,
    tipChance: 0.05,
    label: { en: "Easy", ar: "سهل" },
  },
  medium: {
    reaction: 0.18,
    error: 45,
    missChance: 0.08,
    hitDelay: 0.08,
    tipChance: 0.12,
    label: { en: "Medium", ar: "متوسط" },
  },
  hard: {
    reaction: 0.1,
    error: 20,
    missChance: 0.02,
    hitDelay: 0.02,
    tipChance: 0.18,
    label: { en: "Hard", ar: "صعب" },
  },
};

/** Stable bucket id used for local best-score separation. */
export function bucketId(difficulty: Difficulty, rulesVersion = RULES_VERSION): string {
  return `beach-volleyball:${difficulty}:v${rulesVersion}`;
}

export function sideBounds(side: "human" | "ai") {
  if (side === "human") {
    return {
      min: WORLD.minX + PLAYER.halfWidth,
      max: WORLD.netX - WORLD.netHalf - PLAYER.halfWidth - 12,
    };
  }
  return {
    min: WORLD.netX + WORLD.netHalf + PLAYER.halfWidth + 12,
    max: WORLD.maxX - PLAYER.halfWidth,
  };
}

export function sideBaseDir(side: "human" | "ai"): 1 | -1 {
  return side === "human" ? 1 : -1;
}
