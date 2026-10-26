"use client";

import Link from "next/link";
import { isActiveSport } from "@/lib/active-sports";
import { GameShareActions } from "./game-share-actions";
import { GameAlertPreferencesPanel } from "./game-alert-follow";

import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { useRequestGamePlayers } from "@/lib/queries";
import { GameCardShell } from "@/components/games/game-card-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  LandPlot,
  Link as LinkIcon,
  MapPin,
  Plus,
  Pencil,
  Repeat,
  Share2,
  ShieldCheck,
  Trophy,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { GameParticipantNames } from "./game-participant-names";
import { GameChat } from "@/components/games/game-chat";
import { AnalyticsView } from "@/components/analytics/business-analytics";
import { trackBusinessEvent } from "@/lib/analytics/events";
import { rememberGameJoin } from "@/lib/analytics/registrations";
import { JoinGameDialog } from "@/components/games/join-game-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { PlaygroundDistance } from "@/components/shared/playground-distance";
import { GameCardBackground } from "./game-card-background";
import { SportIcon } from "@/components/marketing/sport-icons";
import { sportToSlug } from "@/lib/sport-slugs";
import { ReportDialog } from "@/components/shared/report-dialog";
import { parseMapsCoordinates } from "@/lib/maps";
import { venueCardPhoto } from "@/lib/venue-media";
import { ScoreDialog } from "@/components/shared/score-dialog";
import { useI18n } from "@/lib/i18n";
import { LocationFields } from "@/components/shared/location-fields";
import { normalizeCountry } from "@/lib/locations";
import { matchesGameLocation } from "@/lib/game-filters";
import { COMMUNITY_SPORTS, formatMoney, formatTime12h } from "@/lib/constants";
import { GameBookingStatus } from "@/components/games/game-booking-status";
import { gameRentRemaining } from "@/lib/game-costs";
import { createClient } from "@/lib/supabase/client";
import {
  useFriendlyGames,
  useJoinFriendlyGame,
  useLeaveFriendlyGame,
  useMyGameParticipants,
  useSetKickoffReminder,
} from "@/lib/queries";
import { requestPushPrompt } from "@/lib/push";
import { useRealtime } from "@/lib/useRealtime";
import { errorMessage } from "@/lib/utils";
import type {
  FriendlyGame,
  FriendlyGameParticipant,
  FriendlyGameWithDetails,
  Profile,
} from "@/lib/types";
import { GameTeamsButton } from "./game-teams";
import { gameCreationSport } from "@/lib/game-creation";
import { CreateGameDialog } from "./create-game-dialog";
import { EditGameDialog } from "./edit-game-dialog";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-positive-100 text-success-ink ",
  full: "bg-attention-100 text-warning-ink ",
  completed: "bg-success/15 text-success-ink",
  cancelled: "bg-negative-100 text-error-ink ",
};

const AVAILABILITY_OPTIONS = ["any", "today", "weekend", "week", "free_spots"] as const;
const SKILL_OPTIONS = ["all", "beginner", "intermediate", "advanced"] as const;
const SORT_OPTIONS = ["date", "spots"] as const;

type Availability = (typeof AVAILABILITY_OPTIONS)[number];
type SkillFilter = (typeof SKILL_OPTIONS)[number];
type SortBy = (typeof SORT_OPTIONS)[number];

const isWeekend = (date: string) => {
  const day = new Date(date + "T00:00:00").getDay();
  // Friday (5) / Saturday (6) — the Egyptian weekend.
  return day === 5 || day === 6;
};

function playgroundLabel(playground: NonNullable<FriendlyGame["playground"]>) {
  return [playground.governorate, playground.area]
    .filter(Boolean)
    .join(" · ");
}

