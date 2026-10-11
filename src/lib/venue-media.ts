/**
 * Playground photo helpers shared by the member game cards and the super
 * admin editor.
 */

/** The thumbnail shown on a playground's card: the explicitly chosen cover,
 * falling back to the first gallery photo. Returns null when there are no
 * photos at all. */
export function venueCardPhoto(
  photos: string[] | null | undefined,
  coverUrl: string | null | undefined,
): string | null {
  if (coverUrl) return coverUrl;
  return photos?.length ? photos[0] : null;
}
/** Resolve older games saved with a location name, without guessing between venues. */
export function gamePlaygroundPhoto(game: {
  playground_id?: string | null;
  location?: string | null;
  area?: string | null;
  playground?: { name?: string | null; photos?: string[] | null; cover_url?: string | null } | null;
}, venues: { id: string; name: string; area?: string | null; photos?: string[] | null; cover_url?: string | null }[]) {
  const linked = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  if (linked) return linked;
  const normalize = (value?: string | null) => value?.trim().toLocaleLowerCase() ?? "";
  const name = normalize(game.playground?.name || game.location?.split(/[·|]/)[0]);
  const matches = game.playground_id
    ? venues.filter(v => v.id === game.playground_id)
    : venues.filter(v => name && normalize(v.name) === name && (!game.area || normalize(v.area) === normalize(game.area)));
  return matches.length === 1 ? venueCardPhoto(matches[0].photos, matches[0].cover_url) : null;
}
