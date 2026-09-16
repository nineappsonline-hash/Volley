import type { CSSProperties } from "react";
import { createAvatar } from "@dicebear/core";
import {
  adventurer,
  bottts,
  lorelei,
  micah,
  notionists,
  openPeeps,
} from "@dicebear/collection";

// Illustrated avatars. profiles.avatar_id stores a compact config string
// rather than a rendered image:
//
//   <style>:<seed>:<bg>
//
// • style — one of AVATAR_STYLE_KEYS (DiceBear illustration, self-hosted).
// • seed  — 8 lowercase hex chars; the avatar's face/outfit are derived from
//   it, so each seed renders a unique, stable portrait.
// • bg    — 6-digit hex (no '#') background color.
//
// The SQL helper public.random_avatar_id() mints these strings on row
// creation; this module renders them to SVG. Keep the style keys, seed length
// and the background palette in sync with the SQL array.

export const AVATAR_STYLE_KEYS = [
  "adventurer",
  "lorelei",
  "openPeeps",
  "micah",
  "bottts",
  "notionists",
] as const;

export type AvatarStyleKey = (typeof AVATAR_STYLE_KEYS)[number];

export const AVATAR_BG_COLORS = [
  "b6e3f4", // light blue
  "c0aede", // lavender
  "d1d4f9", // periwinkle
  "ffd5dc", // pink
  "ffdbb8", // peach
  "b9e4c9", // mint
  "c9e4ff", // sky
  "ffd8be", // apricot
] as const;

export type AvatarBgColor = (typeof AVATAR_BG_COLORS)[number];

export interface IllustratedAvatar {
  style: AvatarStyleKey;
  seed: string;
  backgroundColor: AvatarBgColor;
}

const ILLUSTRATED_RE = /^([a-z]+):([a-f0-9]{8}):([0-9a-f]{6})$/;

// Resolve a stored avatar_id to its parts (null for legacy emoji rows, custom
// values, or garbage).
export function parseAvatarId(
  avatarId: string | null | undefined
): IllustratedAvatar | null {
  if (!avatarId) return null;
  const match = ILLUSTRATED_RE.exec(avatarId);
  if (!match) return null;
  const style = match[1] as AvatarStyleKey;
  if (!AVATAR_STYLE_KEYS.includes(style)) return null;
  const backgroundColor = match[3] as AvatarBgColor;
  if (!AVATAR_BG_COLORS.includes(backgroundColor)) return null;
  return { style, seed: match[2], backgroundColor };
}

export function isIllustratedAvatar(
  avatarId: string | null | undefined
): avatarId is string {
  return !!parseAvatarId(avatarId);
}

export function avatarIdOf(parts: IllustratedAvatar): string {
  return `${parts.style}:${parts.seed}:${parts.backgroundColor}`;
}

export function randomAvatar(): IllustratedAvatar {
  const style = AVATAR_STYLE_KEYS[Math.floor(Math.random() * AVATAR_STYLE_KEYS.length)];
  const backgroundColor =
    AVATAR_BG_COLORS[Math.floor(Math.random() * AVATAR_BG_COLORS.length)];
  const seed = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return { style, seed, backgroundColor };
}

export function randomAvatarId(): string {
  return avatarIdOf(randomAvatar());
}

// DiceBear style factories, keyed by the config slug. Imported individually
// so only these styles ship in the bundle.
const AVATAR_STYLE_FACTORIES: Record<
  AvatarStyleKey,
  Parameters<typeof createAvatar>[0]
> = { adventurer, lorelei, openPeeps, micah, bottts, notionists };

// Render the illustrated portrait for a stored avatar_id as an SVG string,
// or null when the id isn't an illustrated config (legacy emoji or initials
// fall through to the caller's fallback rendering).
export function avatarSVG(
  avatarId: string | null | undefined,
  size = 256
): string | null {
  const parts = parseAvatarId(avatarId);
  if (!parts) return null;
  const factory = AVATAR_STYLE_FACTORIES[parts.style];
  return createAvatar(factory, {
    seed: parts.seed,
    backgroundColor: [parts.backgroundColor],
    size,
  }).toString();
}

// ── Legacy emoji presets (pre-illustration rows) ──────────────
// The old avatar_id values were emoji characters; keep rendering them until
// the illustrated migration backfills those rows. Order matches the original
// SQL array.
export const AVATAR_PRESETS = [
  "🦁",
  "🐯",
  "🐼",
  "🐸",
  "🦊",
  "🐻",
  "🐨",
  "🐶",
  "🐱",
  "🐰",
  "🦄",
  "🐙",
  "🦋",
  "🐢",
  "🦖",
  "🦅",
  "🐺",
  "🦉",
  "🐵",
  "🐷",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export function isAvatarPreset(
  value: string | null | undefined
): value is AvatarPreset {
  return !!value && (AVATAR_PRESETS as readonly string[]).includes(value);
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #fbbf24 0%, #ea580c 100%)",
  "linear-gradient(135deg, #f472b6 0%, #be185d 100%)",
  "linear-gradient(135deg, #34d399 0%, #047857 100%)",
  "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
  "linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)",
  "linear-gradient(135deg, #fb7185 0%, #b91c1c 100%)",
  "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)",
  "linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)",
  "linear-gradient(135deg, #a3e635 0%, #4d7c0f 100%)",
  "linear-gradient(135deg, #fdba74 0%, #c2410c 100%)",
  "linear-gradient(135deg, #22d3ee 0%, #0e7490 100%)",
] as const;

export function avatarStyles(
  avatarId: string | null | undefined
): CSSProperties | undefined {
  if (!isAvatarPreset(avatarId)) return undefined;
  const index = (avatarId.codePointAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  return {
    background: AVATAR_GRADIENTS[index],
    fontSize: "clamp(11px, 56cqw, 46px)",
    lineHeight: 1,
  };
}