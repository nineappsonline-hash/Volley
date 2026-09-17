"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Award, Flag, MapPin, Medal, Swords, Trophy, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useMyTournaments, useVenues } from "@/lib/queries";
import { computeLeagueStandings, matchDepths } from "@/lib/tournament-results";
import type { TournamentWithMatches } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "secondary",
  in_progress: "default",
  completed: "success",
  canceled: "destructive",
};

type ResultKind =
  | "upcoming"
  | "canceled"
  | "participated"
  | "champion"
  | "runner_up"
  | "eliminated"
  | "ranked"
  | "in_progress";

interface TResult {
  kind: ResultKind;
  rank?: number;
  points?: number;
  round?: string;
}

function tournamentResult(
  t: TournamentWithMatches & {
    teams: { id: string; name: string; created_at: string; members: { participant_id: string }[] }[];
  },
  myTeamId: string | null
): TResult {
  if (t.status === "upcoming") return { kind: "upcoming" };
  if (t.status === "canceled") return { kind: "canceled" };
  if (!myTeamId) return { kind: "participated" };

  if (t.format === "league") {
    const standings = computeLeagueStandings(t.tournament_matches, t.teams);
    const idx = standings.findIndex((s) => s.team_id === myTeamId);
    if (idx === -1) return { kind: "participated" };
    return { kind: "ranked", rank: idx + 1, points: standings[idx].points };
  }

  // Knockout: champion = winner of the deepest completed match.
  const depths = matchDepths(t.tournament_matches);
  const played = t.tournament_matches.filter(
    (m) =>
      m.status === "completed" &&
      m.team_a_id &&
      m.team_b_id &&
      m.score_a != null &&
      m.score_b != null
  );
  if (t.status === "completed" && played.length > 0) {
    let final = played[0];
    for (const m of played) if ((depths.get(m.id) ?? 0) > (depths.get(final.id) ?? 0)) final = m;
    const champId =
      (final.score_a ?? 0) > (final.score_b ?? 0) ? final.team_a_id : final.team_b_id;
    const runnerId = champId === final.team_a_id ? final.team_b_id : final.team_a_id;
    if (myTeamId === champId) return { kind: "champion" };
    if (myTeamId === runnerId) return { kind: "runner_up" };
    let myLast: (typeof t.tournament_matches)[number] | null = null;
    for (const m of t.tournament_matches) {
      if ((m.team_a_id === myTeamId || m.team_b_id === myTeamId) && m.status === "completed") {
        if (!myLast || (depths.get(m.id) ?? 0) > (depths.get(myLast.id) ?? 0)) myLast = m;
      }
    }
    return { kind: "eliminated", round: myLast?.round_name ?? undefined };
  }

  // In progress: show the round they are currently in, if any.
  let myLast: (typeof t.tournament_matches)[number] | null = null;
  for (const m of t.tournament_matches) {
    if ((m.team_a_id === myTeamId || m.team_b_id === myTeamId) && m.status === "completed") {
      if (!myLast || (depths.get(m.id) ?? 0) > (depths.get(myLast.id) ?? 0)) myLast = m;
    }
  }
  return { kind: "in_progress", round: myLast?.round_name ?? undefined };
}

export function MyTournamentsCard({ memberId }: { memberId: string }) {
  const { t, lang, locale } = useI18n();
  const { data: entries, isPending, isError, refetch } = useMyTournaments(memberId);
  const { data: venues } = useVenues();
  const venueName = useMemo(
    () => new Map((venues ?? []).map((v) => [v.id, v.name])),
    [venues]
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" />
          {t("td_my_tournaments")}
        </CardTitle>
        <Badge variant="outline" className="gap-1">
          <Swords className="h-3 w-3" />
          {entries?.length ?? 0}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
            <p className="text-muted-foreground">{t("common_error")}</p>
            <button className="mt-2 text-xs underline" onClick={() => refetch()}>
              {t("common_retry")}
            </button>
          </div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState message={t("td_empty")} icon={Trophy} />
        ) : (
          entries.map(({ participant_id, tournament, myTeam }) => {
            const r = tournamentResult(tournament, myTeam?.id ?? null);
            return (
              <Link
                key={participant_id}
                href="/dashboard/tournaments"
                className="block rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tournament.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                      {tournament.sport?.name}
                      {tournament.start_date
                        ? ` · ${format(new Date(tournament.start_date + "T00:00:00"), "MMM d, yyyy", { locale })}`
                        : ""}
                      {tournament.start_time ? ` · ${formatTime12h(tournament.start_time, lang)}` : ""}
                    </p>
                    {(Number(tournament.participant_fee ?? 0) > 0 ||
                      tournament.max_participants != null ||
                      (tournament.venue_id && venueName.has(tournament.venue_id))) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {Number(tournament.participant_fee ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3 w-3" />
                            {t("td_participant_fee").replace("{fee}", formatMoney(Number(tournament.participant_fee), lang))}
                          </span>
                        )}
                        {tournament.max_participants != null && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {t("td_participants_count")
                              .replace("{count}", String(tournament.participant_count ?? 0))
                              .replace("{max}", String(tournament.max_participants))}
                          </span>
                        )}
                        {tournament.venue_id && venueName.has(tournament.venue_id) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venueName.get(tournament.venue_id)}
                          </span>
                        )}
                      </p>
                    )}
                    {tournament.prize && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <Trophy className="h-3 w-3" />
                        {tournament.prize}
                      </p>
                    )}
                  </div>
                  <Badge variant={(STATUS_COLORS[tournament.status] as "secondary") ?? "secondary"}>
                    {t(`tournament_status_${tournament.status}`)}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {myTeam ? myTeam.name : t("td_participating")}
                  </span>
                  <ResultBadge r={r} />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ResultBadge({ r }: { r: TResult }) {
  const { t } = useI18n();
  if (r.kind === "champion") {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-success">
        <Trophy className="h-3.5 w-3.5" />
        {t("td_champion")}
      </span>
    );
  }
  if (r.kind === "runner_up") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Medal className="h-3.5 w-3.5" />
        {t("td_runner_up")}
      </span>
    );
  }
  if (r.kind === "ranked") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold">
        <Award className="h-3.5 w-3.5 text-primary" />
        {t("td_rank").replace("{rank}", String(r.rank)).replace("{points}", String(r.points))}
      </span>
    );
  }
  if (r.kind === "eliminated") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Flag className="h-3.5 w-3.5" />
        {r.round ? t("td_eliminated").replace("{round}", r.round) : t("td_participating")}
      </span>
    );
  }
  if (r.kind === "in_progress") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-warning-ink">
        <Flag className="h-3.5 w-3.5" />
        {t("td_in_progress").replace("{round}", r.round ?? "")}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {r.kind === "upcoming" || r.kind === "canceled"
        ? t(`tournament_status_${r.kind}`)
        : t("td_participating")}
    </span>
  );
}