import type { Dict } from "@/lib/i18n/dictionary";

/**
 * Sports offered by academies, mapped to the dictionary keys used to label them
 * so the sport names render in the reader's language. Kept typed against the
 * dictionary so a renamed or deleted key is a compile error rather than a
 * silent untranslated label.
 */
export const SPORT_LABEL_KEYS: Record<string, keyof Dict> = {
  "Football": "sport_football",
  "Basketball": "sport_basketball",
  "Handball": "sport_handball",
  "Volleyball": "sport_volleyball",
  "Beach Volleyball": "sport_beach_volleyball",
  "Tennis": "sport_tennis",
  "Swimming": "sport_swimming",
  "Padel": "sport_padel",
  "Squash": "sport_squash",
  "Table Tennis": "sport_table_tennis",
  "Badminton": "sport_badminton",
  "Gymnastics": "sport_gymnastics",
  "Karate": "sport_karate",
  "Boxing": "sport_boxing",
  "Athletics": "sport_athletics",
  "Kung Fu": "sport_kungfu",
  "Taekwondo": "sport_taekwondo",
  "CrossFit": "sport_crossfit",
  "Judo": "sport_judo",
  "Kickboxing": "sport_kickboxing",
  "Wrestling": "sport_wrestling",
  "Archery": "sport_archery",
  "Fencing": "sport_fencing",
  "Equestrian": "sport_equestrian",
  "Cycling": "sport_cycling",
  "Weightlifting": "sport_weightlifting",
  "Parkour": "sport_parkour",
};

/** Localised name for a sport, falling back to whatever the database holds. */
export function sportLabel(name: string, t: (key: any) => string): string {
  const key = SPORT_LABEL_KEYS[name];
  return key ? t(key) : name;
}
