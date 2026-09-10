"use client";

import { useState } from "react";
import { Medal, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PremiumGate } from "@/components/shared/premium-gate";
import { useI18n } from "@/lib/i18n";
import {
  useCommunityLeaderboard,
  useCommunitySports,
  useSportLeaderboard,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

const MEDAL = ["bg-info/15 text-info-ink", "bg-muted text-foreground", "bg-warning/15 text-warning-ink"];

export function LeaderboardClient({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const [sport, setSport] = useState<string | null>(null);

  const { data: sports } = useCommunitySports();
  const { data: overall, isLoading: loadingOverall } = useCommunityLeaderboard();
  const { data: perSport, isLoading: loadingSport } = useSportLeaderboard(sport ?? "");

  const isLoading = sport ? loadingSport : loadingOverall;
  const rows = sport ? perSport : overall;
  const ownIndex = rows?.findIndex((r) => r.member_id === profile.id) ?? -1;
  const myRank =
    "rank" in (rows?.[0] ?? {})
      ? (rows as any).find((r: any) => r.member_id === profile.id)?.rank
      : ownIndex >= 0
        ? ownIndex + 1
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("leaderboard_title")}
        subtitle={t("leaderboard_subtitle")}
      />

      <PremiumGate
        profile={profile}
        description={t("leaderboard_premium_hint")}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            message={t("leaderboard_empty")}
            hint={t("leaderboard_empty_hint")}
            icon={Trophy}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                key="all"
                size="sm"
                variant={sport === null ? "default" : "outline"}
                onClick={() => setSport(null)}
              >
                {t("leaderboard_all")}
              </Button>
              {(sports ?? []).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sport === s ? "default" : "outline"}
                  onClick={() => setSport(s)}
                >
                  {s}
                </Button>
              ))}
            </div>

            {myRank != null && (
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Medal className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{t("leaderboard_my_rank")}</p>
                      <p className="text-xs text-muted-foreground">
                        {rows[ownIndex]?.name}
                      </p>
                    </div>
                  </div>
                  <Badge className="gap-1">
                    <Users className="h-3 w-3" />
                    #{myRank}
                  </Badge>
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-info-ink" />
                  {t("leaderboard_top")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-xl">
                  <div className="flex flex-col">
                    {rows.map((row, i) => {
                      const mine = row.member_id === profile.id;
                      return (
                        <div
                          key={`${row.member_id}-${sport ?? "all"}`}
                          className={`flex items-center gap-3 border-b px-4 py-3 last:border-0 ${
                            mine ? "bg-primary/5" : "hover:bg-accent/40"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              MEDAL[i] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {"rank" in row ? (row as any).rank : i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {row.name}
                              {mine && (
                                <span className="ms-1 text-xs font-semibold text-primary">
                                  ({t("leaderboard_you")})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                            <span title={t("leaderboard_games_played")}>
                              {row.games_played} {t("leaderboard_games")}
                            </span>
                            {!("rank" in row) && (
                              <span title={t("leaderboard_sessions_attended")}>
                                {"sessions_attended" in row
                                  ? (row as any).sessions_attended
                                  : 0}{" "}
                                {t("leaderboard_sessions")}
                              </span>
                            )}
                            <Badge variant="outline" className="gap-0.5">
                              {row.points} {t("leaderboard_pts")}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PremiumGate>
    </div>
  );
}