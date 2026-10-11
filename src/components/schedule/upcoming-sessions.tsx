"use client";

import { QueryState } from "@/components/shared/query-state";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, ChevronRight, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { useUpcomingSessions } from "@/lib/queries";

export function UpcomingSessions({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang, locale } = useI18n();
  const query = useUpcomingSessions();
  const { data: sessions, isLoading } = query;

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className={isAdmin ? "mb-4 flex-row flex-wrap items-center justify-between gap-2 space-y-0 bg-gradient-to-br from-teal-800 to-emerald-800 text-white" : "flex-row items-center justify-between space-y-0 pb-3"}>
        <CardTitle className="text-base">{t("dash_upcoming_sessions")}</CardTitle>
        <Button asChild variant="ghost" size="sm" className={isAdmin ? "text-white hover:bg-white/10 hover:text-white" : undefined}>
          <Link href="/schedule">
            {t("nav_schedule")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2"><QueryState queries={[query]}>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!isLoading && (!sessions || sessions.length === 0) && (
          <EmptyState message={t("dash_no_sessions")} icon={CalendarDays} />
        )}
        {(sessions ?? []).slice(0, 5).map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-sm font-extrabold leading-none">
                {format(new Date(s.date + "T00:00:00"), "d")}
              </span>
              <span className="text-[10px] leading-tight">
                {format(new Date(s.date + "T00:00:00"), "MMM", { locale })}
              </span>
            </div>
            <Link href={`/schedule?session=${s.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-primary">
              <p className="truncate text-sm font-semibold">
                {format(new Date(s.date + "T00:00:00"), "EEEE", { locale })}
              </p>
              <p className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime12h(s.time, lang)}
                </span>
                {s.location && (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.location}</span>
                  </span>
                )}
              </p>
            </Link>
            {isAdmin && s.status === "scheduled" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/attendance?session=${s.id}`}>{t("nav_attendance")}</Link>
              </Button>
            )}
          </div>
        ))}
      </QueryState></CardContent>
    </Card>
  );
}
