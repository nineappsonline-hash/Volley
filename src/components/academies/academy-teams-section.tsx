"use client";

import Link from "next/link";
import { Building2, Calendar, MapPin, Navigation, Trophy, Users } from "lucide-react";
import { AcademyLogo } from "@/components/academies/academy-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  const groups = new Map<string, PublicTeamDirectoryEntry[]>();
  for (const team of teams) {
    const sport = team.sport?.name ?? t("directory_teams_other_sport");
    const list = groups.get(sport) ?? [];
    list.push(team);
    groups.set(sport, list);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b, lang)
  );

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

      {sortedGroups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("directory_teams_empty")}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {sortedGroups.map(([sport, sportTeams]) => (
          <div key={sport}>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-primary" />
              {sport}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sportTeams.map((team) => {
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
                  <Card key={team.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start gap-3">
                        <AcademyLogo
                          academyId={team.academy.id}
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          ))}
        </div>
      )}
    </section>
  );
}
