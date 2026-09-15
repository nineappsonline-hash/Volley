interface GameLocation {
  area?: string | null;
  playground?: { area?: string | null; governorate?: string | null } | null;
}

/** Use the same location fields for the dropdown and for matching games. */
export function gameLocations(game: GameLocation): string[] {
  return [game.playground?.area, game.playground?.governorate, game.area]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
}

export function matchesGameLocation(game: GameLocation, filter: string): boolean {
  if (filter === "all") return true;
  const query = filter.trim().toLocaleLowerCase();
  if (!query) return true;
  return gameLocations(game).some((value) => {
    const place = value.toLocaleLowerCase();
    return place === query || place.includes(query) || query.includes(place);
  });
}
