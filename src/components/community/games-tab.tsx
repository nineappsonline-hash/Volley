"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Flag,
  Lamp,
  LandPlot,
  MapPin,
  Navigation,
  Plus,
  Repeat,
  Share2,
  Star,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { GameChat } from "@/components/games/game-chat";
import { JoinGameDialog } from "@/components/games/join-game-dialog";
import { venueCardPhoto } from "@/lib/venue-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { ReportDialog } from "@/components/shared/report-dialog";
import { ScoreDialog } from "@/components/shared/score-dialog";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import {
  useCancelFriendlyGame,
  useFriendlyGames,
  useLeaveFriendlyGame,
  useMyGameParticipants,
  useStopRecurringGame,
} from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";
import { matchesBilingual } from "@/lib/search";
import { errorMessage } from "@/lib/utils";
import type {
  FriendlyGameParticipant,
  FriendlyGameWithDetails,
  Profile,
} from "@/lib/types";
import { CreateGameDialog } from "./create-game-dialog";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-positive-100 text-success-ink dark:bg-positive-500/15 dark:text-positive-400",
  full: "bg-attention-100 text-warning-ink dark:bg-attention-500/15 dark:text-attention-400",
  completed: "bg-success/15 text-success-ink",
  cancelled: "bg-negative-100 text-error-ink dark:bg-negative-500/15 dark:text-negative-400",
};

function gameMatchesProfile(game: FriendlyGameWithDetails, profile: Profile) {
  if (!profile.skill_level) return false;
  if (game.skill_level && game.skill_level !== profile.skill_level) return false;
  const weekday = new Date(game.game_date + "T12:00:00").getDay();
  const days = profile.availability_days ?? [];
  if (days.length > 0 && !days.includes(weekday)) return false;
  return true;
}

