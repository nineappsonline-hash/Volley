"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Plus, Upload, Wallet, Smartphone } from "lucide-react";
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
import { COMMUNITY_SPORTS, GAME_CREATION_FEE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { MapPicker } from "@/components/shared/map-picker";
import { useCreateFriendlyGame } from "@/lib/queries";
import { errorMessage, todayInput } from "@/lib/utils";

type FeeMethod = "instapay" | "e_wallet" | "kashier";

const FEE_METHODS: {
  value: FeeMethod;
  icon: typeof Wallet;
  disabled?: boolean;
}[] = [
  { value: "instapay", icon: Smartphone },
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
  const { t } = useI18n();
  const isPro = memberPlan === "premium";
  const create = useCreateFriendlyGame();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("12");
  const [skillLevel, setSkillLevel] = useState("any");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [recurrence, setRecurrence] = useState("once");

  const [feeMethod, setFeeMethod] = useState<FeeMethod | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);

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
      setSkillLevel("any");
      setDescription("");
      setIsPublic(true);
      setRecurrence("once");
      setFeeMethod(null);
      setReceiptUrl("");
      setUploading(false);
    }
  }, [open]);

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
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
        });
      if (error) throw error;
      setReceiptUrl(path);
      toast.success(t("game_fee_receipt_ok"));
    } catch (err) {
      toast.error(t("game_fee_receipt_fail"));
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !sport || !date || !time) return;
    if (!feeMethod || feeMethod === "kashier") return;
    if (!receiptUrl) {
      toast.error(t("game_fee_receipt_required"));
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        sport,
        area: area.trim() || undefined,
        location: location.trim() || undefined,
        lat,
        lng,
        game_date: date,
        start_time: time,
        max_players: Math.max(2, Number(maxPlayers) || 12),
        skill_level: skillLevel === "any" ? undefined : skillLevel,
        description: description.trim() || undefined,
        is_public: isPublic,
        recurrence: recurrence === "weekly" ? "weekly" : null,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("community_create_title")}</DialogTitle>
          <DialogDescription>{t("community_create_desc")}</DialogDescription>
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
            <p className="text-xs text-muted-foreground">
              {t("community_recurrence_hint")}
            </p>
          </div>

          {/* Payment */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("game_fee_title")}</p>
              <span className="text-sm font-bold text-primary">
                {GAME_CREATION_FEE} EGP
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("game_fee_desc")}
            </p>
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
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">
                      {t(`game_fee_method_${value}`)}
                    </span>
                    {disabled && (
                      <span className="text-[9px] text-muted-foreground">
                        {t("game_fee_kashier_soon")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {feeMethod && feeMethod !== "kashier" && (
              <div className="space-y-2">
                <Label>{t("game_fee_receipt")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    disabled={uploading}
                  />
                  {uploading && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {receiptUrl && !uploading && (
                    <Upload className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("game_fee_receipt_hint")}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <Plus className="me-1 h-4 w-4" />
            {create.isPending
              ? t("common_saving")
              : t("game_fee_pay").replace(
                  "{amount}",
                  String(GAME_CREATION_FEE)
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}