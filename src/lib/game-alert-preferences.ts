import { slugToSport, sportToSlug } from "@/lib/sport-slugs";

export type GameAlertPreferences = { interested_sports: string[] | null; notify_game_alerts: boolean };

/** Reuse existing matching and notification delivery; never reset profile/privacy fields. */
export function updateGameAlertPreferences(current: GameAlertPreferences, sport: string, following: boolean): GameAlertPreferences {
  const canonical = slugToSport(sportToSlug(sport));
  if (!canonical) throw new Error("Unknown sport");
  const otherSports = (current.interested_sports ?? []).filter(s => s.trim().toLowerCase() !== canonical.toLowerCase());
  const sports = following ? [...otherSports, canonical] : otherSports;
  return { interested_sports: sports, notify_game_alerts: following ? true : sports.length > 0 && current.notify_game_alerts };
}