function GameCard({
  game,
  profile,
  myParticipants,
  allGames,
}: {
  game: FriendlyGameWithDetails;
  profile: Profile;
  myParticipants: FriendlyGameParticipant[];
  allGames: FriendlyGameWithDetails[];
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const leave = useLeaveFriendlyGame();
  const cancel = useCancelFriendlyGame();
  const stopRecurring = useStopRecurringGame();
  const [reportOpen, setReportOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<"join" | "pay" | null>(null);

  const isPro = profile.member_plan === "premium";
  const playgroundPhoto = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);

  const isParent = game.recurrence === "weekly" && game.source_game_id == null;
  const today = new Date().toISOString().slice(0, 10);
  const nextOccurrence = isParent
    ? allGames
        .filter(
          (g) =>
            g.source_game_id === game.id &&
            g.status !== "cancelled" &&
            g.game_date > today
        )
        .sort((a, b) => a.game_date.localeCompare(b.game_date))[0]
    : undefined;

  const mine = myParticipants.find((p) => p.game_id === game.id);
  const isOrganizer = game.creator_id === profile.id;
  const joined = !!mine || isOrganizer;
  const count = game.participants_count;
  const full = game.status === "full" || count >= game.max_players;
  const slotsLeft = Math.max(game.max_players - count, 0);
  const pastDate = game.game_date < today;
  const needsResult =
    isOrganizer &&
    game.status !== "cancelled" &&
    game.result_a == null &&
    (game.status === "completed" || pastDate);
  const recommended = gameMatchesProfile(game, profile);

  const invite = () => {
    const url = `${window.location.origin}/community`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    toast.success(t("community_invited"));
  };

  const handleJoin = async () => {
    setPayOpen("join");
  };

  const handleLeave = async () => {
    try {
      await leave.mutateAsync(game.id);
      toast.success(t("community_left"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(game.id);
      toast.success(t("community_game_cancelled"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleStopRecurring = async () => {
    if (!isParent) return;
    if (!window.confirm(t("community_stop_repeat_confirm"))) return;
    try {
      await stopRecurring.mutateAsync(game.id);
      toast.success(t("community_stop_repeat_ok"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Card className="hover:border-primary/30 flex flex-col transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-base">{game.title}</CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {game.recurrence && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Repeat className="h-3 w-3" />
                {t("community_weekly")}
              </Badge>
            )}
            {nextOccurrence && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CalendarDays className="h-3 w-3" />
                {t("community_next").replace(
                  "{date}",
                  format(
                    new Date(nextOccurrence.game_date + "T00:00:00"),
                    "MMM d",
                    { locale }
                  )
                )}
              </Badge>
            )}
            {recommended && (
              <Badge
                variant="outline"
                className="gap-1 border-primary/40 text-[10px] text-primary"
              >
                <Lamp className="h-3 w-3" />
                {t("community_recommended")}
              </Badge>
            )}
            <Badge
              className={`text-[10px] ${STATUS_STYLES[game.status] ?? ""}`}
            >
              {t(`community_status_${game.status}`)}
            </Badge>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3 w-3 text-warning-ink" />
          {game.sport}
          <span className="text-muted-foreground">
            · {isOrganizer ? t("community_organizer") : game.creator_nickname || game.creator_name}
            {!isOrganizer && game.creator_username && (
              <span className="text-muted-foreground/70"> @{game.creator_username}</span>
            )}
          </span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {game.playground && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
            {playgroundPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playgroundPhoto} alt={game.playground.name ?? ""} className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
            ) : (
              <LandPlot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold">
                {game.playground.name ?? game.location ?? game.title}
              </p>
              {(game.playground.governorate || game.playground.area) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[game.playground.governorate, game.playground.area].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {game.playground.location_link && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={game.playground.location_link} target="_blank" rel="noopener noreferrer">
                  <Navigation className="me-1 h-3.5 w-3.5" />
                  {t("directions")}
                </a>
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(new Date(game.game_date + "T00:00:00"), "EEE, MMM d", {
              locale,
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" />
            {game.start_time.slice(0, 5)}
          </span>
          {game.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{game.location}</span>
            </span>
          )}
        </div>

        {game.result_a != null && game.result_b != null && (
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning-ink" />
            <span className="text-sm font-semibold">
              {game.result_a} – {game.result_b}
            </span>
            <Badge
              variant="outline"
              className={STATUS_STYLES["completed"]}
              data-testid="score-badge"
            >
              {t("community_completed")}
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          {game.skill_level ? (
            <Badge variant="outline">{t(`skill_${game.skill_level}`)}</Badge>
          ) : (
            <Badge variant="outline">{t("community_any_level")}</Badge>
          )}
          {!game.is_public && (
            <Badge variant="secondary">{t("community_private")}</Badge>
          )}
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {count}/{game.max_players}
            </span>
            <span className="text-muted-foreground">
              {full
                ? t("community_game_full")
                : slotsLeft === 1
                  ? t("community_slots").replace("{n}", String(slotsLeft))
                  : t("community_slots_plural").replace(
                      "{n}",
                      String(slotsLeft)
                    )}
            </span>
          </div>
          <Progress
            value={game.max_players > 0 ? (count / game.max_players) * 100 : 0}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {!isOrganizer &&
            (joined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLeave}
                disabled={leave.isPending}
              >
                {t("community_leave")}
              </Button>
            ) : !full ? (
              <Button
                size="sm"
                onClick={handleJoin}
              >
                <Plus className="me-1 h-3.5 w-3.5" />
                {t("community_join")}
              </Button>
            ) : null)}

          {isOrganizer && mine?.pay_status === "unpaid" && (
            <Button size="sm" onClick={() => setPayOpen("pay")}>
              <Wallet className="me-1 h-3.5 w-3.5" />
              {t("games_share_pay_now")}
            </Button>
          )}

          {isOrganizer && (
            <>
              <Button variant="outline" size="sm" onClick={invite}>
                <Share2 className="me-1 h-3.5 w-3.5" />
                {t("community_invite")}
              </Button>
              {needsResult &&
                (isPro ? (
                  <Button size="sm" onClick={() => setScoreOpen(true)}>
                    <Trophy className="me-1 h-3.5 w-3.5" />
                    {t("community_add_score")}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => router.push("/upgrade")}>
                    <Trophy className="me-1 h-3.5 w-3.5" />
                    {t("community_add_score_pro")}
                  </Button>
                ))}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleCancel}
                disabled={cancel.isPending}
              >
                {t("community_cancel")}
              </Button>
              {isParent &&
                (isPro ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopRecurring}
                    disabled={stopRecurring.isPending}
                  >
                    <Repeat className="me-1 h-3.5 w-3.5" />
                    {t("community_stop_repeat")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/upgrade")}
                  >
                    <Repeat className="me-1 h-3.5 w-3.5" />
                    {t("community_stop_repeat_pro")}
                  </Button>
                ))}
            </>
          )}

          {game.lat != null && game.lng != null && (
            <DirectionsLinks
              lat={game.lat}
              lng={game.lng}
              query={game.location ?? game.area ?? game.title}
            />
          )}

          <div className="ms-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={t("community_more")}>
                  <Flag className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="me-2 h-3.5 w-3.5 text-destructive" />
                  {t("report_game")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      <GameCostEstimate compact rate={game.playground_hourly_rate} hours={game.duration_hours ?? 1} min={game.min_players ?? 2} />
      {joined && <GameChat gameId={game.id} gameTitle={game.title} memberId={profile.id} />}
      </CardContent>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="game"
        targetId={game.id}
        targetLabel={game.title}
      />
      <ScoreDialog
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        gameId={game.id}
        gameTitle={game.title}
      />
      <JoinGameDialog
        open={payOpen !== null}
        onOpenChange={(o) => {
          if (!o) setPayOpen(null);
        }}
        game={game}
        inviteCode={game.is_public ? null : game.invite_code}
        mode={payOpen ?? "join"}
      />
    </Card>
  );
}

export function GamesTab({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const { data: games, isLoading } = useFriendlyGames();
  const { data: myParticipants } = useMyGameParticipants();
  useRealtime(["friendly_games"]);

  const [sportFilter, setSportFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = areaFilter.trim();
    return (games ?? []).filter((g) => {
      if (sportFilter !== "all" && g.sport !== sportFilter) return false;
      if (onlyMatches && !gameMatchesProfile(g, profile)) return false;
      if (!q) return true;
      return matchesBilingual(
        `${g.title} ${g.area ?? ""} ${g.location ?? ""}`,
        q
      );
    });
  }, [games, sportFilter, areaFilter, onlyMatches, profile]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("community_games_hint")}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger aria-label={t("community_sport")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("community_filter_all_sports")}
              </SelectItem>
              {COMMUNITY_SPORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("community_filter_area")}
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          />
          <Button
            variant={onlyMatches ? "default" : "outline"}
            onClick={() => setOnlyMatches((v) => !v)}
          >
            <Lamp className="me-1 h-4 w-4" />
            {t("community_for_me")}
          </Button>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-1 h-4 w-4" />
          {t("community_create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={t("community_no_games")}
          hint={onlyMatches ? t("community_no_matches_hint") : undefined}
          icon={CalendarDays}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              profile={profile}
              myParticipants={myParticipants ?? []}
              allGames={games ?? []}
            />
          ))}
        </div>
      )}

      <CreateGameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memberPlan={profile.member_plan}
      />
    </div>
  );
}