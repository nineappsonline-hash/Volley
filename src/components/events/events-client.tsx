"use client";

import { format } from "date-fns";
import { CalendarDays, Map, MapPin, Trophy, Volleyball } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { useNearbyTournaments } from "@/lib/queries";
import type { Profile } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-interactive-100 text-info-ink ",
  in_progress:
    "bg-positive-100 text-success-ink ",
  completed:
    "bg-muted text-muted-foreground",
  canceled:
    "bg-negative-100 text-error-ink ",
};

export function EventsClient({ profile }: { profile: Profile }) {
  const { t, lang, locale } = useI18n();
  const { data: events, isLoading } = useNearbyTournaments(profile.academy_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("events_title")}
        subtitle={t("events_subtitle")}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="h-48 animate-pulse bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <EmptyState
          message={t("events_empty")}
          icon={CalendarDays}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{event.name}</CardTitle>
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      STATUS_STYLES[event.status] ?? ""
                    }`}
                  >
                    {t(`tournament_status_${event.status}`)}
                  </Badge>
                </div>
                {event.academy && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Volleyball className="h-3 w-3" />
                    {event.academy.name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {event.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(
                      new Date(event.start_date + "T00:00:00"),
                      "MMM d, yyyy",
                      { locale }
                    )}
                    {event.end_date &&
                      ` – ${format(
                        new Date(event.end_date + "T00:00:00"),
                        "MMM d, yyyy",
                        { locale }
                      )}`}
                  </span>
                  {event.sport && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      {event.sport.name}
                    </span>
                  )}
                </div>

                {event.academy?.address && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {event.academy.address}
                  </p>
                )}

                {event.tournament_matches?.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                      {t("events_matches")}
                    </p>
                    <div className="space-y-1">
                      {event.tournament_matches.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded border px-2 py-1 text-xs"
                        >
                          <span className="font-medium">{m.round_name}</span>
                          <span className="text-muted-foreground">
                            {m.score_a != null && m.score_b != null
                              ? `${m.score_a} – ${m.score_b}`
                              : t("events_vs")}
                          </span>
                        </div>
                      ))}
                      {event.tournament_matches.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">
                          +{event.tournament_matches.length - 3}{" "}
                          {t("events_more_matches")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
