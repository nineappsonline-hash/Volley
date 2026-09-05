"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  COUNTRIES_AR,
  CITIES_BY_STATE,
  STATES_BY_COUNTRY,
} from "@/lib/locations";

const OTHER = "__other__";

const isArabicScript = (s: string) => /[\u0600-\u06FF]/.test(s);

interface Option {
  value: string;
  label: string;
  search: string;
}

interface LocationFieldsProps {
  country: string;
  governorate: string;
  city: string;
  onCountryChange: (v: string) => void;
  onGovernorateChange: (v: string) => void;
  onCityChange: (v: string) => void;
}

/**
 * Country → Governorate → City as linked, type-to-search dropdowns. Options are
 * shown in the active UI language; "Other" falls back to a free-text input.
 */
export function LocationFields({
  country,
  governorate,
  city,
  onCountryChange,
  onGovernorateChange,
  onCityChange,
}: LocationFieldsProps) {
  const { t, lang } = useI18n();
  const isArabicLocale = lang === "ar";
  const localized = (arr: string[]) =>
    arr.filter((s) => isArabicLocale === isArabicScript(s));

  const countryOptions: Option[] = COUNTRIES.map((en) => {
    const ar = COUNTRIES_AR[en] ?? en;
    const name = isArabicLocale ? ar : en;
    return { value: name, label: name, search: `${en} ${ar}`.toLowerCase() };
  });

  const states = localized(STATES_BY_COUNTRY[country] ?? []);
  const cities = governorate ? localized(CITIES_BY_STATE[governorate] ?? []) : [];

  const stateOptions: Option[] = states.map((s) => ({
    value: s,
    label: s,
    search: s.toLowerCase(),
  }));
  const cityOptions: Option[] = cities.map((c) => ({
    value: c,
    label: c,
    search: c.toLowerCase(),
  }));

  const [govManual, setGovManual] = useState(
    states.length === 0 || (!!governorate && !states.includes(governorate))
  );
  const [cityManual, setCityManual] = useState(
    cities.length === 0 || (!!city && !cities.includes(city))
  );

  useEffect(() => {
    setGovManual(
      states.length === 0 ||
        (!!governorate && !states.includes(governorate))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, governorate]);

  useEffect(() => {
    setCityManual(
      cities.length === 0 || (!!city && !cities.includes(city))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorate, city]);

  const handleCountry = (v: string) => {
    onCountryChange(v);
    onGovernorateChange("");
    onCityChange("");
    setGovManual(localized(STATES_BY_COUNTRY[v] ?? []).length === 0);
    setCityManual(true);
  };

  const handleGovernorate = (v: string) => {
    if (v === OTHER) {
      setGovManual(true);
      return;
    }
    onGovernorateChange(v);
    onCityChange("");
    setGovManual(false);
    setCityManual(localized(CITIES_BY_STATE[v] ?? []).length === 0);
  };

  const handleCity = (v: string) => {
    if (v === OTHER) {
      setCityManual(true);
      return;
    }
    onCityChange(v);
    setCityManual(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("signup_country")}</Label>
        <LocationCombobox
          value={country}
          options={countryOptions}
          placeholder={t("signup_country")}
          onSelect={handleCountry}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("signup_governorate")}</Label>
          {govManual ? (
            <Input
              value={governorate}
              onChange={(e) => onGovernorateChange(e.target.value)}
              placeholder={t("signup_governorate")}
              dir="auto"
            />
          ) : (
            <LocationCombobox
              value={governorate}
              options={[...stateOptions, otherOption(t("common_other"))]}
              placeholder={t("signup_governorate")}
              onSelect={handleGovernorate}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("signup_city")}</Label>
          {cityManual ? (
            <Input
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder={t("signup_city")}
              dir="auto"
            />
          ) : (
            <LocationCombobox
              value={city}
              options={[...cityOptions, otherOption(t("common_other"))]}
              placeholder={t("signup_city")}
              onSelect={handleCity}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function otherOption(label: string): Option {
  return { value: OTHER, label, search: `other ${label}`.toLowerCase() };
}

function LocationCombobox({
  value,
  options,
  placeholder,
  onSelect,
}: {
  value: string;
  options: Option[];
  placeholder: string;
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
        >
          <span
            dir="auto"
            className={cn("truncate text-start", !value && "text-muted-foreground")}
          >
            {value || placeholder}
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
          placeholder={placeholder}
          className="h-9 rounded-none border-0 border-b focus-visible:ring-0"
          dir="auto"
        />
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 ? (
            <button
              type="button"
              onClick={() => select(query)}
              className="w-full rounded-sm px-3 py-2 text-start text-sm"
              dir="auto"
            >
              {query || placeholder}
            </button>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:bg-accent",
                  value === o.value && "bg-accent"
                )}
                dir="auto"
              >
                <span className="truncate">{o.label}</span>
                {value === o.value && <Check className="h-4 w-4 shrink-0 opacity-70" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}