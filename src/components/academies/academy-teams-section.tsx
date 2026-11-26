"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Calendar, MapPin, Navigation, Users, Volleyball } from "lucide-react";
import { AcademyLogoDisplay } from "@/components/academies/academy-logo-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { SportIcon } from "@/components/marketing/sport-icons";
import { useI18n } from "@/lib/i18n";
import { localizeCountry } from "@/lib/locations";
import type { PublicTeamDirectoryEntry } from "@/lib/types";

function locationText(
  team: PublicTeamDirectoryEntry,
  lang: string
): string {
  const source = team.venue ?? team.academy;
  const country = source.country ? localizeCountry(source.country, lang) : "";
  return [source.area, source.governorate, country].filter(Boolean).join(", ");
}

export function AcademyTeamsSection({
  teams,
}: {
  teams: PublicTeamDirectoryEntry[];
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [selectedSport, setSelectedSport] = useState("all");

  const sports = Array.from(
    new Set(teams.map((team) => team.sport?.name ?? t("directory_teams_other_sport")))
  ).sort((a, b) => a.localeCompare(b, lang));


  return (
    <section
      aria-labelledby="academy-teams-heading"
      className="mx-auto max-w-5xl px-6 pb-14"
    >
      <h2 id="academy-teams-heading" className="text-xl font-extrabold">
        {t("directory_teams_title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("directory_teams_subtitle")}
      </p>

      {teams.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("directory_teams_empty")}
        </p>
      ) : (
        <>
          <div className="mt-6 mb-4">
            <div className="inline-flex min-h-9 h-auto w-full max-w-full flex-wrap items-center justify-start gap-2 overflow-x-auto rounded-lg bg-muted p-1 pb-1 text-muted-foreground" role="group" aria-label={ar ? "تصفية الفرق حسب الرياضة" : "Filter teams by sport"}>
              {[{ value: "all", label: ar ? "كل الرياضات" : "All sports" }, ...sports.map(sport => ({ value: sport, label: sport }))].map(item => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selectedSport === item.value}
                  onClick={() => setSelectedSport(item.value)}
                  className={`inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-1 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selectedSport === item.value ? "bg-accent text-accent-foreground shadow-sm" : "hover:bg-accent/60"}`}
                >
                  {item.value !== "all" && (
                    <span className="w-5 h-5 shrink-0"><SportIcon id={item.value.toLowerCase()} size={14} /></span>
                  )}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <SportTeams sport={selectedSport === "all" ? null : selectedSport} teams={teams} lang={lang} t={t} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SportTeams({
  sport,
  teams,
  lang,
  t,
}: {
  sport: string | null;
  teams: PublicTeamDirectoryEntry[];
  lang: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const filtered =
    sport === null
      ? teams
      : teams.filter(
          (team) => (team.sport?.name ?? t("directory_teams_other_sport")) === sport
        );

  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {sport === null
          ? t("directory_teams_empty")
          : t("directory_teams_empty")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((team) => {
        const location = locationText(team, lang);
        const source = team.venue ?? team.academy;
        const age =
          team.min_age != null && team.max_age != null
            ? t("teams_age_range_value")
                .replace("{from}", String(team.min_age))
                .replace("{to}", String(team.max_age))
            : team.min_age != null
              ? `${team.min_age}+`
              : team.max_age != null
                ? `≤ ${team.max_age}`
                : t("directory_teams_age_unknown");
        return (
          <Link key={team.id} href={`/training/${team.id}`} className="block">
            <Card className="flex flex-col relative">
              <CardContent className="flex flex-1 flex-col gap-3 p-4 relative pb-6">
              <div className="flex items-start gap-3">
                <AcademyLogoDisplay
                  name={team.academy.name}
                  logoUrl={team.academy.logo_url}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/a/${team.academy.slug}`}
                    className="block text-sm font-semibold text-primary hover:underline truncate"
                  >
                    {team.academy.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                    {team.sport?.name ?? t("directory_teams_other_sport")}
                  </p>
                  <p className="mt-0.5 truncate text-base font-bold">{team.name}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t(`teams_gender_${team.gender}`)}
                </Badge>
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {age}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                {(source.governorate || source.area) && (
                  <p className="flex items-start gap-1.5">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {source.governorate && source.area
                        ? `${source.governorate} - ${source.area}`
                        : source.governorate || source.area}
                    </span>
                  </p>
                )}
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {team.venue && (
                      <span className="font-medium text-foreground">
                        {team.venue.name}
                      </span>
                    )}
                    {team.venue?.address && (
                      <span className="block mt-0.5">{team.venue.address}</span>
                    )}
                    {!team.venue && location && <span>{location}</span>}
                  </span>
                </p>
                {team.venue?.location_link && (
                  <a
                    href={team.venue.location_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    {t("directions")}
                  </a>
                )}
              </div>
              <div className="absolute bottom-2 right-2 flex items-center justify-center overflow-hidden rounded-xl border bg-white p-1.5 shadow-sm">
                <Volleyball className="h-6 w-6 text-slate-500" />
              </div>
            </CardContent>
            </Card>
          </Link>
          );
      })}
    </div>
  );
}

