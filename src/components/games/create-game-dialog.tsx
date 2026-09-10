"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  CreditCard,
  LandPlot,
  Link as LinkIcon,
  Loader2,
  Plus,
  Upload,
  Users,
  Wallet,
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
import {
  COMMUNITY_SPORTS,
  E_WALLET_NUMBER,
  GAME_CREATION_FEE,
  INSTAPAY_LINK,
} from "@/lib/constants";
import { GameCostEstimate } from "@/components/games/game-cost-estimate";
import { PlaygroundPicker } from "@/components/shared/playground-picker";
import { createClient } from "@/lib/supabase/client";
import { useCreateFriendlyGame, usePlaygrounds } from "@/lib/queries";
import { errorMessage, todayInput } from "@/lib/utils";

type FeeMethod = "instapay" | "e_wallet" | "kashier";

const FEE_METHODS: { value: FeeMethod; icon: typeof Wallet; disabled?: boolean }[] = [
  { value: "instapay", icon: LinkIcon },
  { value: "e_wallet", icon: Wallet },
  { value: "kashier", icon: CreditCard, disabled: true },
];

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
  const { data: playgrounds } = usePlaygrounds();
  const supabase = createClient();

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

  const [feeMethod, setFeeMethod] = useState<FeeMethod | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
      setFeeMethod(null);
      setReceiptUrl("");
      setUploading(false);
    }
  }, [open]);

  const selectedPlayground = playgrounds?.find((p) => p.id === playgroundId);

  const uploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("game-fee-receipts")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      setReceiptUrl(path);
      toast.success(t("game_fee_receipt_ok"));
    } catch {
      toast.error(t("game_fee_receipt_fail"));
    } finally {
      setUploading(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    if (!Number.isInteger(Number(minPlayers)) || !Number.isInteger(Number(maxPlayers)) || Number(minPlayers) < 2 || Number(maxPlayers) < Number(minPlayers) || !Number.isFinite(Number(duration)) || Number(duration) <= 0 || Number(duration) > 24) {
      toast.error(lang === "ar" ? "راجع الحد الأدنى والأقصى للاعبين والمدة (أكتر من صفر ولحد 24 ساعة)." : "Check player limits and duration (greater than zero, up to 24 hours)."); return;
    }
    if (!title.trim() || !sport || !date || !time) return;
    if (!feeMethod || feeMethod === "kashier") return;
    if (!receiptUrl) {
      toast.error(t("game_fee_receipt_required"));
      return;
    }
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
        fee_method: feeMethod,
        fee_receipt_url: receiptUrl,
      });
      toast.success(t("community_created"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadReceipt(file);
  };

  const canSubmit =
    !!title.trim() &&
    !!sport &&
    !!date &&
    !!time &&
    !!feeMethod &&
    feeMethod !== "kashier" &&
    !!receiptUrl &&
    !uploading &&
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
            <PlaygroundPicker
              value={playgroundId}
              onChange={setPlaygroundId}
              playgrounds={playgrounds ?? []}
            />
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
          <GameCostEstimate rate={playgrounds?.find(p => p.id === playgroundId)?.rental_cost} hours={Number(duration)} min={Number(minPlayers)} max={Number(maxPlayers)} />
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

          {/* Payment */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("game_fee_title")}</p>
              <span className="text-sm font-bold text-primary">
                {GAME_CREATION_FEE} {t("currency_egp")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("game_fee_desc").replace("{amount}", String(GAME_CREATION_FEE))}</p>

            <div className="grid grid-cols-3 gap-2">
              {FEE_METHODS.map(({ value, icon: Icon, disabled }) => {
                const selected = feeMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setFeeMethod(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">{t(`game_fee_method_${value}`)}</span>
                    {disabled && (
                      <span className="text-[9px] text-muted-foreground">
                        {t("game_fee_kashier_soon")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {feeMethod === "instapay" && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{t("checkout_instapay_link")}</p>
                  <p className="truncate text-sm font-medium text-primary">{INSTAPAY_LINK}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <a href={INSTAPAY_LINK} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="h-3.5 w-3.5" />
                      {t("checkout_open_link")}
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => copy("instapay", INSTAPAY_LINK)}>
                    {copied === "instapay" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {t("checkout_copy")}
                  </Button>
                </div>
              </div>
            )}
            {feeMethod === "e_wallet" && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t("checkout_e_wallet_number")}</p>
                  <p className="text-lg font-extrabold text-primary" dir="ltr">{E_WALLET_NUMBER}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => copy("ewallet", E_WALLET_NUMBER)}>
                  {copied === "ewallet" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {t("checkout_copy")}
                </Button>
              </div>
            )}

            {feeMethod && feeMethod !== "kashier" && (
              <div className="space-y-2">
                <Label>{t("game_fee_receipt")}</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
                  {uploading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                  {receiptUrl && !uploading && <Upload className="h-4 w-4 shrink-0 text-success-ink" />}
                </div>
                <p className="text-xs text-muted-foreground">{t("game_fee_receipt_hint")}</p>
              </div>
            )}

            {feeMethod && feeMethod !== "kashier" && (
              <p className="rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 text-[11px] text-warning-ink dark:bg-attention-500/10 dark:text-attention-300">
                {t("games_autolive_note")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <Plus className="me-1 h-4 w-4" />
            {create.isPending ? t("common_saving") : t("game_fee_pay").replace("{amount}", String(GAME_CREATION_FEE))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}