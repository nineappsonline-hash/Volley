"use client";

import { GameCardBackground } from "@/components/games/game-card-background";
import { useState } from "react";
import { Check, LandPlot, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlaygroundDistance } from "./playground-distance";
import { useI18n } from "@/lib/i18n";
import { parseMapsCoordinates } from "@/lib/maps";
import { venueCardPhoto } from "@/lib/venue-media";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/types";

export function PlaygroundOptionCard({ playground: p, selected, onSelect }: {
  playground: Venue;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const thumbnail = venueCardPhoto(p.photos, p.cover_url);
  const photos = [...new Set([p.cover_url, ...(p.photos ?? [])].filter((url): url is string => !!url))];
  const location = [p.country, p.governorate, p.area, p.address].filter(Boolean).join(" · ");
  const coordinates = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : parseMapsCoordinates(p.location_link ?? "");
  const destination = coordinates ? `${coordinates.lat},${coordinates.lng}` : [p.name, location].filter(Boolean).join(", ");
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  return (
    <div className={cn("space-y-2 border-t p-3", selected && "bg-accent")}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex w-full items-center gap-3 rounded text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={p.name} loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
        ) : <div className="flex h-20 w-24 shrink-0 items-center justify-center relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-orange-800 via-rose-700 to-purple-800"><GameCardBackground sport={p.sport?.name ?? "volleyball"} /><LandPlot className="relative h-9 w-9 text-white" /></div>}
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block font-medium">{p.name}</span>
          <span dir="auto" className="block text-xs text-muted-foreground">{location}</span>
          {Number(p.court_count) > 1 && <span className="block text-xs">{p.court_count} {t("games_playground_courts")}</span>}
        </span>
        {selected && <Check className="h-4 w-4 shrink-0" />}
      </button>
      {coordinates && <PlaygroundDistance {...coordinates} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={directions} target="_blank" rel="noopener noreferrer"><Navigation className="me-1 h-4 w-4" />{t("directions")}</a>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>{t("games_playground_details")}</Button>
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{p.name}</DialogTitle><DialogDescription>{location}</DialogDescription></DialogHeader>
          {p.sport?.name && <p>{p.sport.name}</p>}
          {photos.length ? <div className="grid gap-3 sm:grid-cols-2">{photos.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={p.name} loading="lazy" className="w-full rounded-lg object-contain" />
            </a>
          ))}</div> : <p className="text-sm text-muted-foreground">{t("games_playground_no_photos")}</p>}
          <Button type="button" variant="outline" asChild><a href={directions} target="_blank" rel="noopener noreferrer">{t("directions")}</a></Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
