/** Exact browse routes only; personal and management routes stay protected. */
export const GUEST_BROWSE_PATHS = ["/dashboard", "/dashboard/games", "/dashboard/tournaments", "/dashboard/academies", "/playgrounds"] as const;
export function isGuestBrowsePath(path: string) { return (GUEST_BROWSE_PATHS as readonly string[]).includes(path); }

/**
 * Landing navigation targets.
 *
 * The landing page is only shown to anonymous visitors (signed-in users are
 * redirected to /dashboard), so every discovery link points at the public,
 * crawlable SEO page rather than an indexable-but-duplicate app route. This
 * keeps crawl equity on /games, /sports/<sport>, /courts and /academies and
 * avoids linking Googlebot into /dashboard duplicates or the /playgrounds
 * login redirect.
 */
const LANDING_SPORTS = new Set([
  "volleyball", "beach-volleyball", "basketball", "padel", "tennis", "archery",
]);

export function landingBrowsePath(href: string): string {
  // Absolute external links and auth/redirect helpers pass through untouched.
  if (href === "/" || /^\/(login|signup)(\?|\/|$)/.test(href)) return href;
  const url = new URL(href, "https://playza.invalid");
  const ar = url.pathname.startsWith("/ar/") ? "/ar" : "";
  const sportParam = url.searchParams.get("sport") ?? [...LANDING_SPORTS].find(s => href.includes(s));
  const sport = sportParam && LANDING_SPORTS.has(sportParam) ? sportParam : undefined;

  // Owner-facing academy workspace keeps its own public landing page.
  if (href.includes("academy-management")) return `${ar}/academy-management`;
  if (href.includes("academ")) return "/academies";
  if (href.includes("tournament")) return "/tournaments";
  if (href.includes("court") || href.includes("playground")) {
    return sport ? `${ar}/courts?sport=${sport}` : `${ar}/courts`;
  }
  if (url.pathname.startsWith("/sports")) return sport ? `${ar}/sports/${sport}` : `${ar}/sports`;
  // Bare sport filters from the dashboard nav point at the sport discovery
  // pages so those SEO pages collect internal links.
  if (sport && !url.pathname.startsWith("/games")) return `${ar}/sports/${sport}`;

  // Game listings (including /games?focus= and /dashboard?sport=) resolve to
  // the public games page, carrying the sport filter when we know it.
  const query = new URLSearchParams();
  if (sport) query.set("sport", sport);
  const focus = url.pathname.match(/^\/games\/([^/]+)$/)?.[1] ?? url.searchParams.get("focus");
  if (focus) query.set("focus", focus);
  return `${ar}/games${query.size ? `?${query}` : ""}`;
}
