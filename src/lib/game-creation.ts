import { ACTIVE_SPORTS } from "./active-sports";
import { slugToSport, sportToSlug } from "./sport-slugs";

/** Accept tab display names and URL slugs, without enabling unsupported sports. */
export function gameCreationSport(value?: string | null): string | undefined {
  const name = slugToSport(value ?? "") ?? value;
  return ACTIVE_SPORTS.find(sport => sport.toLowerCase() === name?.toLowerCase());
}
export function dashboardCreateGamePath(sport?: string): string {
  const query = new URLSearchParams({ create: "1" });
  const selected = gameCreationSport(sport);
  if (selected) query.set("sport", sportToSlug(selected));
  return `/dashboard?${query}`;
}
