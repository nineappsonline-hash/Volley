/** Map between URL slugs and display names for community sports. */
export const SPORT_SLUGS: Record<string, string> = {
  football: "Football",
  volleyball: "Volleyball",
  "beach-volleyball": "Beach Volleyball",
  basketball: "Basketball",
  handball: "Handball",
  tennis: "Tennis",
  swimming: "Swimming",
  padel: "Padel",
  squash: "Squash",
  "table-tennis": "Table Tennis",
  badminton: "Badminton",
  gymnastics: "Gymnastics",
  karate: "Karate",
  boxing: "Boxing",
  athletics: "Athletics",
  "kung-fu": "Kung Fu",
  taekwondo: "Taekwondo",
  crossfit: "CrossFit",
  judo: "Judo",
  "kickboxing": "Kickboxing",
  wrestling: "Wrestling",
  archery: "Archery",
  fencing: "Fencing",
  equestrian: "Equestrian",
  cycling: "Cycling",
  weightlifting: "Weightlifting",
  parkour: "Parkour",
};

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_SLUGS).map(([slug, name]) => [name.toLowerCase(), slug])
);

/** sport name → URL slug ("Table Tennis" → "table-tennis"). */
export function sportToSlug(name: string): string {
  return REVERSE[name.toLowerCase()] ?? name.toLowerCase().replace(/\s+/g, "-");
}

/** URL slug → canonical display name, or undefined if unknown. */
export function slugToSport(slug: string): string | undefined {
  return SPORT_SLUGS[slug];
}
