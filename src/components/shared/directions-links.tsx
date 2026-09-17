"use client";

import { ExternalLink, Navigation } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Props = {
  // Coordinates are optional: when only a query label is available we still
  // open the maps app, it just searches for the place name instead of a pin.
  lat?: number | null;
  lng?: number | null;
  query: string;
};

/**
 * Navigation deeplinks that work without an API key. Sends the user to the
 * maps app of their choice (Google / Waze / Apple Maps). With coordinates the
 * destination is a pinned location; without them it falls back to searching
 * for the place label.
 */
export function DirectionsLinks({ lat, lng, query }: Props) {
  const { t } = useI18n();
  const hasCoords = lat != null && lng != null;
  const encoded = encodeURIComponent(query?.trim() || (hasCoords ? `${lat},${lng}` : ""));

  const links = [
    {
      label: t("directions_google"),
      href: hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    },
    ...(hasCoords
      ? [{
          label: t("directions_waze"),
          href: `https://ul.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
        }]
      : []),
    {
      label: t("directions_apple"),
      href: hasCoords
        ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}`
        : `http://maps.apple.com/?q=${encoded}`,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Navigation className="me-1 h-3.5 w-3.5" />
          {t("directions")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <ExternalLink className="h-3 w-3" />
          {t("directions_open_in")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => (
          <DropdownMenuItem key={l.label} asChild>
            <a href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function directionsUrl(lat: number | null | undefined, lng: number | null | undefined, query = ""): string {
  const q = encodeURIComponent(query?.trim() || "");
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${q}@${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q || "maps"}`;
}