import type { CSSProperties } from "react";

// Preset avatars: the preset id IS the emoji character itself (profiles
// avatar_id), so rows render it directly without a lookup. Keep this list in
// sync with the SQL array in public.random_avatar_id() (schema.sql + the
// avatar_presets migration).
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

export function randomAvatarId(): AvatarPreset {
  return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
}

// Warm, readable gradients keyed by emoji codepoint so a given preset always
// keeps the same background.
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
    color: "#fff",
    // Sized by the avatar's inline-size (container query unit) so presets
    // fill any avatar size; clamp keeps it sane on very small chips.
    fontSize: "clamp(11px, 56cqw, 46px)",
    lineHeight: 1,
  };
}