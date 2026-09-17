"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { COMMUNITY_SPORTS, getDefaultMinPlayers, getBillablePlayers, formatMoney } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { QueryState } from "@/components/shared/query-state";
import { PlaygroundPicker } from "@/components/shared/playground-picker";
import {
  PlaygroundLocationFilters,
  type PlaygroundLocationSelection,
} from "@/components/shared/playground-location-filters";
import { MapPicker } from "@/components/shared/map-picker";
import { useCreateFriendlyGame, usePlaygrounds, usePayGameShare, usePayRentRemaining } from "@/lib/queries";
import { GameSharePayment } from "@/components/games/game-share-payment";
import { CourtRentInfoDialog } from "@/components/games/court-rent-info-dialog";
import { errorMessage, todayInput } from "@/lib/utils";

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
  const [playgroundId, setPlaygroundId] = useState("");

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
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("12");
  const [minPlayers, setMinPlayers] = useState("2");
  const [duration, setDuration] = useState("1");
  const [skillLevel, setSkillLevel] = useState("any");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [recurrence, setRecurrence] = useState("once");

  // When the sport is chosen, pre-fill minimum players with the sport default.
  useEffect(() => {
    setMinPlayers(String(getDefaultMinPlayers(sport)));
  }, [sport]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSport("");
      setArea("");
      setLocation("");
      setLat(null);
      setLng(null);
      setDate(todayInput());
      setTime("");
      setMaxPlayers("12");
      setPlaygroundId("");
      setMinPlayers("2");
      setDuration("1");
      setSkillLevel("any");
      setDescription("");
      setIsPublic(true);
      setRecurrence("once");
      setCreatedGame(null);
      setShowRentInfo(false);
      setSharePaid(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!Number.isInteger(Number(minPlayers)) || !Number.isInteger(Number(maxPlayers)) || Number(minPlayers) < 2 || Number(maxPlayers) < Number(minPlayers) || !Number.isFinite(Number(duration)) || Number(duration) <= 0 || Number(duration) > 24) {
      toast.error(lang === "ar" ? "راجع الحد الأدنى والأقصى للاعبين والمدة (أكتر من صفر ولحد 24 ساعة)." : "Check player limits and duration (greater than zero, up to 24 hours)."); return;
    }
    if (!title.trim() || !sport || !date || !time) return;
    try {
      const id = await create.mutateAsync({
        title: title.trim(),
        sport,
        area: area.trim() || undefined,
        location: location.trim() || undefined,
        lat,
        lng,
        game_date: date,
        start_time: time,
        playgroundId: playgroundId || null,
        max_players: Number(maxPlayers),
        min_players: Number(minPlayers),
        duration_hours: Number(duration),
        skill_level: skillLevel === "any" ? undefined : skillLevel,
        description: description.trim() || undefined,
        is_public: isPublic,
        recurrence: recurrence === "weekly" ? "weekly" : null,
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
      const pickedPlayground = playgrounds?.find((p) => p.id === playgroundId);
      if (pickedPlayground?.rental_cost != null) {
        const billable = getBillablePlayers(sport, Number(minPlayers) || 2);
        const rent = pickedPlayground.rental_cost * (Number(duration) || 1);
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
      if ((createdGame?.remaining ?? 0) > 0) {
        setSharePaid(true);
        setShowRentInfo(true);
      } else {
        setCreatedGame(null);
        onOpenChange(false);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("community_create_title")}</DialogTitle>
          <DialogDescription>{t("community_create_desc")}</DialogDescription>
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
              label={t("games_share_per_player")}
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
                  <SelectValue placeholder={t("community_sport")} />
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
                  <SelectItem value="beginner">
                    {t("skill_beginner")}
                  </SelectItem>
                  <SelectItem value="intermediate">
                    {t("skill_intermediate")}
                  </SelectItem>
                  <SelectItem value="advanced">
                    {t("skill_advanced")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("community_area")}</Label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={t("community_area_ph")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("community_location")}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("community_location_ph")}
              />
            </div>
          </div>

          <MapPicker
            lat={lat}
            lng={lng}
            onChange={(loc) => {
              setLat(loc.lat);
              setLng(loc.lng);
              if (loc.label) setLocation(loc.label);
            }}
            hint={t("community_map_hint")}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{lang === "ar" ? "الحد الأدنى للاعبين" : "Minimum players"}</Label><div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-bold">{minPlayers}</div></div>
            <div className="space-y-2"><Label htmlFor="game-duration">{lang === "ar" ? "مدة الجيم بالساعات" : "Duration (hours)"}</Label><Input id="game-duration" type="number" min="0.5" max="24" step="0.5" value={duration} onChange={e => setDuration(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="community-playground">{lang === "ar" ? "الملعب" : "Playground"}</Label>
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
            </QueryState></div>
          <GameCostEstimate rate={playgrounds?.find(p => p.id === playgroundId)?.rental_cost} hours={Number(duration)} min={Number(minPlayers)} sport={sport} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>{t("community_date")}</Label>
              <Input
                type="date"
                dir="ltr"
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
                dir="ltr"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
            <div className="space-y-2" />
          </div>

          <div className="space-y-2">
            <Label>{t("community_description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("community_description_ph")}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  id="game-public"
                />
                <Label htmlFor="game-public">{t("community_public")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("community_public_hint")}
              </p>
            </div>
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
<p className="text-xs text-muted-foreground">
              {isPro
                ? t("community_recurrence_hint")
                : t("community_recurrence_pro")}
            </p>
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
                {create.isPending ? t("common_saving") : t("community_create")}
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