"use client";

import { useCallback, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

/** A picked location plus an optional human-readable address. */
export interface MapPick extends LatLng {
  label?: string | null;
}

const R = 6371; // Earth radius in km

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatKm(km: number, digits = 1): string {
  return km >= 100 ? km.toFixed(0) : km.toFixed(digits);
}

type GeoStatus = "idle" | "loading" | "ok" | "error";

export function useGeoLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("geolocation unsupported");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ok");
      },
      (err) => {
        setStatus("error");
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  return { coords, status, error, request };
}

export interface NominatimResult {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Free, keyless geocoding/search via OpenStreetMap's Nominatim API.
 * Used as the Google-Maps-style search box backing.
 */
export async function geocodeQuery(
  query: string,
  signal?: AbortSignal
): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(
    query
  )}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    return Array.isArray(data)
      ? data.map((r) => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          label: r.display_name,
        }))
      : [];
  } catch {
    return [];
  }
}

/** Reverse-geocode coordinates into a human-readable address label. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&zoom=18`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}