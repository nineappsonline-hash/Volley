/** Current public offering. Historical sport names remain valid for stored records. */
export const ACTIVE_SPORTS = ["Tennis", "Padel", "Basketball", "Volleyball", "Beach Volleyball"] as const;
export function isActiveSport(name?: string | null): boolean {
  return ACTIVE_SPORTS.some(sport => sport.toLowerCase() === name?.trim().toLowerCase());
}
