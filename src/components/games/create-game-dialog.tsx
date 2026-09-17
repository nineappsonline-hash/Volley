"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  LandPlot,
  Plus,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { normalizeCountry } from "@/lib/locations";
import { COMMUNITY_SPORTS, getDefaultMinPlayers, getBillablePlayers, formatMoney, getSportMinPlayers } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { QueryState } from "@/components/shared/query-state";
import { PlaygroundPicker } from "@/components/shared/playground-picker";
import { PlaygroundAvailabilityCalendar } from "@/components/shared/playground-availability-calendar";
import {
  PlaygroundLocationFilters,
  type PlaygroundLocationSelection,
} from "@/components/shared/playground-location-filters";
import { useCreateFriendlyGame, useFriendlyGames, usePlaygrounds, usePayGameShare, usePayRentRemaining, useSportSettings } from "@/lib/queries";
import { GameSharePayment } from "@/components/games/game-share-payment";
import { CourtRentInfoDialog } from "@/components/games/court-rent-info-dialog";
import { errorMessage, todayInput } from "@/lib/utils";
import { dayWorkingHoursLabel, findBlockedOverlap, formatBlockedSlot, isWithinWorkingHours, timeSlotsOverlap } from "@/lib/venue-slots";
import type { Dict } from "@/lib/i18n/dictionary";

