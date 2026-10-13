"use client";

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
  Navigation,
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
import { CreateGameDialog } from "./create-game-dialog";
import { EditGameDialog } from "./edit-game-dialog";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-positive-100 text-success-ink dark:bg-positive-500/15 dark:text-positive-400",
  full: "bg-attention-100 text-warning-ink dark:bg-attention-500/15 dark:text-attention-400",
  completed: "bg-success/15 text-success-ink",
  cancelled: "bg-negative-100 text-error-ink dark:bg-negative-500/15 dark:text-negative-400",
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
  const waitlisted = !!mine?.is_waitlisted;
  const playgroundThumb = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  const count = game.participants_count;
  const waitlistCount = game.waitlist_count ?? 0;
  const full = game.status === "full" || count >= game.max_players;
  const slotsLeft = Math.max(game.max_players - count, 0);
  const minPlayers = game.min_players ?? 2;
  const ready = game.status === "open" && count >= minPlayers;
  const moreNeeded = Math.max(minPlayers - count, 0);
  const reminderOn = (mine?.kickoff_remind_opt_in ?? true) && !waitlisted;
  const needsResult =
    isOrganizer &&
    game.status !== "cancelled" &&
    game.result_a == null &&
    (game.status === "completed" || game.game_date < new Date().toISOString().slice(0, 10));

  const isPrivate = !game.is_public;
  const inviteLink = game.invite_code
    ? `${window.location.origin}/games?join=${game.invite_code}`
    : null;
  const shareLink = inviteLink ?? `${window.location.origin}/games`;

  // A paid member (committed share) can only leave more than 24h before kickoff.
  const gameStart = new Date(`${game.game_date}T${game.start_time}`).getTime();
  const leaveBlocked =
    !!mine &&
    !mine.is_waitlisted &&
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
    setPayOpen("join");
  };

  const handleJoinWaitlist = async () => {
    try {
      const added = await join.mutateAsync({
        gameId: game.id,
        inviteCode: null,
        payMethod: null,
        payReceiptUrl: null,
      });
      toast.success(added ? t("games_waitlist_joined") : t("community_joined"));
      requestPushPrompt();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleShare = async () => {
    const link = inviteLink ?? `${window.location.origin}/games`;
    const when = `${format(new Date(game.game_date + "T00:00:00"), "EEE, MMM d", { locale })} ${formatTime12h(game.start_time, lang)}`;
    const text = `${game.title} · ${game.sport} · ${when} · ${count}/${game.max_players}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: game.title, text, url: link });
        return;
      } catch {
        // User dismissed the share sheet — fall back to WhatsApp.
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
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
    <GameCardShell game={game} joined={joined} waitlisted={!!mine?.is_waitlisted}>
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
              <Badge className="gap-1 bg-attention-100 text-[10px] text-warning-ink dark:bg-attention-500/15 dark:text-attention-400">
                {t("games_share_pending")}
              </Badge>
            )}
            {waitlisted && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <UsersRound className="h-3 w-3" />
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
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
          {playgroundThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={playgroundThumb} alt={game.playground?.name ?? ""} className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
          ) : (
            <LandPlot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0 text-sm">
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
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a href={game.playground.location_link} target="_blank" rel="noopener noreferrer">
                <Navigation className="me-1 h-3.5 w-3.5" />
                {t("directions")}
              </a>
            </Button>
          )}
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <UsersRound className="h-3 w-3" />
            {isPrivate ? t("games_private") : t("games_public")}
          </Badge>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2">
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span dir="ltr" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{shareLink}</span>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onCopy(`share:${game.id}`, shareLink);
              toast.success(t("games_invite_copied"));
            }}
          >
            {copiedKey === `share:${game.id}` ? (
              <Check className="me-1 h-3.5 w-3.5" />
            ) : (
              <Share2 className="me-1 h-3.5 w-3.5" />
            )}
            {t("games_copy_invite")}
          </Button>
        </div>

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
              {waitlistCount > 0 && (
                <span>{t("games_waitlist_count").replace("{n}", String(waitlistCount))}</span>
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
          <Progress value={game.max_players > 0 ? (count / game.max_players) * 100 : 0} />
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
          {isOrganizer && !isPrivate && game.status === "open" && slotsLeft > 0 && gameStart > Date.now() && <Button variant="outline" disabled={recruit.isPending || recruited} className="gap-2 border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100" onClick={async () => {
            try {
              const sent = await recruit.mutateAsync(game.id);
              if (sent > 0) setRecruited(true);
              toast.success(sent > 0 ? (lang === "ar" ? `تم تنبيه ${sent} لاعب مناسب` : `Alerted ${sent} matching players`) : (lang === "ar" ? "لا يوجد لاعبون مطابقون مشتركين في التنبيهات حاليًا" : "No matching members have game alerts enabled right now"));
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
              <Button variant="outline" size="sm" onClick={() => void handleJoinWaitlist()} disabled={join.isPending}>
                <UsersRound className="me-1 h-3.5 w-3.5" />
                {t("games_waitlist_join")}
              </Button>
            ) : (
              <Button size="sm" onClick={handleJoin}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t("community_join")}
              </Button>
            ))}

          {!isOrganizer && (
            <Button variant="outline" size="sm" onClick={() => void handleShare()}>
              <Share2 className="me-1 h-3.5 w-3.5" />
              {t("games_share_btn")}
            </Button>
          )}

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
      <GameCostEstimate pricePerPlayer={game.share_price} rate={game.playground_hourly_rate} hours={game.duration_hours ?? 1} min={game.min_players ?? 2} hostPays={game.host_pays} sport={game.sport} />
      {rentRemaining > 0 && (game.status === "open" || game.status === "full") && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 dark:bg-attention-500/10">
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
      {joined && !waitlisted && (
        <div className="flex flex-wrap items-center gap-2">
          <GameChat gameId={game.id} gameTitle={game.title} memberId={profile.id} isOrganizer={isOrganizer} />
          {!waitlisted && (
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
          )}
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
          <Button onClick={() => setPayOpen(true)} disabled={!inviteGame}>
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

type DemoFinishedGame = {
  id: string;
  title: string;
  sport: string;
  area: string | null;
  game_date: string;
  start_time: string;
  max_players: number;
  joined: number;
  skill_level: "beginner" | "intermediate" | "advanced";
  gender: "male" | "female" | "mixed";
  creator_name: string;
  result_a: number;
  result_b: number;
};

// Demo "recently finished" games so the games page doesn't look empty before the
// community has real completed games. Dates are generated relative to today.
function demoFinishedGames(): DemoFinishedGame[] {
  const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const seeds: Omit<DemoFinishedGame, "id" | "game_date">[] = [
    { title: "Friday Slam Volleyball", sport: "Volleyball", area: "Heliopolis", start_time: "20:30", max_players: 12, joined: 12, skill_level: "intermediate", gender: "mixed", creator_name: "Ahmed Nabil", result_a: 3, result_b: 1 },
    { title: "Gezira Beach Volleyball", sport: "Volleyball", area: "Zamalek", start_time: "18:00", max_players: 12, joined: 12, skill_level: "beginner", gender: "mixed", creator_name: "Youssef Hany", result_a: 2, result_b: 3 },
    { title: "Nasr City Spike Night", sport: "Volleyball", area: "Nasr City", start_time: "21:00", max_players: 12, joined: 11, skill_level: "advanced", gender: "mixed", creator_name: "Omar Farouk", result_a: 3, result_b: 0 },
    { title: "Heliopolis Volleyball Run", sport: "Volleyball", area: "Heliopolis", start_time: "19:30", max_players: 12, joined: 12, skill_level: "intermediate", gender: "mixed", creator_name: "Karim El-Sayed", result_a: 3, result_b: 2 },
    { title: "Dokki Volleyball Open", sport: "Volleyball", area: "Dokki", start_time: "20:00", max_players: 12, joined: 10, skill_level: "beginner", gender: "mixed", creator_name: "Mostafa Magdy", result_a: 1, result_b: 3 },
    { title: "Agouza Beach Volleyball", sport: "Volleyball", area: "Agouza", start_time: "18:30", max_players: 12, joined: 12, skill_level: "intermediate", gender: "mixed", creator_name: "Ali Hassan", result_a: 3, result_b: 1 },
    { title: "Madinaty Volleyball Cup", sport: "Volleyball", area: "Madinaty", start_time: "21:30", max_players: 12, joined: 12, skill_level: "advanced", gender: "mixed", creator_name: "Mohamed Adel", result_a: 2, result_b: 3 },
    { title: "Weekend Football Clásico", sport: "Football", area: "New Cairo", start_time: "21:00", max_players: 14, joined: 14, skill_level: "intermediate", gender: "male", creator_name: "Omar Farouk", result_a: 5, result_b: 2 },
    { title: "Nasr City 5v5 Football", sport: "Football", area: "Nasr City", start_time: "22:00", max_players: 10, joined: 10, skill_level: "beginner", gender: "male", creator_name: "Ahmed Nabil", result_a: 4, result_b: 4 },
    { title: "Tagamo3 Football Night", sport: "Football", area: "New Cairo", start_time: "20:00", max_players: 14, joined: 14, skill_level: "advanced", gender: "male", creator_name: "Karim El-Sayed", result_a: 3, result_b: 1 },
    { title: "Dokki Sunday Kickabout", sport: "Football", area: "Dokki", start_time: "19:00", max_players: 10, joined: 9, skill_level: "beginner", gender: "male", creator_name: "Youssef Hany", result_a: 2, result_b: 1 },
    { title: "Sheraton Football Rumble", sport: "Football", area: "Mokattam", start_time: "21:30", max_players: 14, joined: 14, skill_level: "intermediate", gender: "male", creator_name: "Mostafa Magdy", result_a: 6, result_b: 3 },
    { title: "Obour Football Derby", sport: "Football", area: "Obour", start_time: "20:30", max_players: 10, joined: 10, skill_level: "intermediate", gender: "male", creator_name: "Ali Hassan", result_a: 1, result_b: 2 },
    { title: "6th October Football Bash", sport: "Football", area: "6th of October", start_time: "21:00", max_players: 14, joined: 13, skill_level: "advanced", gender: "mixed", creator_name: "Mohamed Adel", result_a: 4, result_b: 1 },
    { title: "Zayed Doubles Padel Night", sport: "Padel", area: "Sheikh Zayed", start_time: "22:00", max_players: 4, joined: 4, skill_level: "beginner", gender: "mixed", creator_name: "Youssef Hany", result_a: 2, result_b: 0 },
    { title: "New Cairo Padel Mixer", sport: "Padel", area: "New Cairo", start_time: "20:00", max_players: 4, joined: 4, skill_level: "intermediate", gender: "mixed", creator_name: "Ahmed Nabil", result_a: 2, result_b: 1 },
    { title: "October Padel Doubles", sport: "Padel", area: "6th of October", start_time: "21:00", max_players: 4, joined: 4, skill_level: "advanced", gender: "mixed", creator_name: "Omar Farouk", result_a: 1, result_b: 2 },
    { title: "Maadi Padel Round", sport: "Padel", area: "Maadi", start_time: "19:30", max_players: 4, joined: 4, skill_level: "beginner", gender: "mixed", creator_name: "Karim El-Sayed", result_a: 2, result_b: 2 },
    { title: "Katameya Padel Faceoff", sport: "Padel", area: "Katameya", start_time: "21:30", max_players: 4, joined: 4, skill_level: "intermediate", gender: "mixed", creator_name: "Mostafa Magdy", result_a: 2, result_b: 0 },
    { title: "Citystars Padel Night", sport: "Padel", area: "Nasr City", start_time: "22:30", max_players: 4, joined: 4, skill_level: "advanced", gender: "mixed", creator_name: "Ali Hassan", result_a: 0, result_b: 2 },
  ];
  return seeds.map((s, i) => ({ ...s, id: `demo-finished-${i + 1}`, game_date: day(i + 1) }));
}

function DemoFinishedGameCard({ game }: { game: DemoFinishedGame }) {
  const { t, locale, lang } = useI18n();
  return (
    <Card className="flex flex-col opacity-90 transition-all hover:-translate-y-0.5 hover:opacity-100">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-sm">{game.title}</CardTitle>
          <Badge className={`gap-1 text-[10px] ${STATUS_STYLES.completed}`}>
            <CheckCircle2 className="h-3 w-3" />
            {t("community_status_completed")}
          </Badge>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3 w-3 text-warning-ink" />
          {game.sport}
          <span>· {t(`games_gender_${game.gender}`)}</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
          <span className="truncate px-1 text-sm font-semibold">{game.creator_name}</span>
          <span className="rounded-md bg-background px-3 py-1 text-base font-black tabular-nums" dir="ltr">
            {game.result_a} – {game.result_b}
          </span>
          <span className="truncate px-1 text-sm text-muted-foreground">
            {game.sport === "Volleyball" || game.sport === "Padel" ? "Team B" : "Opponents"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {format(new Date(game.game_date + "T00:00:00"), "EEE, MMM d", { locale })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" />
            {formatTime12h(game.start_time, lang)}
          </span>
          {game.area && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{game.area}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {game.skill_level ? (
            <Badge variant="outline">{t(`skill_${game.skill_level}`)}</Badge>
          ) : (
            <Badge variant="outline">{t("community_any_level")}</Badge>
          )}
          <Badge variant="outline" className="gap-1 text-primary">
            {t(`games_gender_${game.gender}`)}
          </Badge>
        </div>
        <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span dir="ltr">{game.joined}/{game.max_players}</span>
        </p>
      </CardContent>
    </Card>
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
  const [sportFilter, setSportFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekEnd = useMemo(() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const filtered = useMemo(() => {
    const mineIds = new Set((myParticipants ?? []).map((p) => p.game_id));
    const list = (games ?? []).filter((g) => {
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
      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-800 px-5 py-7 text-white sm:px-8 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <GameCardBackground sport="basketball" />
          <div className="absolute -bottom-20 -end-16 h-72 w-72 rounded-full border-[32px] border-white/10" />
          <div className="absolute end-8 top-8 hidden -rotate-12 text-amber-300/40 sm:block">{SportIcon({ id: "volleyball", size: 110 })}</div>
        </div>
        <div className="relative max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><UsersRound className="h-4 w-4" />{lang === "ar" ? "رياضتك. فريقك. مباراتك الجاية." : "Your sport. Your people. Your next game."}</span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("games_page_title")}</h1>
          <p className="max-w-lg text-sm leading-relaxed text-violet-100 sm:text-base">{t("games_page_subtitle")}</p>
          <Button onClick={() => setDialogOpen(true)} className="min-h-11 bg-white text-violet-900 shadow-lg hover:bg-violet-50">
            <Plus className="me-2 h-4 w-4" />{t("games_create")}
          </Button>
        </div>
      </header>

      <div className="space-y-3 rounded-2xl border bg-gradient-to-br from-violet-50/70 to-blue-50/70 p-4 dark:from-violet-950/30 dark:to-blue-950/30 sm:p-5">
        <h2 className="text-base font-bold">{lang === "ar" ? "اختار رياضتك" : "Pick your sport"}</h2>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("community_sport")}>
          {["all", ...COMMUNITY_SPORTS].map(sport => <button key={sport} type="button" aria-pressed={sportFilter === sport} onClick={() => setSportFilter(sport)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sportFilter === sport ? "border-violet-700 bg-violet-700 text-white shadow-sm" : "border-border bg-background text-foreground hover:border-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950"}`}>
            {sport !== "all" && <span aria-hidden="true">{SportIcon({ id: sportToSlug(sport), size: 22 })}</span>}
            {sport === "all" ? t("community_filter_all_sports") : sport}
          </button>)}
        </div>
      </div>

      <InviteBanner
        inviteGame={inviteGame}
        inviteCode={joinCode}
        loading={inviteLoading}
        error={inviteError}
      />

      <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
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

      {gamesError && (
        <div role="alert" className="rounded-lg border border-destructive/30 p-4">
          <p>{t("common_error")}</p>
          <Button className="mt-2" variant="outline" onClick={() => {
            if (gamesError) void refetchGames();
          }}>{t("common_retry")}</Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-60 w-full" />
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <CreateGameDialog open={dialogOpen} onOpenChange={setDialogOpen} memberPlan={profile.member_plan} />

      <section className="pt-2">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success-ink" />
          <h2 className="text-lg font-bold">{t("games_recent_finished_title")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demoFinishedGames().map((g) => (
            <DemoFinishedGameCard key={g.id} game={g} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("games_recent_finished_note")}</p>
      </section>
    </div>
  );
}
