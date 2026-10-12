"use client";

import { googleDirectionsUrl } from "@/lib/google-directions";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Props = {
  // Legacy display props are accepted but never used as directions destinations.
  lat?: number | null;
  lng?: number | null;
  query: string;
  locationLink?: string | null;
  venueId?: string | null;
};

/** Opens Google Maps directions directly without an API key or billing. */
export function DirectionsLinks({ locationLink, venueId }: Props) {
  const { t } = useI18n();
  const saved = useQuery({
    queryKey: ["venue-directions-link", venueId],
    enabled: !!venueId && !locationLink,
    queryFn: async () => {
      const { data, error } = await createClient().from("venues").select("location_link").eq("id", venueId!).maybeSingle();
      if (error) throw error;
      return data?.location_link as string | null;
    },
  });
  const href = googleDirectionsUrl(locationLink || saved.data);
  if (!href) return null;
  return <Button asChild variant="outline" size="sm">
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Navigation className="me-1 h-3.5 w-3.5" />{t("directions")}
    </a>
  </Button>;
}

export function directionsUrl(lat: number | null | undefined, lng: number | null | undefined, query = "", locationLink?: string | null): string | undefined {
  return googleDirectionsUrl(locationLink);
}
