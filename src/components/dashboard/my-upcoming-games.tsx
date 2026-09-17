"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Clock,
  LandPlot,
  MapPin,
  Timer,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useMyUpcomingGames, useUpcomingGameParticipants } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionary";
import { QueryState } from "@/components/shared/query-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { PlaygroundDistance } from "@/components/shared/playground-distance";
import { parseMapsCoordinates } from "@/lib/maps";
import { venueCardPhoto } from "@/lib/venue-media";
import { formatMoney } from "@/lib/constants";
import { useRealtime } from "@/lib/useRealtime";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-positive-100 text-success-ink dark:bg-positive-500/15 dark:text-positive-400",
  full: "bg-attention-100 text-warning-ink dark:bg-attention-500/15 dark:text-attention-400",
  completed: "bg-success/15 text-success-ink",
  cancelled: "bg-negative-100 text-error-ink dark:bg-negative-500/15 dark:text-negative-400",
};

export function MyUpcomingGames({ memberId }: { memberId: string }) {
  const { t, lang, locale } = useI18n();
  const ar = lang === "ar";
  const query = useMyUpcomingGames(memberId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.find(row => row.game.id === selectedId);
  const roster = useUpcomingGameParticipants(selectedId, memberId);
  useRealtime(["friendly_games", "friendly_game_participants"]);

  const prettyDate = (date: string) => format(new Date(date + "T00:00:00"), "EEE, MMM d", { locale });

  const game = selected?.game;
  const playgroundPhoto = game?.playground
    ? venueCardPhoto(game.playground.photos, game.playground.cover_url)
    : null;

  const directionTarget = (() => {
    const pg = game?.playground;
    const fromLink = pg?.location_link ? parseMapsCoordinates(pg.location_link) : null;
    if (fromLink) return fromLink;
    if (pg?.lat != null && pg?.lng != null) return { lat: pg.lat, lng: pg.lng };
    if (game?.lat != null && game?.lng != null) return { lat: game.lat, lng: game.lng };
    return null;
  })();

  const directionQuery =
    game?.location ?? game?.playground?.name ?? game?.area ?? game?.title;

  const activeCount = roster.data?.filter(p => !p.is_waitlisted).length ?? 0;
  const waitlistCount = roster.data?.filter(p => p.is_waitlisted).length ?? 0;

  return <>
    <Card id="my-upcoming-games" className="border-2 border-primary/30 bg-primary/5 shadow-md">
      <CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-2xl"><CalendarDays className="h-7 w-7 text-primary" />{t("games_my_upcoming")}</CardTitle></CardHeader>
      <CardContent><QueryState queries={[query]}>
        {!query.data?.length ? <p className="text-sm text-muted-foreground">{t("games_my_upcoming_empty")}</p> :
          <ul className="grid gap-4 md:grid-cols-2">{query.data.map(({ id, game, is_waitlisted }) => <li key={id}>
            <button type="button" onClick={() => setSelectedId(game.id)} className="h-full w-full space-y-3 rounded-xl border bg-card p-6 text-start shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{game.sport}</Badge>{is_waitlisted && <Badge variant="secondary">{ar ? "قائمة الانتظار" : "Waitlisted"}</Badge>}</div>
              <h3 className="text-xl font-bold">{game.title}</h3>
              <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 shrink-0" />{prettyDate(game.game_date)}</p>
              <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 shrink-0" />{game.start_time.slice(0, 5)} · {game.duration_hours} {ar ? "ساعة" : "hours"}</p>
              {(game.location || game.area) && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" />{[game.location, game.area].filter(Boolean).join(" · ")}</p>}
              <p className="font-semibold text-info-ink">{ar ? "عرض تفاصيل المباراة والمشاركين" : "View game details and participants"}</p>
            </button>
          </li>)}</ul>}
      </QueryState></CardContent>
    </Card>

    <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-2xl">
        {game && <article className="overflow-hidden">
          {/* Hero header */}
          <header className="relative bg-gradient-to-br from-brand to-interactive-700 px-6 pb-6 pt-6 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_55%)]" />
            <div className="relative flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 bg-white/15 text-white hover:bg-white/15">
                <Trophy className="h-3.5 w-3.5" />
                {game.sport}
              </Badge>
              <Badge className={cn("border-0", STATUS_STYLES[game.status] ?? "")}>
                {t(`community_status_${game.status}` as keyof Dict)}
              </Badge>
              {selected?.is_waitlisted && (
                <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15">
                  {ar ? "قائمة الانتظار" : "Waitlisted"}
                </Badge>
              )}
              {game.host_pays && (
                <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15">
                  <Wallet className="me-1 h-3 w-3" />
                  {t("games_host_pays_badge")}
                </Badge>
              )}
            </div>
            <h2 className="relative mt-3 text-2xl font-extrabold leading-tight">{game.title}</h2>
            <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 shrink-0" />{prettyDate(game.game_date)}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 shrink-0" />{game.start_time.slice(0, 5)}</span>
              <span className="flex items-center gap-1.5"><Timer className="h-4 w-4 shrink-0" />{game.duration_hours} {ar ? "ساعة" : "hours"}</span>
            </div>
          </header>

          <div className="space-y-4 p-6">
            {/* Playground + directions */}
            {(game.playground || game.location || game.area) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
                {playgroundPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playgroundPhoto} alt={game.playground?.name ?? ""} className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LandPlot className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {game.playground?.name ?? game.location}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {[game.playground?.governorate, game.playground?.area, game.area]
                      .filter(Boolean).join(" · ") || "\u00a0"}
                    {directionTarget && <PlaygroundDistance lat={directionTarget.lat} lng={directionTarget.lng} />}
                  </p>
                </div>
                {directionQuery && (
                  <DirectionsLinks lat={directionTarget?.lat} lng={directionTarget?.lng} query={directionQuery} />
                )}
              </div>
            )}

            {/* Meta + share price */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {game.is_public ? <Badge variant="outline">{t("games_public")}</Badge> : <Badge variant="outline">{t("games_private")}</Badge>}
              <Badge variant="outline">{ar ? "الحد الأدنى" : "Min."} {game.min_players}</Badge>
              <Badge variant="outline">
                <Users className="me-1 h-3 w-3" />
                {activeCount}/{game.max_players}
              </Badge>
              {waitlistCount > 0 && <Badge variant="outline">{t("games_waitlist_count").replace("{n}", String(waitlistCount))}</Badge>}
              <Badge variant="info">
                {ar ? "نصيبة اللاعب: " : "Share: "}{formatMoney(game.host_pays ? 0 : (game.share_price ?? 0), lang)}
              </Badge>
            </div>

            <Progress value={game.max_players > 0 ? (activeCount / game.max_players) * 100 : 0} />

            {game.description && <p className="whitespace-pre-wrap text-sm text-foreground/90">{game.description}</p>}

            {/* Participants */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-primary" />
                {ar ? "المشاركون" : "Participants"}
                <span className="text-sm font-normal text-muted-foreground">
                  {activeCount}/{game.max_players}
                </span>
              </h3>
              <QueryState queries={[roster]}>
                {!roster.data?.length ? <p className="text-sm text-muted-foreground">{ar ? "لا يوجد مشاركون بعد" : "No participants yet"}</p> : <ul className="space-y-2">{roster.data.map(player => <li key={player.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <span className="truncate">{player.player_name}</span>
                  </span>
                  {player.is_waitlisted && <Badge variant="secondary">{ar ? "قائمة الانتظار" : "Waitlisted"}</Badge>}
                </li>)}</ul>}
              </QueryState>
            </section>
          </div>
        </article>}
      </DialogContent>
    </Dialog>
  </>;
}