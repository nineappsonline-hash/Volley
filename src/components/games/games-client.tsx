"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Clock,
  Flag,
  LandPlot,
  Link as LinkIcon,
  MapPin,
  Plus,
  Repeat,
  Share2,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { GameChat } from "@/components/games/game-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/shared/page-header";
import { ReportDialog } from "@/components/shared/report-dialog";
import { ScoreDialog } from "@/components/shared/score-dialog";
import { useI18n } from "@/lib/i18n";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  useCancelFriendlyGame,
  useFriendlyGames,
  useJoinFriendlyGame,
  useLeaveFriendlyGame,
  useMyGameParticipants,
  usePoolPlaygrounds,
} from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";
import { errorMessage } from "@/lib/utils";
import type {
  FriendlyGame,
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

const AVAILABILITY_OPTIONS = ["any", "today", "week"] as const;
const SORT_OPTIONS = ["date", "spots"] as const;

type Availability = (typeof AVAILABILITY_OPTIONS)[number];
type SortBy = (typeof SORT_OPTIONS)[number];

function playgroundLabel(playground: NonNullable<FriendlyGame["playground"]>) {
  return [playground.name, playground.governorate, playground.area, playground.address]
    .filter(Boolean)
    .join(" · ");
}

function GameCard({
  game,
  profile,
  myParticipants,
  copiedKey,
  onCopy,
}: {
  game: FriendlyGameWithDetails;
  profile: Profile;
  myParticipants: FriendlyGameParticipant[];
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const join = useJoinFriendlyGame();
  const leave = useLeaveFriendlyGame();
  const cancel = useCancelFriendlyGame();
  const [reportOpen, setReportOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);

  const isPro = profile.member_plan === "premium";
  const mine = myParticipants.find((p) => p.game_id === game.id);
  const isOrganizer = game.creator_id === profile.id;
  const joined = !!mine || isOrganizer;
  const count = game.participants_count;
  const full = game.status === "full" || count >= game.max_players;
  const slotsLeft = Math.max(game.max_players - count, 0);
  const needsResult =
    isOrganizer &&
    game.status !== "cancelled" &&
    game.result_a == null &&
    (game.status === "completed" || game.game_date < new Date().toISOString().slice(0, 10));

  const isPrivate = !game.is_public;
  const inviteLink = game.invite_code
    ? `${window.location.origin}/games?join=${game.invite_code}`
    : null;

  const handleJoin = async () => {
    try {
      await join.mutateAsync({ gameId: game.id });
      toast.success(t("community_joined"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
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

  const criteria = [
    game.gender !== "mixed" ? t(`games_gender_${game.gender}`) : null,
    game.min_age != null || game.max_age != null
      ? game.max_age != null && game.min_age != null
        ? `${game.min_age}–${game.max_age}`
        : game.min_age != null
          ? `${game.min_age}+`
          : `–${game.max_age}`
      : null,
  ].filter(Boolean);

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
            {isOrganizer && game.fee_status && game.fee_status !== "approved" && (
              <Badge
                className={`gap-1 text-[10px] ${
                  game.fee_status === "pending"
                    ? "bg-attention-100 text-warning-ink dark:bg-attention-500/15 dark:text-attention-400"
                    : "bg-negative-100 text-error-ink dark:bg-negative-500/15 dark:text-negative-400"
                }`}
              >
                {t(`game_fee_status_${game.fee_status}` as any)}
              </Badge>
            )}
            <Badge className={`text-[10px] ${STATUS_STYLES[game.status] ?? ""}`}>
              {t(`community_status_${game.status}`)}
            </Badge>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3 w-3 text-warning-ink" />
          {game.sport}
          <span>
            · {isOrganizer ? t("community_organizer") : game.creator_name}
          </span>
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Playground */}
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
          <LandPlot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold">
              {game.playground?.name ?? game.location ?? t("games_no_playground")}
            </p>
            {game.playground && playgroundLabel(game.playground) !== game.playground.name && (
              <p className="truncate text-xs text-muted-foreground">
                {playgroundLabel(game.playground)}
              </p>
            )}
          </div>
          {isPrivate && (
            <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
              <UsersRound className="h-3 w-3" />
              {t("games_private")}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(new Date(game.game_date + "T00:00:00"), "EEE, MMM d", { locale })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" />
            {game.start_time.slice(0, 5)}
          </span>
          {(game.area || game.playground?.area) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{game.playground?.area ?? game.area}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {game.skill_level ? (
            <Badge variant="outline">{t(`skill_${game.skill_level}`)}</Badge>
          ) : (
            <Badge variant="outline">{t("community_any_level")}</Badge>
          )}
          {criteria.map((c) => (
            <Badge key={c} variant="outline" className="gap-1 text-primary">
              {c}
            </Badge>
          ))}
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
                  : t("community_slots_plural").replace("{n}", String(slotsLeft))}
            </span>
          </div>
          <Progress value={game.max_players > 0 ? (count / game.max_players) * 100 : 0} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {isPrivate && !isOrganizer && !joined && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LinkIcon className="h-3.5 w-3.5" />
              {t("games_private_join_hint")}
            </span>
          )}

          {!isOrganizer &&
            !isPrivate &&
            (joined ? (
              <Button variant="outline" size="sm" onClick={handleLeave} disabled={leave.isPending}>
                {t("community_leave")}
              </Button>
            ) : !full ? (
              <Button size="sm" onClick={handleJoin} disabled={join.isPending}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t("community_join")}
              </Button>
            ) : null)}

          {isOrganizer && (
            <>
              {inviteLink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onCopy(`invite:${game.id}`, inviteLink);
                    toast.success(t("games_invite_copied"));
                  }}
                >
                  {copiedKey === `invite:${game.id}` ? (
                    <Check className="me-1 h-3.5 w-3.5" />
                  ) : (
                    <Share2 className="me-1 h-3.5 w-3.5" />
                  )}
                  {t("games_copy_invite")}
                </Button>
              )}
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
      <GameCostEstimate compact rate={game.playground_hourly_rate} hours={game.duration_hours ?? 1} min={game.min_players ?? 2} max={game.max_players} />
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
    </Card>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.9 6.26 6.86.6-5.22 4.52 1.55 6.72L12 16.6l-6.09 3.5 1.55-6.72L2.24 8.86l6.86-.6z" />
    </svg>
  );
}

function InviteBanner({
  inviteGame,
  inviteCode,
  loading,
  error,
}: {
  inviteGame: FriendlyGame | null;
  inviteCode: string | null;
  loading: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const join = useJoinFriendlyGame();

  const handleJoin = async () => {
    if (!inviteGame || !inviteCode) return;
    try {
      await join.mutateAsync({ gameId: inviteGame.id, inviteCode });
      toast.success(t("community_joined"));
      router.replace("/games");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  if (!inviteCode) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Skeleton className="h-5 w-44" />
          </div>
        ) : error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : (
          inviteGame && (
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-bold">
                <LandPlot className="h-4 w-4 text-primary" />
                {inviteGame.title}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(inviteGame.game_date + "T00:00:00"), "EEE, MMM d", { locale })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {inviteGame.start_time.slice(0, 5)}
                </span>
                <span>{inviteGame.sport}</span>
              </p>
            </div>
          )
        )}
        {inviteGame && (
          <Button onClick={handleJoin} disabled={join.isPending} className="gap-1">
            <Plus className="h-4 w-4" />
            {join.isPending ? t("common_saving") : t("games_join_from_link")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function GamesClient({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const joinCode = searchParams.get("join");

  const supabase = createClient();
  const { data: games, isLoading } = useFriendlyGames();
  const { data: myParticipants } = useMyGameParticipants();
  const { data: poolPlaygrounds } = usePoolPlaygrounds();
  useRealtime(["friendly_games"]);

  const [sportFilter, setSportFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [availability, setAvailability] = useState<Availability>("any");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [inviteGame, setInviteGame] = useState<FriendlyGame | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!joinCode) return;
    let cancelled = false;
    setInviteLoading(true);
    setInviteError(null);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_game_by_invite", {
          p_code: joinCode,
        });
        if (cancelled) return;
        if (error) {
          setInviteError(error.message);
        } else if (data && data.length > 0) {
          setInviteGame(data[0] as FriendlyGame);
        } else {
          setInviteError(t("games_invite_invalid"));
        }
      } catch {
        if (!cancelled) setInviteError(t("games_invite_invalid"));
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [joinCode, supabase, t]);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const g of games ?? []) {
      const a = g.playground?.area ?? g.area;
      if (a) set.add(a);
      const gov = g.playground?.governorate;
      if (gov) set.add(gov);
    }
    for (const v of poolPlaygrounds ?? []) {
      if (v.area) set.add(v.area);
      if (v.governorate) set.add(v.governorate);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [games, poolPlaygrounds]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekEnd = useMemo(() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const filtered = useMemo(() => {
    const mineIds = new Set((myParticipants ?? []).map((p) => p.game_id));
    const list = (games ?? []).filter((g) => {
      if (sportFilter !== "all" && g.sport !== sportFilter) return false;
      if (areaFilter !== "all") {
        const place = g.playground?.area ?? g.playground?.governorate ?? g.area ?? "";
        if (!matchesArea(place, areaFilter)) return false;
      }
      if (availability === "today" && g.game_date !== today) return false;
      if (availability === "week" && g.game_date > weekEnd) return false;
      if (onlyMine && g.creator_id !== profile.id && !mineIds.has(g.id)) return false;
      return true;
    });
    const sorted = [...list];
    if (sortBy === "spots") {
      sorted.sort((a, b) => {
        const sa = a.max_players - a.participants_count;
        const sb = b.max_players - b.participants_count;
        return sb - sa || a.game_date.localeCompare(b.game_date);
      });
    } else {
      sorted.sort((a, b) => a.game_date.localeCompare(b.game_date));
    }
    return sorted;
  }, [games, myParticipants, sportFilter, areaFilter, availability, onlyMine, sortBy, today, weekEnd, profile.id]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("games_page_title")} subtitle={t("games_page_subtitle")}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-1 h-4 w-4" />
          {t("games_create")}
        </Button>
      </PageHeader>

      <InviteBanner
        inviteGame={inviteGame}
        inviteCode={joinCode}
        loading={inviteLoading}
        error={inviteError}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger aria-label={t("community_sport")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("community_filter_all_sports")}</SelectItem>
            {COMMUNITY_SPORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger aria-label={t("games_filter_location")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("games_filter_anywhere")}</SelectItem>
            {areaOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={availability}
          onValueChange={(v) => setAvailability(v as Availability)}
        >
          <SelectTrigger aria-label={t("games_filter_availability")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITY_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`games_availability_${a}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger aria-label={t("games_sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`games_sort_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={onlyMine ? "default" : "outline"}
          onClick={() => setOnlyMine((v) => !v)}
          className="gap-1"
        >
          <UsersRound className="h-4 w-4" />
          {t("games_only_mine")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-60 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message={t("games_no_games")} icon={LandPlot} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              profile={profile}
              myParticipants={myParticipants ?? []}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      <CreateGameDialog open={dialogOpen} onOpenChange={setDialogOpen} memberPlan={profile.member_plan} />
    </div>
  );
}

function matchesArea(value: string, filter: string): boolean {
  const v = value.toLowerCase();
  const f = filter.toLowerCase();
  return (
    v === f ||
    v.includes(f) ||
    f.includes(v) ||
    value.split(" ").some((w) => f.split(" ").includes(w.toLowerCase()))
  );
}