export function GameCard({
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
  const focus = useSearchParams().get("focus");
  const { t, locale, lang } = useI18n();
  const recruit = useRequestGamePlayers();
  const [recruited, setRecruited] = useState(false);
  const leave = useLeaveFriendlyGame();
  const join = useJoinFriendlyGame();
  const reminder = useSetKickoffReminder();
  const [reportOpen, setReportOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<"join" | "pay" | "rent" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const isPro = profile.member_plan === "premium";
  const mine = myParticipants.find((p) => p.game_id === game.id);
  const isOrganizer = game.creator_id === profile.id;
  const canEdit = isOrganizer || profile.role === "super_admin";
  const joined = !!mine || isOrganizer;
  const rentRemaining = gameRentRemaining(game);
  const playgroundThumb = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  const count = game.participants_count;
  const full = game.status === "full" || count >= game.max_players;
  const slotsLeft = Math.max(game.max_players - count, 0);
  const minPlayers = game.min_players ?? 2;
  const ready = game.status === "open" && count >= minPlayers;
  const moreNeeded = Math.max(minPlayers - count, 0);
  const reminderOn = mine?.kickoff_remind_opt_in ?? true;
  const needsResult =
    isOrganizer &&
    game.status !== "cancelled" &&
    game.result_a == null &&
    (game.status === "completed" || game.game_date < new Date().toISOString().slice(0, 10));

  const isPrivate = !game.is_public;
  const inviteLink = game.invite_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/games?join=${game.invite_code}`
    : null;


  // A paid member (committed share) can only leave more than 24h before kickoff.
  const gameStart = new Date(`${game.game_date}T${game.start_time}`).getTime();
  const leaveBlocked =
    !!mine &&
    (mine.share_amount ?? 0) > 0 &&
    (mine.pay_status === "pending" || mine.pay_status === "approved") &&
    Date.now() + 24 * 60 * 60 * 1000 > gameStart;

  const playgroundTarget = (() => {
    if (!game.playground) return null;
    const fromLink = parseMapsCoordinates(game.playground.location_link ?? "");
    if (fromLink) return fromLink;
    if (game.playground.lat != null && game.playground.lng != null) {
      return { lat: game.playground.lat, lng: game.playground.lng };
    }
    return null;
  })();

  const handleJoin = async () => {
    trackBusinessEvent("join_game_click",{sport:game.sport,area:game.area,country:game.playground?.country,governorate:game.playground?.governorate});
    rememberGameJoin(game.id);
    setPayOpen("join");
  };

  const handleJoinWaitlist = async () => {
    trackBusinessEvent("join_game_click",{sport:game.sport,area:game.area,governorate:game.playground?.governorate});
    try {
      const added = await join.mutateAsync({
        gameId: game.id,
        inviteCode: null,
        payMethod: null,
        payReceiptUrl: null,
      });
      toast.success(t("community_joined"));
      requestPushPrompt();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleLeave = async () => {
    setLeaveConfirmOpen(false);
    try {
      await leave.mutateAsync(game.id);
      toast.success(t("community_left"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const criteria = [
    t(`games_gender_${game.gender}`),
    game.min_age != null || game.max_age != null
      ? game.max_age != null && game.min_age != null
        ? `${game.min_age}–${game.max_age}`
        : game.min_age != null
          ? `${game.min_age}+`
          : `–${game.max_age}`
      : null,
  ].filter(Boolean);

  return (
    <GameCardShell initialExpanded={focus === game.id} layout="list" game={game} joined={joined}>
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
            {game.host_pays && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Wallet className="h-3 w-3" />
                {t("games_host_pays_badge")}
              </Badge>
            )}
            {mine && mine.pay_status === "pending" && (
              <Badge className="gap-1 bg-attention-100 text-[10px] text-warning-ink ">
                {t("games_share_pending")}
              </Badge>
            )}
            {false && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Clock className="h-3 w-3" />
                {t("games_on_waitlist")}
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
            · {isOrganizer ? t("community_organizer") : game.creator_nickname || game.creator_name}
            {!isOrganizer && game.creator_username && (
              <span className="text-muted-foreground/70"> @{game.creator_username}</span>
            )}
          </span>
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <GameParticipantNames participants={game.participants ?? []} />
        {/* Playground */}
        <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
          {playgroundThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={playgroundThumb} alt={game.playground?.name ?? ""} className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
          ) : (
            <LandPlot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">
              {game.playground?.name ?? game.location ?? t("games_no_playground")}
            </p>
            {game.playground && playgroundLabel(game.playground) !== game.playground.name && (
              <p className="truncate text-xs text-muted-foreground">
                {playgroundLabel(game.playground)}
              </p>
            )}
            {playgroundTarget && (
              <span className="mt-0.5 flex items-center gap-1.5">
                <PlaygroundDistance lat={playgroundTarget.lat} lng={playgroundTarget.lng} />
              </span>
            )}
          </div>
          {game.playground?.location_link && (
            <GoogleMapsDirectionsButton href={game.playground.location_link} className="w-full" />
          )}
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <UsersRound className="h-3 w-3" />
            {isPrivate ? t("games_private") : t("games_public")}
          </Badge>
        </div>

        <GameShareActions game={{ ...game, joined: count, place: [game.playground?.name, game.playground?.area ?? game.area, game.playground?.governorate].filter(Boolean).join(", ") || game.location || "" }} />

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(new Date(game.game_date + "T00:00:00"), "EEE, MMM d", { locale })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" />
            {formatTime12h(game.start_time, lang)}
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
            <span className="flex items-center gap-2 text-muted-foreground">
              {false && (
                <span style={{display:'none'}}>{t("games_waitlist_count").replace("{n}", String(0))}</span>
              )}
              <span>
                {full
                  ? t("community_game_full")
                  : slotsLeft === 1
                    ? t("community_slots").replace("{n}", String(slotsLeft))
                    : t("community_slots_plural").replace("{n}", String(slotsLeft))}
              </span>
            </span>
          </div>
          <Progress indicatorColor="var(--color-primary)" style={{ backgroundColor: "hsl(var(--playza-lime) / 0.2)" }} value={game.max_players > 0 ? (count / game.max_players) * 100 : 0} />
          {game.status === "open" && (
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant={ready ? "success" : "outline"}
                className="gap-1 text-[10px]"
              >
                {ready ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <UsersRound className="h-3 w-3" />
                )}
                {ready
                  ? t("games_ready_to_play")
                  : moreNeeded === 1
                    ? t("games_more_to_start").replace("{n}", String(moreNeeded))
                    : t("games_more_to_start_plural").replace("{n}", String(moreNeeded))}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("games_min_players")}: {minPlayers}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {isOrganizer && !isPrivate && game.status === "open" && slotsLeft > 0 && gameStart > Date.now() && <Button variant="outline" disabled={recruit.isPending || recruited} className="gap-2 border-brand-300 bg-brand-50 text-brand-900 hover:bg-brand-100 " onClick={async () => {
            try {
              const sent = await recruit.mutateAsync(game.id);
              if (sent > 0) setRecruited(true);
              toast.success(sent > 0 ? (lang === "ar" ? `تم تنبيه ${sent} لاعب مناسب` : `Alerted ${sent} matching players`) : (lang === "ar" ? "مفيش لاعبين مناسبين مشتركين في التنبيهات حاليًا" : "No matching members have game alerts enabled right now"));
            } catch (err) { toast.error(errorMessage(err, t("common_error"))); }
          }}><Bell className="h-4 w-4" />{recruit.isPending ? t("common_saving") : recruited ? (lang === "ar" ? "تم إرسال التنبيه" : "Players alerted") : (lang === "ar" ? `نحتاج ${slotsLeft} لاعب إضافي` : `Need ${slotsLeft} more ${slotsLeft === 1 ? "player" : "players"}`)}</Button>}

          {isPrivate && !isOrganizer && !joined && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LinkIcon className="h-3.5 w-3.5" />
              {t("games_private_join_hint")}
            </span>
          )}

          {!isOrganizer &&
            !isPrivate &&
            (joined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeaveConfirmOpen(true)}
                disabled={leave.isPending || leaveBlocked}
                title={leaveBlocked ? t("games_leave_blocked") : undefined}
              >
                {t("community_leave")}
              </Button>
            ) : full ? (
              <Button variant="outline" size="sm" disabled>
                {lang === "ar" ? "ممتلئ" : "Full"}
              </Button>
            ) : (
              <Button size="sm" onClick={handleJoin}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t("community_join")}
              </Button>
            ))}


          {isOrganizer && mine?.pay_status === "unpaid" && (
            <Button size="sm" onClick={() => setPayOpen("pay")}>
              <Wallet className="me-1 h-3.5 w-3.5" />
              {t("games_share_pay_now")}
            </Button>
          )}

          {canEdit && (
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
              {isOrganizer &&
                needsResult &&
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
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="me-1 h-3.5 w-3.5" />
                {t("games_edit_btn")}
              </Button>
            </>
          )}

          {game.playground?.location_link && (
            <DirectionsLinks
              locationLink={game.playground?.location_link}
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
      <GameTeamsButton gameId={game.id} date={game.game_date} time={game.start_time} status={game.status} canManage={canEdit} />
      <GameBookingStatus game={game} />
      <GameCostEstimate pricePerPlayer={game.host_pays ? game.host_total : game.share_price} rate={game.playground_hourly_rate} hours={game.duration_hours ?? 1} min={game.min_players ?? 2} hostPays={game.host_pays} sport={game.sport} />
      {rentRemaining > 0 && (game.status === "open" || game.status === "full") && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 ">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-warning-ink">
              {t("games_rent_button")}
            </p>
            <p className="text-xs text-warning-ink/80">
              {formatMoney(rentRemaining, lang)}
            </p>
          </div>
          <Button size="sm" onClick={() => setPayOpen("rent")}>
            <ShieldCheck className="me-1 h-3.5 w-3.5" />
            {t("games_rent_button")}
          </Button>
        </div>
      )}
      {joined && (
        <div className="flex flex-wrap items-center gap-2">
          <GameChat gameId={game.id} gameTitle={game.title} memberId={profile.id} isOrganizer={isOrganizer} />
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("games_remind_me")}</span>
            <Switch
              checked={reminderOn}
              disabled={reminder.isPending}
              onCheckedChange={(on) =>
                reminder.mutate(
                  { gameId: game.id, enabled: on },
                  { onError: (err) => toast.error(errorMessage(err, t("common_error"))) }
                )
              }
              aria-label={t("games_remind_on")}
            />
          </div>
        </div>
      )}
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
        rentRemaining={rentRemaining}
      />

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("community_leave_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("community_leave_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleLeave()}
              disabled={leave.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("community_leave_confirm_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditGameDialog
        game={game}
        profile={profile}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </GameCardShell>
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
  const { t, locale, lang } = useI18n();
  const [payOpen, setPayOpen] = useState(false);

  const inviteGameShare = inviteGame
    ? {
        id: inviteGame.id,
        title: inviteGame.title,
        share_price: inviteGame.share_price,
        host_pays: inviteGame.host_pays,
        host_total: inviteGame.host_total,
        game_date: inviteGame.game_date,
        start_time: inviteGame.start_time,
        location: inviteGame.location,
        area: inviteGame.area,
        playground: inviteGame.playground,
        max_players: inviteGame.max_players,
        status: inviteGame.status,
        gender: inviteGame.gender,
        min_age: inviteGame.min_age,
        max_age: inviteGame.max_age,
      }
    : null;

  if (!inviteCode) return null;

  return (
    <>
    {inviteGame && <AnalyticsView event="game_view" id={inviteGame.id} context={{sport:inviteGame.sport,area:inviteGame.area}} />}
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
                  {formatTime12h(inviteGame.start_time, lang)}
                </span>
                <span>{inviteGame.sport}</span>
                <span>{t(`games_gender_${inviteGame.gender}`)}</span>
              </p>
            </div>
          )
        )}
        {inviteGame && (
          <div className="flex flex-wrap items-center gap-2">
          {inviteGame.playground?.location_link && <DirectionsLinks locationLink={inviteGame.playground?.location_link} lat={inviteGame.lat} lng={inviteGame.lng} query={inviteGame.location ?? inviteGame.area ?? inviteGame.title} />}
          <Button onClick={() => {trackBusinessEvent("join_game_click",{sport:inviteGame.sport,area:inviteGame.area});rememberGameJoin(inviteGame.id);setPayOpen(true);}} disabled={!inviteGame}>
            <Plus className="h-4 w-4" />
            {t("games_join_from_link")}
          </Button>
          </div>
        )}
      </CardContent>
    </Card>
    {inviteGameShare && (
      <JoinGameDialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
        }}
        game={inviteGameShare}
        inviteCode={inviteCode}
        mode="join"
      />
    )}
    </>
  );
}

export function GamesClient({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const joinCode = searchParams.get("join");

  const supabase = createClient();
  const { data: games, isLoading, isError: gamesError, refetch: refetchGames } = useFriendlyGames();
  const { data: myParticipants } = useMyGameParticipants();
  useRealtime(["friendly_games"]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [countryFilter, setCountryFilter] = useState("");
  const [governorateFilter, setGovernorateFilter] = useState("");
  const requestedSport = searchParams.get("sport");
  const [sportFilter, setSportFilter] = useState(() => gameCreationSport(requestedSport) ?? "all");
  useEffect(() => { setSportFilter(gameCreationSport(requestedSport) ?? "all"); }, [requestedSport]);
  const [areaFilter, setAreaFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [availability, setAvailability] = useState<Availability>("any");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("create") === "1");
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekEnd = useMemo(() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const filtered = useMemo(() => {
    const mineIds = new Set((myParticipants ?? []).map((p) => p.game_id));
    const list = (games ?? []).filter((g) => {
      if (!isActiveSport(g.sport) && g.creator_id !== profile.id && !mineIds.has(g.id)) return false;
      if (countryFilter && normalizeCountry(g.playground?.country ?? "") !== normalizeCountry(countryFilter)) return false;
      if (sportFilter !== "all" && g.sport !== sportFilter) return false;
      if (skillFilter !== "all" && g.skill_level !== skillFilter) return false;
      if (governorateFilter && !matchesGameLocation({ area: g.playground?.governorate }, governorateFilter)) return false;
      if (!matchesGameLocation(g, areaFilter)) return false;
      if (availability === "today" && g.game_date !== today) return false;
      if (availability === "weekend" && !isWeekend(g.game_date)) return false;
      if (availability === "week" && g.game_date > weekEnd) return false;
      if (availability === "free_spots" && (g.status === "full" || g.participants_count >= g.max_players)) {
        return false;
      }
      if (onlyMine && g.creator_id !== profile.id && !mineIds.has(g.id)) return false;
      return true;
    });
    const sorted = [...list];
    // Always group by status first: open games on top, finished below, cancelled last.
    const statusRank = (g: FriendlyGameWithDetails) =>
      g.status === "cancelled" ? 2 : g.status === "completed" ? 1 : 0;
    sorted.sort((a, b) => {
      const rank = statusRank(a) - statusRank(b);
      if (rank !== 0) return rank;
      if (sortBy === "spots") {
        const sa = a.max_players - a.participants_count;
        const sb = b.max_players - b.participants_count;
        return sb - sa || a.game_date.localeCompare(b.game_date);
      }
      return a.game_date.localeCompare(b.game_date);
    });
    return sorted;
  }, [games, myParticipants, countryFilter, governorateFilter, sportFilter, skillFilter, areaFilter, availability, onlyMine, sortBy, today, weekEnd, profile.id]);

  // Split the filtered list: games I joined (incl. waitlisted) or created that
  // are still open and upcoming, versus open upcoming games to discover.
  const mineIds = useMemo(
    () => new Set((myParticipants ?? []).map((p) => p.game_id)),
    [myParticipants]
  );
  const isMyGame = useCallback(
    (g: FriendlyGameWithDetails) =>
      (mineIds.has(g.id) || g.creator_id === profile.id) &&
      (g.status === "open" || g.status === "full") &&
      g.game_date >= todayISO,
    [mineIds, profile.id, todayISO]
  );
  const myGamesList = useMemo(
    () => filtered.filter(isMyGame),
    [filtered, isMyGame]
  );
  const discoverGamesList = useMemo(
    () => filtered.filter((g) => !isMyGame(g)),
    [filtered, isMyGame]
  );

  return (
    <div className="space-y-6">
      <nav aria-label={lang === "ar" ? "اكتشف الأنشطة" : "Discover activities"} className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 text-center text-sm font-semibold">
        <Link href="/dashboard/games" aria-current="page" className="rounded-full bg-primary px-3 py-2.5 text-foreground">{lang === "ar" ? "الماتشات" : "Games"}</Link>
        <Link href="/dashboard/tournaments" className="rounded-full px-3 py-2.5 hover:bg-card">{lang === "ar" ? "البطولات" : "Tournaments"}</Link>
        <Link href="/academies" className="rounded-full px-3 py-2.5 hover:bg-card">{lang === "ar" ? "التدريب" : "Training"}</Link>
      </nav>
      <header className="relative isolate overflow-hidden rounded-2xl bg-brand px-5 py-5 text-white sm:px-6 sm:py-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <GameCardBackground sport="tennis" />
          <div className="absolute -bottom-20 -end-16 h-72 w-72 rounded-full border-[32px] border-white/10" />
          <div className="absolute end-8 top-8 hidden -rotate-12 text-amber-300/40 sm:block">{SportIcon({ id: "volleyball", size: 110 })}</div>
        </div>
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><UsersRound className="h-4 w-4" />{lang === "ar" ? "رياضتك. فريقك. ماتشك الجاية." : "Your sport. Your people. Your next game."}</span>
          <h1 className="text-white text-2xl font-extrabold tracking-tight sm:text-3xl">{t("games_page_title")}</h1>
          <p className="max-w-lg text-sm leading-relaxed text-brand-100 sm:text-base">{t("games_page_subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setDialogOpen(true)} className="min-h-11 bg-white text-brand-900 shadow-lg hover:bg-brand-50">
            <Plus className="me-2 h-4 w-4" />{t("games_create")}
          </Button>
          <GameAlertPreferencesPanel returnTo="/dashboard/games" />
          </div>
        </div>
      </header>

      <div className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="text-base font-bold">{lang === "ar" ? "اختار رياضتك" : "Pick your sport"}</h2>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("community_sport")}>
          {["all", ...COMMUNITY_SPORTS].map(sport => <button key={sport} type="button" aria-pressed={sportFilter === sport} onClick={() => setSportFilter(sport)} className="group flex min-h-24 w-24 shrink-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-1 text-center text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${sportFilter === sport ? "border-secondary bg-primary text-foreground" : "border-border bg-background text-foreground group-hover:border-secondary"}`}>{sport === "all" ? <UsersRound size={26} aria-hidden="true" /> : SportIcon({ id: sportToSlug(sport), size: 30 })}</span>
            <span>{sport === "all" ? t("community_filter_all_sports") : sport}</span>
          </button>)}
        </div>
      </div>

      <InviteBanner
        inviteGame={inviteGame}
        inviteCode={joinCode}
        loading={inviteLoading}
        error={inviteError}
      />

      <details className="rounded-2xl border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{lang === "ar" ? "فلاتر الماتشات" : "Game filters"}</summary>
      <div className="grid grid-cols-1 gap-3 border-t p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <LocationFields
            filterMode
            country={countryFilter}
            governorate={governorateFilter}
            city={areaFilter}
            onCountryChange={setCountryFilter}
            onGovernorateChange={setGovernorateFilter}
            onCityChange={setAreaFilter}
          />
        </div>
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

        <Select
          value={skillFilter}
          onValueChange={(v) => setSkillFilter(v as SkillFilter)}
        >
          <SelectTrigger aria-label={t("games_filter_level")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SKILL_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? t("games_level_all") : t(`skill_${s}`)}
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
      </details>

      {gamesError && (
        <div role="alert" className="rounded-lg border border-destructive/30 p-4">
          <p>{t("common_error")}</p>
          <Button className="mt-2" variant="outline" onClick={() => {
            if (gamesError) void refetchGames();
          }}>{t("common_retry")}</Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : gamesError ? null : (
        <>
          {/* My games: joined or created, still open and upcoming */}
          <section aria-labelledby="games-mine-title" className="space-y-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 id="games-mine-title" className="text-lg font-bold">
                {t("games_my_upcoming")}
              </h2>
              <Badge variant="secondary">{myGamesList.length}</Badge>
            </div>
            {myGamesList.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                {t("games_my_upcoming_empty")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {myGamesList.map((g) => (
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
          </section>

          {/* Discover upcoming games: open games I am not part of */}
          <section aria-labelledby="games-discover-title" className="space-y-3">
            <div className="flex items-center gap-2">
              <LandPlot className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 id="games-discover-title" className="text-lg font-bold">
                {t("games_discover_upcoming")}
              </h2>
              <Badge variant="secondary">{discoverGamesList.length}</Badge>
            </div>
            {discoverGamesList.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                {t("games_no_games")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {discoverGamesList.map((g) => (
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
          </section>
        </>
      )}

      <CreateGameDialog open={dialogOpen} onOpenChange={setDialogOpen} memberPlan={profile.member_plan} initialSport={gameCreationSport(sportFilter)} />


    </div>
  );
}
