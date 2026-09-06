"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  geocodeQuery,
  reverseGeocode,
  type LatLng,
  type MapPick,
} from "@/lib/geo";

const MapView = dynamic(() => import("@/components/shared/map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

const DEFAULT_CENTER: LatLng = { lat: 30.0444, lng: 31.2357 };
const MIN_QUERY_LENGTH = 2;

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (pick: MapPick) => void;
  hint?: string;
}

export function MapPicker({ lat, lng, onChange, hint }: MapPickerProps) {
  const { t } = useI18n();
  const [latText, setLatText] = useState(lat != null ? String(lat) : "");
  const [lngText, setLngText] = useState(lng != null ? String(lng) : "");
  const [label, setLabel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value: LatLng | null = lat != null && lng != null ? { lat, lng } : null;
  const center = value ?? DEFAULT_CENTER;

  useEffect(() => {
    setLatText(lat != null ? String(lat) : "");
    setLngText(lng != null ? String(lng) : "");
  }, [lat, lng]);

  // Debounced Nominatim search for the Google-style search box.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const found = await geocodeQuery(query, ctrl.signal);
      setResults(found);
      setSearching(false);
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  const commit = (pick: MapPick) => {
    setLabel(pick.label ?? null);
    onChange(pick);
  };

  const commitThenReverse = async (loc: LatLng, tagLabel?: string | null) => {
    commit({ ...loc, label: tagLabel ?? null });
    if (!tagLabel) {
      const addr = await reverseGeocode(loc.lat, loc.lng);
      if (addr) commit({ ...loc, label: addr });
    }
  };

  const pickResult = (r: MapPick) => {
    const loc = { lat: r.lat, lng: r.lng };
    setQuery(r.label ?? "");
    setResults([]);
    commitThenReverse(loc, r.label);
  };

  const clampedLat = useMemo(() => {
    const n = parseFloat(latText);
    return Number.isFinite(n)
      ? Math.min(90, Math.max(-90, parseFloat(n.toFixed(6))))
      : NaN;
  }, [latText]);

  const clampedLng = useMemo(() => {
    const n = parseFloat(lngText);
    return Number.isFinite(n)
      ? Math.min(180, Math.max(-180, parseFloat(n.toFixed(6))))
      : NaN;
  }, [lngText]);

  const applyText = () => {
    if (Number.isNaN(clampedLat) || Number.isNaN(clampedLng)) return;
    setLabel(null);
    onChange({ lat: clampedLat, lng: clampedLng, label: null });
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocError(true);
      return;
    }
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        commitThenReverse({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setLocating(false);
        setLocError(true);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="space-y-2">
      {/* Search box */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("geo_search_placeholder")}
            className="ps-9 pe-9"
            aria-label={t("geo_search_placeholder")}
          />
          {searching && (
            <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {results.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lng}-${i}`}
                type="button"
                onClick={() => pickResult(r)}
                className="block w-full px-3 py-2 text-start text-sm hover:bg-accent"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-[300px] overflow-hidden rounded-lg border">
        <MapView center={center} marker={value} onPick={commitThenReverse} />
      </div>

      {label && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span dir="auto">{label}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={locating}
        >
          <Crosshair className={`h-3.5 w-3.5 ${locating ? "animate-spin" : ""}`} />
          {locating ? t("geo_locating") : t("geo_my_location")}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {t("geo_drag_hint")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("geo_latitude")}</Label>
          <Input
            dir="ltr"
            type="number"
            step="any"
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={applyText}
            placeholder="29.987"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("geo_longitude")}</Label>
          <Input
            dir="ltr"
            type="number"
            step="any"
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={applyText}
            placeholder="31.212"
          />
        </div>
      </div>

      {locError && (
        <p className="text-xs text-destructive">{t("geo_location_error")}</p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}