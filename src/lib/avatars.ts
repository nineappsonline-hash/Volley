// Character avatar gallery. profiles.avatar_id stores a slot id — "char-01"
// up to "char-20" — which maps to a bundled original SVG mascot at
// /images/avatars/char-NN.svg (flat-vector, game-style, consistent design
// system). A random one is assigned on row creation by the SQL helper
// public.random_avatar_id(); this module resolves ids to asset paths and
// mints new random ones client-side for the picker.
//
// Keep AVATAR_COUNT (and the public/images/avatars files) in sync with the
// SQL array in random_avatar_id() (schema.sql + the avatar_gallery migration).

export const AVATAR_COUNT = 20;
export const AVATAR_PREFIX = "char";

export function avatarSrc(avatarId: string | null | undefined = ""): string | undefined {
  const slot = avatarSlot(avatarId);
  return slot ? `/images/avatars/${slot}.png` : undefined;
}

// Loose match for arbitrary id strings while keeping the type-predicate
// useful for guarded rendering (picker highlight, fallback logic).
export function isCharacterAvatar(
  value: string | null | undefined
): value is string {
  return !!avatarSlot(value);
}

export function avatarSlot(
  avatarId: string | null | undefined
): string | null {
  if (!avatarId) return null;
  const match = /^char-(\d{2})$/.exec(avatarId);
  if (!match) return null;
  const n = Number(match[1]);
  if (n < 1 || n > AVATAR_COUNT) return null;
  return avatarId;
}

export function randomAvatarId(): string {
  return `${AVATAR_PREFIX}-${String(1 + Math.floor(Math.random() * AVATAR_COUNT)).padStart(2, "0")}`;
}

// Stable list used by the picker grid.
export const AVATAR_GALLERY: readonly { id: string; src: string }[] =
  Array.from({ length: AVATAR_COUNT }, (_, i) => {
    const id = `${AVATAR_PREFIX}-${String(i + 1).padStart(2, "0")}`;
    return { id, src: `/images/avatars/${id}.png` };
  });