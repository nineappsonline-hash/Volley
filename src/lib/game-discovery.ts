import type { Metadata } from "next";
import type { PublicGame, PublicGameDetail } from "@/lib/public-games";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";
import { gameSharePrice } from "@/lib/game-share";

export const publicGamePath = (id: string) => `/games/${encodeURIComponent(id)}`;
export const gamePlace = (game: PublicGame) => [game.playground?.name, game.playground?.area ?? game.area, game.playground?.governorate].filter(Boolean).join(", ") || game.location || game.area || "";

/** Convert Egypt's wall-clock schedule using the offset on the event date (DST). */
export function cairoGameStart(date: string, time: string): Date {
  const wall = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time.slice(0, 8)}Z`);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    const rendered = Date.parse(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`);
    const next = wall - (rendered - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

export function gameIsJoinable(game: Pick<PublicGame, "status" | "game_date" | "start_time">, now = new Date()): boolean {
  return ["open", "full"].includes(game.status) && cairoGameStart(game.game_date, game.start_time) > now;
}

export function publicGameMetadata(game: PublicGameDetail): Metadata {
  const title = `${game.title} — ${game.sport}${gamePlace(game) ? ` in ${gamePlace(game)}` : ""}`;
  const description = `${game.sport} on ${game.game_date} at ${game.start_time.slice(0, 5)} (Cairo time). ${gamePlace(game)}. ${gameSharePrice(game)}. Review the level and joining requirements on Playza.`;
  const url = `${SITE_URL}${publicGamePath(game.id)}`;
  return { title: { absolute: `${title} | Playza` }, description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title, description, url, type: "website", images: [game.playground?.cover_url || OG_IMAGE] }, twitter: { card: "summary_large_image", title, description, images: [game.playground?.cover_url || OG_IMAGE] } };
}

/** Only real event details; omit incomplete location/price rather than inventing them. */
export function publicGameEvent(game: PublicGameDetail): Record<string, unknown> | null {
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
