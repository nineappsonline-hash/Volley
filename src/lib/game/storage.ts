import { bucketId } from "./config";
import { betterBest, type StoredBest } from "./score";
import type { Difficulty } from "./types";

/**
 * Local-only persistence. Phase A stores the personal best score, the sound
 * preference and whether practice was completed. Storage failures (private
 * mode, quota, disabled) are swallowed so the game keeps working.
 */

const KEY_BEST = "playza.beachVolleyball.best";
const KEY_PREFS = "playza.beachVolleyball.prefs";
const KEY_TUTORIAL = "playza.beachVolleyball.tutorial";

interface Preferences {
  muted?: boolean;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getBest(difficulty: Difficulty): StoredBest | null {
  if (typeof window === "undefined") return null;
  const all = readJson<Record<string, StoredBest>>(KEY_BEST) ?? {};
  return all[bucketId(difficulty)] ?? null;
}

export function saveBest(difficulty: Difficulty, candidate: StoredBest): boolean {
  if (typeof window === "undefined") return false;
  const all = readJson<Record<string, StoredBest>>(KEY_BEST) ?? {};
  const key = bucketId(difficulty);
  const existing = all[key];
  const next = betterBest(existing, candidate);
  if (existing && next === existing) return false;
  all[key] = next;
  writeJson(KEY_BEST, all);
  return true;
}

export function getMuted(): boolean {
  if (typeof window === "undefined") return true;
  return readJson<Preferences>(KEY_PREFS)?.muted ?? true;
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  writeJson(KEY_PREFS, { muted });
}

export function isTutorialDone(): boolean {
  if (typeof window === "undefined") return false;
  return readJson<{ done?: boolean }>(KEY_TUTORIAL)?.done === true;
}

export function setTutorialDone(done: boolean): void {
  if (typeof window === "undefined") return;
  writeJson(KEY_TUTORIAL, { done });
}
