import { parseMapsCoordinates } from "./maps";

export function trustedMapsLink(value?: string | null): URL | null {
  try {
    const url = new URL(value ?? "");
    const host = url.hostname.toLowerCase();
    const short = host === "maps.app.goo.gl" || (host === "goo.gl" && url.pathname.startsWith("/maps/"));
    const google = ["google.com", "www.google.com", "maps.google.com", "www.google.com.eg", "google.com.eg"].includes(host) && (url.pathname.startsWith("/maps") || host === "maps.google.com");
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (short || google) ? url : null;
  } catch { return null; }
}

export function directionsFromMapsLink(url: URL): string | null {
  // The place pin is more precise than the @ coordinates, which describe the viewport.
  const marker = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const coordinates = marker ? { lat: Number(marker[1]), lng: Number(marker[2]) } : parseMapsCoordinates(url.href);
  const label = url.searchParams.get("destination") || url.searchParams.get("daddr") || url.searchParams.get("q") || url.searchParams.get("query");
  let place = "";
  try { place = decodeURIComponent(url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1] ?? "").replace(/\+/g, " "); } catch { /* Fall back to the saved URL. */ }
  const destination = coordinates ? `${coordinates.lat},${coordinates.lng}` : label || place;
  if (!destination) return null;
  const params = new URLSearchParams({ api: "1", destination });
  const placeId = url.searchParams.get("destination_place_id") || url.searchParams.get("query_place_id");
  if (placeId) params.set("destination_place_id", placeId);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function googleDirectionsUrl(locationLink?: string | null): string | undefined {
  const saved = trustedMapsLink(locationLink);
  return saved ? directionsFromMapsLink(saved) ?? `/api/directions?${new URLSearchParams({ location: saved.href })}` : undefined;
}
