import type { Metadata } from "next";
import type { PublicGame, PublicGameDetail } from "@/lib/public-games";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";
import { gameSharePrice } from "@/lib/game-share";
import { cairoGameStart, gameIsJoinable, gameRobots, gameEventMarkupEligible, gameLifecycle } from "@/lib/seo-eligibility";
export { cairoGameStart, gameIsJoinable } from "@/lib/seo-eligibility";

export const publicGamePath = (id: string) => `/games/${encodeURIComponent(id)}`;
export const gamePlace = (game: PublicGame) => [game.playground?.name, game.playground?.area ?? game.area, game.playground?.governorate].filter(Boolean).join(", ") || game.location || game.area || "";

export function publicGameMetadata(game: PublicGameDetail, now = new Date()): Metadata {
  // Unique per game: the user-facing title carries the event, and the scheduled
  // date keeps same-day games distinguishable in search results.
  const archived = gameLifecycle(game, now) === "past";
  const cancelled = game.status === "cancelled";
  const title = `${game.title} — ${game.game_date}`;
  const description = archived
    ? `This ${game.sport} game in ${gamePlace(game)} took place on ${game.game_date}. Explore upcoming ${game.sport} games and join other players on Playza; this past game cannot be booked.`
    : cancelled
      ? `This ${game.sport} game in ${gamePlace(game)} was cancelled. Find other upcoming games on Playza.`
      : `${game.sport} on ${game.game_date} at ${game.start_time.slice(0, 5)} (Cairo time). ${gamePlace(game)}. ${gameSharePrice(game)}. Review the level and joining requirements on Playza.`;
  const url = `${SITE_URL}${publicGamePath(game.id)}`;
  // Indexability comes from the centralized eligibility policy (seo-eligibility.ts):
  // indexable while joining is possible, noindex,follow afterwards.
  return { title: { absolute: `${title} | Playza` }, description, alternates: { canonical: url }, robots: gameRobots(game, now), openGraph: { title, description, url, type: "website", images: [game.playground?.cover_url || OG_IMAGE] }, twitter: { card: "summary_large_image", title, description, images: [game.playground?.cover_url || OG_IMAGE] } };
}

/** Only real event details; omit incomplete location/price rather than inventing them. */
export function publicGameEvent(game: PublicGameDetail, now = new Date()): Record<string, unknown> | null {
  // Expired pages must not present an unfulfillable registration as an upcoming
  // event; cancelled future games stay eligible with EventCancelled status.
  if (!gameEventMarkupEligible(game, now)) return null;
  const venue = game.playground;
  if (!venue?.name || !(venue.address || venue.area || venue.governorate)) return null;
  const start = cairoGameStart(game.game_date, game.start_time);
  const url = `${SITE_URL}${publicGamePath(game.id)}`;
  const price = game.host_pays ? 0 : game.share_price;
  return {
    "@context": "https://schema.org", "@type": "SportsEvent", "@id": `${url}#event`, url,
    name: game.title, sport: game.sport,
    description: game.description || `${game.sport} at ${gamePlace(game)}. ${gameSharePrice(game)}.`,
    startDate: start.toISOString(),
    ...(game.duration_hours > 0 ? { endDate: new Date(start.getTime() + game.duration_hours * 3600000).toISOString() } : {}),
    eventStatus: game.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: venue.name, address: { "@type": "PostalAddress", streetAddress: venue.address || undefined, addressLocality: venue.area || game.area || undefined, addressRegion: venue.governorate || undefined, addressCountry: venue.country || undefined } },
    ...(venue.cover_url ? { image: [venue.cover_url] } : {}),
    ...(game.creator_name ? { organizer: { "@type": "Person", name: game.creator_name } } : {}),
    ...(price != null && price >= 0 ? { isAccessibleForFree: price === 0, offers: { "@type": "Offer", url, price, priceCurrency: "EGP", availability: game.status === "cancelled" || !gameIsJoinable(game) ? "https://schema.org/Discontinued" : game.status === "full" || game.joined >= game.max_players ? "https://schema.org/SoldOut" : "https://schema.org/InStock" } } : {}),
  };
}
