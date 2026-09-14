"use client";

import Link from "next/link";
import { Trophy, CalendarDays, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { useAllTournaments } from "@/lib/queries";

const STATUS_CLS: Record<string, string> = {
  upcoming: "bg-attention-100 text-warning-ink",
  in_progress: "bg-success-ink/10 text-success-ink",
  completed: "bg-muted text-muted-foreground",
  canceled: "bg-muted text-muted-foreground",
};

export function UpcomingTournamentsCard() {
  const { t, lang } = useI18n();
  const { data: all, isLoading } = useAllTournaments();

  const today = new Date().toISOString().slice(0, 10);
  const list = (all ?? [])
    .filter((t) => t.status === "upcoming" || t.status === "in_progress")
    .filter((t) => t.status === "in_progress" || t.start_date >= today)
    .slice(0, 5);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {t("td_upcoming_tournaments")}
          </span>
          <Link
            href="/dashboard/tournaments"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("td_view_all")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState message={t("td_no_upcoming_tournaments")} icon={Trophy} />
        ) : (
          list.map((tr) => (
            <Link
              key={tr.id}
              href="/dashboard/tournaments"
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{tr.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {tr.sport && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 px-1.5 py-0 text-primary">
                      {tr.sport.name}
                    </Badge>
                  )}
                  {tr.academy && (
                    <span>by {tr.academy.name}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(tr.start_date + "T00:00:00"))}
                    {tr.end_date
                      ? ` — ${new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(tr.end_date + "T00:00:00"))}`
                      : ""}
                  </span>
                </div>
              </div>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[tr.status] ?? STATUS_CLS.completed}`}>
                {t(`tournament_status_${tr.status}`)}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}