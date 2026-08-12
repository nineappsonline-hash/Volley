"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, ChevronRight, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useUpcomingSessions } from "@/lib/queries";

export function UpcomingSessions({ isAdmin }: { isAdmin: boolean }) {
  const { t, locale } = useI18n();
  const { data: sessions, isLoading } = useUpcomingSessions();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t("dash_upcoming_sessions")}</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/schedule">
            {t("nav_schedule")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {format(new Date(s.date + "T00:00:00"), "EEEE", { locale })}
              </p>
              <p className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {s.time.slice(0, 5)}
                </span>
                {s.location && (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.location}</span>
                  </span>
                )}
              </p>
            </div>
            {isAdmin && !s.is_completed && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/attendance?session=${s.id}`}>{t("nav_attendance")}</Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
