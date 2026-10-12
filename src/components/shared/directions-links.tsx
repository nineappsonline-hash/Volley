"use client";

import { googleDirectionsUrl } from "@/lib/google-directions";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Props = {
  // Coordinates are optional: when only a query label is available we still
  // open the maps app, it just searches for the place name instead of a pin.
  lat?: number | null;
  lng?: number | null;
  query: string;
  locationLink?: string | null;
};

/** Opens Google Maps directions directly without an API key or billing. */
export function DirectionsLinks({ lat, lng, query, locationLink }: Props) {
  const { t } = useI18n();
  return <Button asChild variant="outline" size="sm">
    <a href={directionsUrl(lat, lng, query, locationLink)} target="_blank" rel="noopener noreferrer">
      <Navigation className="me-1 h-3.5 w-3.5" />{t("directions")}
    </a>
  </Button>;
}

export function directionsUrl(lat: number | null | undefined, lng: number | null | undefined, query = "", locationLink?: string | null): string {
  return googleDirectionsUrl(lat, lng, query, locationLink);
}
