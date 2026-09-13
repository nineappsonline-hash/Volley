export type LatLng = { lat: number; lng: number };

/** Rough road factor: straight-line km × 1.3 ≈ driving distance. */
const ROAD_FACTOR = 1.3;

/**
 * Extract latitude/longitude from a Google Maps link.
 *
 * Handles the formats people actually copy:
 * - `/maps/place/<name>/@30.04,31.23,17z/...`
 * - `/maps/@30.04,31.23,15z`
 * - `?q=30.04,31.23`, `?ll=…`, `?daddr=…`, `?sll=…`
 *
 * Short links (maps.app.goo.gl) resolve to one of these on redirect, so they
 * cannot carry coordinates themselves and return null here.
 */
export function parseMapsCoordinates(href: string): LatLng | null {
  if (!href?.trim()) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  // `@lat,lng` segment in the path (the most common shared format).
  const at = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

  // Coordinate-bearing query parameters.
  for (const key of ["q", "daddr", "saddr", "destination", "ll", "sll", "center"]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const m = value.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

/** Great-circle distance in kilometres (Haversine formula). */
export function greatCircleDistanceKm(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Straight-line distance scaled to a realistic travel estimate. */
export function travelDistanceKm(straight: number): number {
  return straight * ROAD_FACTOR;
}

export type DistanceText = { value: string; unit: "km" | "m" };

/** Compact, locale-neutral-ish distance label ("3.2", "850"). */
export function distanceParts(km: number): DistanceText {
  if (km >= 1) return { value: km.toFixed(1).replace(/\.0$/, ""), unit: "km" };
  const meters = Math.max(10, Math.round((km * 1000) / 10) * 10);
  return { value: String(meters), unit: "m" };
}