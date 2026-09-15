"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SortedOptions } from "@/components/ui/sorted-options";
import { useI18n } from "@/lib/i18n";
import { normalizeCountry, localizeCountry } from "@/lib/locations";
import type { Venue } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  search: string;
}

export interface PlaygroundLocationSelection {
  /** "all" or a normalized country key. */
  country: string;
  /** "all" or a stored governorate value. */
  governorate: string;
  /** "all" or a stored area/city value. */
  area: string;
}

const ALL = "all";

/**
 * Country → Governorate → City/area pickers used when creating a game. The
 * options come from the playgrounds themselves, so they always match the stored
 * data and choosing one actually narrows the playground list.
 */
export function PlaygroundLocationFilters({
  venues,
  value,
  onChange,
}: {
  venues: Venue[];
  value: PlaygroundLocationSelection;
  onChange: (next: PlaygroundLocationSelection) => void;
}) {
  const { t, lang } = useI18n();
  const allLabel = t("games_playground_all");

  const countryOptions = useMemo<Option[]>(() => {
    const present = [
      ...new Set(
        venues
          .map((v) => v.country)
          .filter((c): c is string => !!c)
          .map((c) => normalizeCountry(c)),
      ),
    ];
    return [
      { value: ALL, label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((c) => ({
        value: c,
        label: localizeCountry(c, lang),
        search: `${c} ${localizeCountry(c, lang)}`.toLowerCase(),
      })),
    ];
  }, [venues, lang, allLabel]);

  const byCountry = useMemo(() => {
    if (value.country === ALL) return venues;
    const want = normalizeCountry(value.country);
    return venues.filter(
      (v) => !v.country || normalizeCountry(v.country) === want,
    );
  }, [venues, value.country]);

  const governorateOptions = useMemo<Option[]>(() => {
    const present = [
      ...new Set(
        byCountry.map((v) => v.governorate).filter((g): g is string => !!g),
      ),
    ];
    return [
      { value: ALL, label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((g) => ({ value: g, label: g, search: g.toLowerCase() })),
    ];
  }, [byCountry, allLabel]);

  const areaOptions = useMemo<Option[]>(() => {
    const pool =
      value.governorate === ALL
        ? byCountry
        : byCountry.filter((v) => v.governorate === value.governorate);
    const present = [
      ...new Set(pool.map((v) => v.area).filter((a): a is string => !!a)),
    ];
    return [
      { value: ALL, label: allLabel, search: allLabel.toLowerCase() },
      ...present.map((a) => ({ value: a, label: a, search: a.toLowerCase() })),
    ];
  }, [byCountry, value.governorate, allLabel]);

  return (
    <div className="space-y-3">
      <FilterCombobox
        label={t("games_playground_country")}
        value={value.country}
        options={countryOptions}
        onSelect={(v) =>
          onChange({ country: v, governorate: ALL, area: ALL })
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterCombobox
          label={t("games_playground_governorate")}
          value={value.governorate}
          options={governorateOptions}
          onSelect={(v) => onChange({ ...value, governorate: v, area: ALL })}
        />
        <FilterCombobox
          label={t("games_playground_area")}
          value={value.area}
          options={areaOptions}
          onSelect={(v) => onChange({ ...value, area: v })}
        />
      </div>
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
              {(options.find((o) => o.value === value)?.label ?? value) ||
                label}
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
                    {value === o.value && (
                      <Check className="h-4 w-4 shrink-0 opacity-70" />
                    )}
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