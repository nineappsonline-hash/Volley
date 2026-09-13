"use client";

import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  distanceParts,
  greatCircleDistanceKm,
  travelDistanceKm,
  type LatLng,
} from "@/lib/maps";

/**
 * Tells the member how far the playground is from their current location.
 * Uses the browser geolocation API; renders nothing when unavailable.
 */
export function PlaygroundDistance({ lat, lng }: LatLng) {
  const { t } = useI18n();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    const onPosition = (pos: GeolocationPosition) => {
      const straight = greatCircleDistanceKm(
        { lat, lng },
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
      );
      const { value, unit } = distanceParts(travelDistanceKm(straight));
      setLabel(
        unit === "km"
          ? t("games_distance_km").replace("{km}", value)
          : t("games_distance_m").replace("{m}", value),
      );
    };
    navigator.geolocation.getCurrentPosition(onPosition, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 15000,
    });
  }, [lat, lng, t]);

  if (!label) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <LocateFixed className="h-3.5 w-3.5 shrink-0 text-primary" />
      {label}
    </span>
  );
}