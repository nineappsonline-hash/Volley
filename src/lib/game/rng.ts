/**
 * Deterministic seeded RNG (mulberry32). The mutable state is kept on the game
 * state so a replay can reproduce the exact same sequence from a seed.
 */

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Advance the RNG state and return a float in [0, 1). */
export function rand(holder: { rngState: number }): number {
  let a = (holder.rngState | 0) + 0x6d2b79f5;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  holder.rngState = a | 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random float in [min, max). */
export function randRange(holder: { rngState: number }, min: number, max: number): number {
  return min + rand(holder) * (max - min);
}
