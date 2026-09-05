"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { COUNTRIES, CITIES_BY_STATE, STATES_BY_COUNTRY } from "@/lib/locations";

const OTHER = "__other__";

interface LocationFieldsProps {
  country: string;
  governorate: string;
  city: string;
  onCountryChange: (v: string) => void;
  onGovernorateChange: (v: string) => void;
  onCityChange: (v: string) => void;
}

/**
 * Country → Governorate → City as linked dropdowns. States/Cities come from
 * suggestion datasets; when no data exists for a level (or the user picks
 * "Other") it falls back to a free-text input.
 */
export function LocationFields({
  country,
  governorate,
  city,
  onCountryChange,
  onGovernorateChange,
  onCityChange,
}: LocationFieldsProps) {
  const { t } = useI18n();

  const states = STATES_BY_COUNTRY[country] ?? [];
  const cities = governorate ? CITIES_BY_STATE[governorate] ?? [] : [];

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
    setGovManual(!(STATES_BY_COUNTRY[v]?.length ?? 0));
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
    setCityManual(!((CITIES_BY_STATE[v]?.length ?? 0) > 0));
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
        <Select value={country} onValueChange={handleCountry}>
          <SelectTrigger>
            <SelectValue placeholder={t("signup_country")} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <Select value={governorate} onValueChange={handleGovernorate}>
              <SelectTrigger>
                <SelectValue placeholder={t("signup_governorate")} />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>{t("common_other")}</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={city} onValueChange={handleCity}>
              <SelectTrigger>
                <SelectValue placeholder={t("signup_city")} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>{t("common_other")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}