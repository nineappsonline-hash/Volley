import type { FriendlyGameWithDetails } from "./types";

const sportNames: Record<string, string> = {
  tennis: "تنس", padel: "بادل", basketball: "كرة سلة كرة السلة",
  volleyball: "كرة طائرة كرة الطائرة", "beach volleyball": "طائرة شاطئية beach volley",
  archery: "رماية بالقوس",
};

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[-–—,،]/g, " ").replace(/\s+/g, " ").trim();
}

/** Every search word must occur somewhere in the game's sport or location details. */
export function matchesGameSearch(game: FriendlyGameWithDetails, search: string): boolean {
  const terms = normalize(search).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const venue = game.playground;
  const text = normalize([
    game.title, game.sport, sportNames[game.sport?.trim().toLowerCase()],
    game.location, game.area, venue?.name, venue?.area, venue?.governorate, venue?.address,
  ].filter(Boolean).join(" "));
  return terms.every(term => text.includes(term));
}
