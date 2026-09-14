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