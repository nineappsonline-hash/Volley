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
 * - Completed/past public games remain indexable as genuinely useful history
 *   and navigation to fresh games, with clear expiry labels and no misleading
 *   upcoming-event structured data.
 * - Cancelled games stay accessible but noindex,follow.
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

/**
 * An archived, public game remains useful as an honest record and as a gateway
 * to upcoming games in the same sport. Do not remove it from indexing just
 * because the game date passed. Cancelled games remain non-indexable.
 * Pages must clearly state the event is over and link to live alternatives.
 */
export function gameRobots(
  game: Pick<PublicGame, "status" | "game_date" | "start_time">,
  _now = new Date(),
): { index: boolean; follow: boolean } {
  return { index: game.status !== "cancelled", follow: true };
}

/**
 * Archived games are navigation/history pages, not upcoming events.
 * Cancelled events keep their cancellation markup while they are in the future.
 */
export function gameEventMarkupEligible(game: PublicGame, now = new Date()): boolean {
  return gameIsJoinable(game, now) || game.status === "cancelled";
}
