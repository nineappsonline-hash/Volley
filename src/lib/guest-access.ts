/** Exact browse routes only; personal and management routes stay protected. */
export const GUEST_BROWSE_PATHS = ["/dashboard", "/dashboard/games", "/dashboard/tournaments", "/dashboard/academies", "/playgrounds"] as const;
export function isGuestBrowsePath(path: string) { return (GUEST_BROWSE_PATHS as readonly string[]).includes(path); }

/** Landing-page navigation enters the dashboard browsing experience. */
export function landingBrowsePath(href: string): string {
  if (href.startsWith("/dashboard")) return href;
  if (href === "/" || /^\/(login|signup)(\?|\/|$)/.test(href)) return href;
  if (href.includes("academies") || href.includes("academy-management")) return "/dashboard/academies";
  if (href.includes("court")) return "/playgrounds";
  if (href.includes("tournament")) return "/dashboard/tournaments";
  const url = new URL(href, "https://playza.invalid");
  const sport = url.searchParams.get("sport") ?? ["beach-volleyball", "volleyball", "tennis", "archery"].find(s => href.includes(s));
  const query = new URLSearchParams();
  if (sport) query.set("sport", sport);
  const focus = url.pathname.match(/^\/games\/([^/]+)$/)?.[1] ?? url.searchParams.get("focus");
  if (focus) query.set("focus", focus);
  return `/dashboard${query.size ? `?${query}` : ""}`;
}