export function CreateGameDialog({
  open,
  onOpenChange,
  memberPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberPlan?: "free" | "premium";
}) {
  const { t, lang } = useI18n();
  const isPro = memberPlan === "premium";
  const create = useCreateFriendlyGame();
  const pay = usePayGameShare();
  const rentPay = usePayRentRemaining();
  const playgroundQuery = usePlaygrounds();
  const { data: playgrounds } = playgroundQuery;
  const { data: allGames } = useFriendlyGames();
  const { data: sportMinOverrides } = useSportSettings();

  // Once the game row exists (created freely by the RPC) the creator must pay
  // their own share before the dialog closes; backing out cancels the draft.
  const [createdGame, setCreatedGame] = useState<{ id: string; amount: number; remaining: number; inviteCode: string | null } | null>(null);
  const [showRentInfo, setShowRentInfo] = useState(false);
  const [sharePaid, setSharePaid] = useState(false);

  // The member's chosen location (country → governorate → city/area). It starts
  // filtered to the signed-in user's signup country, and the playground list is
  // narrowed to matching playgrounds below.
  const [pickLocation, setPickLocation] = useState<PlaygroundLocationSelection>({
    country: "all",
    governorate: "all",
    area: "all",
  });

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        const raw = user?.user_metadata?.country as string | undefined;
        if (!stale) {
          setPickLocation((l) => ({
            ...l,
            country: raw?.trim() ? normalizeCountry(raw.trim()) : "Egypt",
          }));
        }
      } catch {
        if (!stale) setPickLocation((l) => ({ ...l, country: "Egypt" }));
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const locatedPlaygrounds = useMemo(() => {
    const { country, governorate, area } = pickLocation;
    return (playgrounds ?? []).filter(
      (p) =>
        (country === "all" || normalizeCountry(p.country ?? "") === country) &&
        (governorate === "all" || p.governorate === governorate) &&
        (area === "all" || p.area === area),
    );
  }, [playgrounds, pickLocation]);

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [playgroundId, setPlaygroundId] = useState<string>("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("12");
  const [minPlayers, setMinPlayers] = useState("2");
  const [duration, setDuration] = useState("1");
  const [skillLevel, setSkillLevel] = useState("any");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [recurrence, setRecurrence] = useState("once");

  const [gender, setGender] = useState<"male" | "female" | "mixed">("mixed");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [hostPays, setHostPays] = useState(false);

  // When the sport is chosen (or the platform-wide minimums load), pre-fill
  // minimum players with the effective sport default (super-admin override
  // first, then the built-in constant).
  useEffect(() => {
    setMinPlayers(String(getSportMinPlayers(sport, sportMinOverrides)));
  }, [sport, sportMinOverrides]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSport("");
      setPlaygroundId("");
      setArea("");
      setLocation("");
      setDate(todayInput());
      setTime("");
      setMaxPlayers("12");
      setMinPlayers("2");
      setDuration("1");
      setSkillLevel("any");
      setDescription("");
      setIsPublic(true);
      setRecurrence("once");
      setGender("mixed");
      setMinAge("");
      setMaxAge("");
      setHostPays(false);
      setCreatedGame(null);
      setShowRentInfo(false);
      setSharePaid(false);
    }
  }, [open]);

  const selectedPlayground = playgrounds?.find((p) => p.id === playgroundId);

  const workingHours = selectedPlayground?.working_hours ?? [];
  const outsideWorkingHours =
    !!selectedPlayground &&
    !!date &&
    !!time &&
    workingHours.length > 0 &&
    !isWithinWorkingHours(workingHours, date, time, Number(duration) || 1);
  const workingHoursWarning = outsideWorkingHours
    ? (() => {
        const label = dayWorkingHoursLabel(workingHours, date, lang);
        return label ? t("wh_outside").replace("{hours}", label) : t("wh_closed_day");
      })()
    : null;

  const blockedSlot = (() => {
    if (!selectedPlayground?.unavailable_slots?.length || !date || !time) return null;
    return findBlockedOverlap(selectedPlayground.unavailable_slots, date, time, Number(duration) || 1);
  })();

  const gameCourt = (() => {
    if (!selectedPlayground || !date || !time) return { court: 0, courtCount: 1 };
    const courtCount = selectedPlayground.court_count ?? 1;
    const durationH = Number(duration) || 1;
    for (let court = 1; court <= courtCount; court++) {
      const taken = (allGames ?? []).some((g) => {
        if (g.playground_id !== playgroundId || g.game_date !== date) return false;
        if ((g.court_number ?? 1) !== court) return false;
        return timeSlotsOverlap(time, durationH, g.start_time, Number(g.duration_hours) || 1);
      });
      if (!taken) return { court, courtCount };
    }
    return { court: 0, courtCount };
  })();
  const gamesBooked = gameCourt.court === 0 && !!selectedPlayground && !!date && !!time;

  const handleCreate = async () => {
    if (!Number.isInteger(Number(minPlayers)) || !Number.isInteger(Number(maxPlayers)) || Number(minPlayers) < 2 || Number(maxPlayers) < Number(minPlayers) || !Number.isFinite(Number(duration)) || Number(duration) <= 0 || Number(duration) > 24) {
      toast.error(lang === "ar" ? "راجع الحد الأدنى والأقصى للاعبين والمدة (أكتر من صفر ولحد 24 ساعة)." : "Check player limits and duration (greater than zero, up to 24 hours)."); return;
    }
    if (!title.trim() || !sport || !date || !time) return;
    const min = minAge.trim() === "" ? null : Number(minAge);
    const max = maxAge.trim() === "" ? null : Number(maxAge);
    if ((min != null && (min < 0 || min > 120)) || (max != null && (max < 0 || max > 120))) {
      toast.error(t("games_age_invalid"));
      return;
    }
    if (min != null && max != null && min > max) {
      toast.error(t("games_age_invalid"));
      return;
    }
    if (blockedSlot) {
      toast.error(t("unavail_blocked_msg").replace("{slot}", formatBlockedSlot(blockedSlot, d => t(`avail_day_${d}` as keyof Dict))));
      return;
    }
    if (outsideWorkingHours) {
      toast.error(workingHoursWarning ?? t("wh_closed_day"));
      return;
    }
    if (gamesBooked) {
      toast.error(t("games_all_booked").replace("{count}", String(gameCourt.courtCount)));
      return;
    }
    try {
      const id = await create.mutateAsync({
        title: title.trim(),
        sport,
        playgroundId: playgroundId || null,
        area: playgroundId ? undefined : area.trim() || undefined,
        location: playgroundId ? undefined : location.trim() || undefined,
        game_date: date,
        start_time: time,
        max_players: Number(maxPlayers),
        min_players: Number(minPlayers),
        duration_hours: Number(duration),
        skill_level: skillLevel === "any" ? undefined : skillLevel,
        description: description.trim() || undefined,
        is_public: isPublic,
        recurrence: recurrence === "weekly" ? "weekly" : null,
        gender,
        min_age: min,
        max_age: max,
        hostPays,
      });
      let amount = 20;
      let remaining = 0;
      try {
        const { data: part } = await createClient()
          .from("friendly_game_participants")
          .select("share_amount")
          .eq("game_id", id)
          .eq("role", "organizer")
          .single();
        if (part?.share_amount != null) amount = part.share_amount;
      } catch {
        /* keep the fallback amount */
      }
      if (!hostPays && selectedPlayground?.rental_cost != null) {
        const billable = getBillablePlayers(sport, Number(minPlayers) || 2);
        const rent = selectedPlayground.rental_cost * (Number(duration) || 1);
        // The creator just covers their own share; the rest is still outstanding.
        remaining = Math.max(0, Math.round((rent * (billable - 1)) / billable * 100) / 100);
      }
      let inviteCode: string | null = null;
      try {
        const { data: created } = await createClient()
          .from("friendly_games")
          .select("invite_code")
          .eq("id", id)
          .single();
        inviteCode = created?.invite_code ?? null;
      } catch {
        /* keep the fallback null code */
      }
      setCreatedGame({ id, amount, remaining, inviteCode });
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const cancelCreatedGame = async (gameId: string) => {
    try {
      await createClient().rpc("cancel_friendly_game", { p_game_id: gameId });
    } catch {
      /* best effort — the draft is already created */
    }
  };

  const handlePay = async (payMethod: "instapay" | "e_wallet", payReceiptUrl: string) => {
    const gameId = createdGame?.id;
    if (!gameId) return;
    try {
      await pay.mutateAsync({ gameId, payMethod, payReceiptUrl });
      toast.success(t("games_share_submitted"));
      if (hostPays || (createdGame?.remaining ?? 0) <= 0) {
        setCreatedGame(null);
        onOpenChange(false);
      } else {
        setSharePaid(true);
        setShowRentInfo(true);
      }
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handlePayRemaining = async (payMethod: "instapay" | "e_wallet", payReceiptUrl: string) => {
    const gameId = createdGame?.id;
    if (!gameId) return;
    try {
      await rentPay.mutateAsync({ gameId, payMethod, payReceiptUrl });
      toast.success(t("games_rent_submitted"));
      setCreatedGame(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const canSubmit =
    !!title.trim() &&
    !!sport &&
    !!date &&
    !!time &&
    !blockedSlot &&
    !outsideWorkingHours &&
    !gamesBooked &&
    !create.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => {
        if (!next && createdGame && !pay.isPending && !sharePaid) {
          void cancelCreatedGame(createdGame.id);
          setCreatedGame(null);
        }
        onOpenChange(next);
      }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("games_create_title")}</DialogTitle>
          <DialogDescription>{t("games_create_desc")}</DialogDescription>
        </DialogHeader>

        {createdGame ? (
          sharePaid ? (
            <>
              <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                {t("games_rent_card_hint")}
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {t("games_rent_button")}
                </p>
                <span className="shrink-0 text-lg font-extrabold text-primary">
                  {formatMoney(createdGame.remaining, lang)}
                </span>
              </div>
              <GameSharePayment
                amount={createdGame.remaining}
                label={t("games_rent_label")}
                submitting={rentPay.isPending}
                submitLabel={t("games_rent_submit_button")}
                onPay={handlePayRemaining}
              />
            </>
          ) : (
            <GameSharePayment
              amount={createdGame.amount}
              label={hostPays ? t("games_host_pays") : t("games_share_per_player")}
              submitting={pay.isPending}
              onPay={handlePay}
            />
          )
        ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("community_game_title")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("community_game_title_ph")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("community_sport")}</Label>
              <Select value={sport} onValueChange={(next) => { setSport(next); setPlaygroundId(""); }}>
                <SelectTrigger aria-label={t("community_sport")}>
                  <SelectValue placeholder={t("games_select_sport")} />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_SPORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("community_skill_level")}</Label>
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger aria-label={t("community_skill_level")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("community_any_level")}</SelectItem>
                  <SelectItem value="beginner">{t("skill_beginner")}</SelectItem>
                  <SelectItem value="intermediate">{t("skill_intermediate")}</SelectItem>
                  <SelectItem value="advanced">{t("skill_advanced")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LandPlot className="h-3.5 w-3.5 text-primary" />
              {t("games_playground")}
            </Label>
            <QueryState queries={[playgroundQuery]}>
            <PlaygroundLocationFilters
              venues={playgrounds ?? []}
              value={pickLocation}
              onChange={(next) => {
                setPickLocation(next);
                setPlaygroundId("");
              }}
            />
            <PlaygroundPicker
              sport={sport}
              value={playgroundId}
              onChange={setPlaygroundId}
              playgrounds={locatedPlaygrounds}
            />
            </QueryState>
          {selectedPlayground && (
            <PlaygroundAvailabilityCalendar
              unavailableSlots={selectedPlayground.unavailable_slots}
              workingHours={selectedPlayground.working_hours}
              selectedDate={date || undefined}
              onSelectDate={setDate}
            />
          )}
            {!selectedPlayground && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("community_area")}</Label>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={t("community_area_ph")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("community_location")}</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("community_location_ph")}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{lang === "ar" ? "الحد الأدنى للاعبين" : "Minimum players"}</Label><div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-bold">{minPlayers}</div></div>
            <div className="space-y-2"><Label htmlFor="game-duration">{lang === "ar" ? "مدة الجيم بالساعات" : "Duration (hours)"}</Label><Input id="game-duration" type="number" min="0.5" max="24" step="0.5" value={duration} onChange={e => setDuration(e.target.value)} /></div>
          </div>
          <GameCostEstimate rate={playgrounds?.find(p => p.id === playgroundId)?.rental_cost} hours={Number(duration)} min={Number(minPlayers)} hostPays={hostPays} sport={sport} />

          {/* Who pays */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Switch checked={hostPays} onCheckedChange={setHostPays} id="game-host-pays" />
                <Label htmlFor="game-host-pays">{t("games_host_pays")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("games_host_pays_hint")}
              </p>
            </div>
            <Badge variant={hostPays ? "success" : "secondary"}>
              {hostPays ? t("games_host_pays_on") : t("games_host_pays_off")}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>{t("community_date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  min={todayInput()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("community_time")}</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("community_max_players")}</Label>
                <Input
                  type="number"
                  min="2"
                  max="30"
                  dir="ltr"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                />
              </div>
              <div className="space-y-2" />
            </div>

            {blockedSlot && (
              <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("unavail_inline").replace("{slot}", formatBlockedSlot(blockedSlot, (d) => t(`avail_day_${d}` as keyof Dict)))}
              </p>
            )}
            {outsideWorkingHours && (
              <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {workingHoursWarning}
              </p>
            )}
            {gamesBooked && (
              <p className="flex items-center gap-1.5 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("games_all_booked").replace("{count}", String(gameCourt.courtCount))}
              </p>
            )}
            {!gamesBooked && !!selectedPlayground && !!date && !!time && gameCourt.court > 0 && (
              <p className="flex items-center gap-1.5 rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("games_court_preview").replace("{court}", String(gameCourt.court))}
              </p>
            )}

          <div className="space-y-2">
            <Label>{t("community_description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("community_description_ph")}
              rows={2}
            />
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} id="game-public" />
                <Label htmlFor="game-public">{t("games_visibility")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {isPublic ? t("games_public_hint") : t("games_private_hint")}
              </p>
            </div>
            <Badge variant={isPublic ? "success" : "secondary"}>
              {isPublic ? t("games_public") : t("games_private")}
            </Badge>
          </div>

          {/* Who can join */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" />
              {t("games_criteria_title")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("games_gender")}</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger aria-label={t("games_gender")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">{t("games_gender_mixed")}</SelectItem>
                    <SelectItem value="male">{t("games_gender_male")}</SelectItem>
                    <SelectItem value="female">{t("games_gender_female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("games_min_age")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  dir="ltr"
                  placeholder={t("games_any_age")}
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("games_max_age")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  dir="ltr"
                  placeholder={t("games_any_age")}
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("games_criteria_hint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("community_recurrence")}</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger aria-label={t("community_recurrence")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">{t("community_once")}</SelectItem>
                <SelectItem value="weekly" disabled={!isPro}>
                  {t("community_weekly")}
                  {!isPro && ` · ${t("mplan_tier_pro")}`}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        )}

        <DialogFooter>
          {createdGame ? (
            sharePaid ? (
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedGame(null);
                  onOpenChange(false);
                }}
              >
                {t("games_rent_skip")}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  if (createdGame && !pay.isPending) {
                    void cancelCreatedGame(createdGame.id);
                    setCreatedGame(null);
                  }
                  onOpenChange(false);
                }}
              >
                {t("common_cancel")}
              </Button>
            )
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common_cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit}>
                <Plus className="me-1 h-4 w-4" />
                {create.isPending ? t("common_saving") : t("games_create")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CourtRentInfoDialog
      open={showRentInfo}
      onOpenChange={setShowRentInfo}
      shareLink={createdGame?.inviteCode ? `${window.location.origin}/games?join=${createdGame.inviteCode}` : null}
    />
    </>
  );
}