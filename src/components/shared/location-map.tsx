"use client";

import { MapPin, Navigation } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LocationMap({ name, address, lat, lng }: {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const hasCoordinates = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const destination = hasCoordinates ? `${lat},${lng}` : [name, address].filter(Boolean).join(", ");
  // Only enable the no-charge Embed API, not the billable JavaScript or Places APIs.
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const params = new URLSearchParams({ key: key ?? "", q: destination, language: lang, zoom: "15" });
  const directions = `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination })}`;
  if (!hasCoordinates && !address?.trim()) return null;
  return <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-primary" />{ar ? "الموقع" : "Location"}</h2>{address && <p className="mt-1 text-sm text-muted-foreground">{address}</p>}</div>
      <Button asChild variant="outline" className="gap-2"><a href={directions} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4" />{ar ? "الاتجاهات على خرائط جوجل" : "Google Maps directions"}</a></Button>
    </div>
    {key && <iframe title={ar ? `موقع ${name}` : `${name} location`} src={`https://www.google.com/maps/embed/v1/place?${params}`} width="100%" height="320" className="block w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
  </section>;
}
