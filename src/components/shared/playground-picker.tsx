"use client";
import { SortedOptions } from "@/components/ui/sorted-options";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, LandPlot, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Venue } from "@/lib/types";
import { venueCardPhoto } from "@/lib/venue-media";
import { cn } from "@/lib/utils";
import {
  normalizeCountry,
  localizeCountry,
} from "@/lib/locations";

interface Option {
  value: string;
  label: string;
  search: string;
}

/** One playground line: name + area · governorate. */
function venueLine(v: Venue) {
  return [v.governorate, v.area].filter(Boolean).join(" · ");
}

export function PlaygroundPicker({
  value,
  onChange,
  playgrounds,
}: {
  value: string;
  onChange: (v: string) => void;
  playgrounds: Venue[];
}) {
  const { t, lang } = useI18n();

  // Country is auto-picked from the signed-in user's signup location (default:
  // Egypt) so the list starts filtered to that country, exactly as before. The
  // dropdown still offers "All countries", and every option is derived from the
  // playgrounds themselves so picking one actually narrows the list instead of
  // leaving it empty.
  const [country, setCountry] = useState("");
  const [governorate, setGovernorate] = useState("all");
  const [area, setArea] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (country) return;
    let stale = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        const raw = user?.user_metadata?.country as string | undefined;
        if (!stale) {
          setCountry(raw?.trim() ? normalizeCountry(raw.trim()) : "Egypt");
        }
      } catch {
        if (!stale) setCountry("Egypt");
      }
    })();
    return () => {
      stale = true;
    };
  }, [country]);

  const allLabel = t("games_playground_all");

  const countryOptions = useMemo<Option[]>(() => {
    const present = [
      ...new Set(
        (playgrounds ?? [])
          .map((p) => p.country)
          .filter((c): c is string => !!c)
          .map((c) => normalizeCountry(c)),
      ),
    ];
    return [
      { value: "all", label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((c) => ({
        value: c,
        label: localizeCountry(c, lang),
        search: `${c} ${localizeCountry(c, lang)}`.toLowerCase(),
      })),
    ];
  }, [playgrounds, lang, allLabel]);

  const byCountry = useMemo(() => {
    if (!country || country === "all") return playgrounds;
    const want = normalizeCountry(country);
    return playgrounds.filter(
      (p) => !p.country || normalizeCountry(p.country) === want,
    );
  }, [playgrounds, country]);

  // Governorate/area options come from the playgrounds themselves, so the
  // dropdown values always match the stored values exactly and picking one
  // narrows the list instead of leaving it empty.
  const governateOptions = useMemo<Option[]>(() => {
    const present = [
      ...new Set(
        byCountry.map((p) => p.governorate).filter((g): g is string => !!g),
      ),
    ];
    return [
      { value: "all", label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((g) => ({ value: g, label: g, search: g.toLowerCase() })),
    ];
  }, [byCountry, allLabel]);

  const areaOptions = useMemo<Option[]>(() => {
    const pool = byCountry.filter(
      (p) => governorate === "all" || p.governorate === governorate,
    );
    const present = [
      ...new Set(pool.map((p) => p.area).filter((a): a is string => !!a)),
    ];
    return [
      { value: "all", label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((a) => ({ value: a, label: a, search: a.toLowerCase() })),
    ];
  }, [byCountry, governorate, allLabel]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byCountry
      .filter((p) => governorate === "all" || p.governorate === governorate)
      .filter((p) => area === "all" || p.area === area)
      .filter((p) => {
        if (!q) return true;
        return [p.name, p.governorate, p.area]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      });
  }, [byCountry, governorate, area, query]);

  const selected = playgrounds.find((p) => p.id === value);

  return (
    <div className="space-y-3">
      {/* Country — auto-picked from the user, still changeable. */}
      <FilterCombobox
        label={t("games_playground_country")}
        value={country}
        options={countryOptions}
        onSelect={(v) => {
          setCountry(v);
          setGovernorate("all");
          setArea("all");
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterCombobox
          label={t("games_playground_governorate")}
          value={governorate}
          options={governateOptions}
          onSelect={(v) => {
            setGovernorate(v);
            setArea("all");
          }}
        />
        <FilterCombobox
          label={t("games_playground_area")}
          value={area}
          options={areaOptions}
          onSelect={setArea}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("games_playground_search")}
          className="ps-9"
        />
      </div>

      <div className="max-h-60 overflow-auto rounded-lg border">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-accent",
            value === "" && "bg-accent",
          )}
        >
          <span className="text-muted-foreground">
            {t("games_playground_any")}
          </span>
          {value === "" && <Check className="h-4 w-4 shrink-0 opacity-70" />}
        </button>
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("games_playground_empty")}
          </p>
        ) : (
          matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-start text-sm first:border-t-0 hover:bg-accent",
                value === p.id && "bg-accent",
              )}
            >
              {venueCardPhoto(p.photos, p.cover_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={venueCardPhoto(p.photos, p.cover_url) as string} alt={p.name} className="h-9 w-9 shrink-0 rounded-md border object-cover" />
              ) : (
                <LandPlot className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate font-medium">
                  {p.name}
                  {Number(p.court_count) > 1 && (
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      ({p.court_count} {t("games_playground_courts")})
                    </span>
                  )}
                </span>
                <span
                  dir="auto"
                  className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  {venueLine(p) || t("games_playground_none")}
                </span>
              </span>
              {value === p.id && <Check className="h-4 w-4 shrink-0 opacity-70" />}
            </button>
          ))
        )}
      </div>

      {selected && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LandPlot className="h-3.5 w-3.5 shrink-0 text-primary" />
          {t("games_playground_selected")}
        </p>
      )}
    </div>
  );
}

function FilterCombobox({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: Option[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query
    ? options.filter((o) => o.search.includes(query.toLowerCase()))
    : options;

  const select = (v: string) => {
    onSelect(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between font-normal"
          >
            <span dir="auto" className="truncate text-start">
              {(options.find((o) => o.value === value)?.label ?? value) || label}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={label}
            className="h-9 rounded-none border-0 border-b focus-visible:ring-0"
            dir="auto"
          />
          <div className="max-h-56 overflow-auto p-1">
            <SortedOptions>
              {filtered.length === 0 ? (
                <button
                  type="button"
                  onClick={() => select(query)}
                  className="w-full rounded-sm px-3 py-2 text-start text-sm"
                  dir="auto"
                >
                  {query || label}
                </button>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => select(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:bg-accent",
                      value === o.value && "bg-accent",
                    )}
                    dir="auto"
                  >
                    <span className="truncate">{o.label}</span>
                    {value === o.value && <Check className="h-4 w-4 shrink-0 opacity-70" />}
                  </button>
                ))
              )}
            </SortedOptions>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
