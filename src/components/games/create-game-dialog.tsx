"use client";

import { useEffect, useState } from "react";
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
import { COMMUNITY_SPORTS } from "@/lib/constants";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { QueryState } from "@/components/shared/query-state";
import { PlaygroundPicker } from "@/components/shared/playground-picker";
import { useCreateFriendlyGame, useFriendlyGames, usePlaygrounds } from "@/lib/queries";
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
  const playgroundQuery = usePlaygrounds();
  const { data: playgrounds } = playgroundQuery;
  const { data: allGames } = useFriendlyGames();

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
        const label = dayWorkingHoursLabel(workingHours, date);
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
      await create.mutateAsync({
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
      toast.success(t("community_created"));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("games_create_title")}</DialogTitle>
          <DialogDescription>{t("games_create_desc")}</DialogDescription>
        </DialogHeader>

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
              <Select value={sport} onValueChange={setSport}>
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
            <PlaygroundPicker
              value={playgroundId}
              onChange={setPlaygroundId}
              playgrounds={playgrounds ?? []}
            />
            </QueryState>
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
            <div className="space-y-2"><Label htmlFor="game-min-players">{lang === "ar" ? "الحد الأدنى للاعبين" : "Minimum players"}</Label><Input id="game-min-players" type="number" min="2" step="1" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="game-duration">{lang === "ar" ? "مدة الجيم بالساعات" : "Duration (hours)"}</Label><Input id="game-duration" type="number" min="0.01" max="24" step="0.25" value={duration} onChange={e => setDuration(e.target.value)} /></div>
          </div>
          <GameCostEstimate rate={playgrounds?.find(p => p.id === playgroundId)?.rental_cost} hours={Number(duration)} min={Number(minPlayers)} hostPays={hostPays} />

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <Plus className="me-1 h-4 w-4" />
            {create.isPending ? t("common_saving") : t("games_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}