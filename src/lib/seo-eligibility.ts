import type { PublicGame } from "@/lib/public-games";

/**
 * Centralized SEO eligibility policy for dynamic public pages.
 *
 * One module answers "should this URL be indexed?" for every dynamic route, so
 * metadata, structured data and sitemap generation never drift apart.
 *
 * Rationale for the game policy (no arbitrary count thresholds):
 * - A game page is genuinely useful while joining it is still possible. That
 *   window is what gameIsJoinable models (status open/full, scheduled start in
 *   the future). A single upcoming game justifies an indexable page; the gate
 *   is usefulness, not volume.
 * - Completed, cancelled or past games keep their page accessible (no blanket
 *   redirects to /games) — the event record, venue and player count are real
 *   information — but they must not advertise a registration they cannot take
 *   or appear as upcoming events in structured data, so we serve
 *   noindex,follow until the page loses even navigational value.
 * - Removed/private/invalid games already return 404 via getPublicGame().
 * - Directories and filter combinations stay out of this policy: filters are
 *   discovered through the canonical /games, /academies and /sports routes.
 */

export type GameLifecycle = "upcoming-open" | "upcoming-full" | "upcoming-cancelled" | "past";

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

export function gameLifecycle(
  game: Pick<PublicGame, "status" | "game_date" | "start_time">,
  now = new Date(),
): GameLifecycle {
  if (game.status === "completed" || cairoGameStart(game.game_date, game.start_time) <= now) return "past";
  if (game.status === "cancelled") return "upcoming-cancelled";
  return game.status === "full" ? "upcoming-full" : "upcoming-open";
}

/** Indexable only while joining is possible; everything else stays accessible but noindex. */
export function gameRobots(
  game: Pick<PublicGame, "status" | "game_date" | "start_time">,
  now = new Date(),
): { index: boolean; follow: boolean } {
  return gameIsJoinable(game, now) ? { index: true, follow: true } : { index: false, follow: true };
}

/**
 * Structured-data gate: expired pages must not present themselves as upcoming
 * events. Cancelled future games stay eligible with EventCancelled status.
 */
export function gameEventMarkupEligible(game: PublicGame, now = new Date()): boolean {
  return gameIsJoinable(game, now) || game.status === "cancelled";
}
