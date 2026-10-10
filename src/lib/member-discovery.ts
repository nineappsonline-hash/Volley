import { sportToSlug } from "@/lib/sport-slugs";

export type DiscoveryPreferences = {
  interested_sports?: string[] | null;
  availability_days?: number[];
  skill_level?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type Candidate = {
  sport?: string | null;
  date?: string | null;
  skill_level?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** Rank recommendations using only preferences the member actually saved. */
export function discoveryMatch(item: Candidate, preferences: DiscoveryPreferences) {
  const reasons: Array<"sport" | "day" | "skill" | "nearby"> = [];
  let score = 0;
  if (item.sport && preferences.interested_sports?.some(sport => sportToSlug(sport) === sportToSlug(item.sport!))) {
    score += 4;
    reasons.push("sport");
  }
  if (item.date && preferences.availability_days?.includes(new Date(`${item.date}T12:00:00`).getDay())) {
    score += 2;
    reasons.push("day");
  }
  if (item.skill_level && item.skill_level === preferences.skill_level) {
    score += 2;
    reasons.push("skill");
  }
  if ([item.lat, item.lng, preferences.lat, preferences.lng].every(value => value != null && Number.isFinite(value))) {
    const rad = Math.PI / 180;
    const dLat = (item.lat! - preferences.lat!) * rad;
    const dLng = (item.lng! - preferences.lng!) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(item.lat! * rad) * Math.cos(preferences.lat! * rad) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    if (km <= 20) {
      score += 2;
      reasons.push("nearby");
    }
  }
  return { score, reasons };
}
