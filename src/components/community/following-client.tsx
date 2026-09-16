"use client";

import { format } from "date-fns";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Megaphone,
  Trophy,
  Volleyball,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useFollowingFeed, useMyAcademyFollows } from "@/lib/queries";
import { FollowAcademyButton } from "@/components/academies/follow-badge-button";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-interactive-100 text-info-ink dark:bg-interactive-500/15 dark:text-interactive-400",
  in_progress:
    "bg-positive-100 text-success-ink dark:bg-positive-500/15 dark:text-positive-400",
  completed:
    "bg-muted text-muted-foreground",
  canceled:
    "bg-negative-100 text-error-ink dark:bg-negative-500/15 dark:text-negative-400",
};

export function FollowingClient() {
  const { t, lang, locale } = useI18n();
  const { data: follows, isLoading: loadingFollows } = useMyAcademyFollows();
  const { data: feed, isLoading: loadingFeed } = useFollowingFeed();

  if (loadingFollows) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("following_title")} subtitle={t("following_subtitle")} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!follows || follows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("following_title")} subtitle={t("following_subtitle")} />
        <EmptyState
          message={t("following_empty")}
          icon={Building2}
          action={
            <Button asChild>
              <Link href="/academies">{t("following_browse")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("following_title")} subtitle={t("following_subtitle")} />

      {/* Followed academies */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Building2 className="h-4 w-4 text-primary" />
          {t("following_my_academies")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {follows.map((f) => (
            <Card key={f.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {f.academy?.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.academy.cover_url}
                        alt={f.academy.name}
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Volleyball className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="truncate text-base">{f.academy?.name ?? ""}</span>
                  </span>
                  <FollowAcademyButton academyId={f.academy_id} size="sm" />
                </CardTitle>
              </CardHeader>
              {f.academy?.description && (
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {f.academy.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Updates + events feed */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Megaphone className="h-4 w-4 text-primary" />
          {t("following_updates_title")}
        </h2>
        {loadingFeed ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : feed && feed.updates.length === 0 && feed.events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("following_feed_empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feed?.events.map((event) => (
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
                      <Building2 className="h-3 w-3" />
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
                  {event.academy?.slug && (
                    <Link
                      href={`/a/${event.academy.slug}`}
                      className="block text-xs font-medium text-primary hover:underline"
                    >
                      {t("following_view_academy")}
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}

            {feed?.updates.map((update) => (
              <Card key={update.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Megaphone className="h-3.5 w-3.5" />
                    {update.academy?.name ?? ""}
                  </div>
                  <CardTitle className="text-base">{update.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {update.body}
                  </p>
                  {update.academy?.slug && (
                    <Link
                      href={`/a/${update.academy.slug}`}
                      className="block text-xs font-medium text-primary hover:underline"
                    >
                      {t("following_view_academy")}
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}