import { directionsFromMapsLink, trustedMapsLink } from "@/lib/google-directions";

/** Resolve shared short map links without a paid Google API or location-name guessing. */
export async function GET(request: Request) {
  const original = trustedMapsLink(new URL(request.url).searchParams.get("location"));
  if (!original) return new Response("Invalid Google Maps link", { status: 400 });
  let current = original;
  const signal = AbortSignal.timeout(5000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const directions = directionsFromMapsLink(current);
      if (directions) return Response.redirect(directions, 302);
      // Validate every redirect before fetching; never fetch arbitrary user-supplied hosts.
      const response = await fetch(current.href, { redirect: "manual", signal, cache: "no-store" });
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next || response.status < 300 || response.status >= 400) break;
      const trusted = trustedMapsLink(new URL(next, current).href);
      if (!trusted) break;
      current = trusted;
    }
  } catch { /* Google can still open its original share link when resolution fails. */ }
  return Response.redirect(original.href, 302);
}
