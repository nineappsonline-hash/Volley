"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Camera,
  Check,
  Copy,
  Crown,
  Link2,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { LocationFields } from "@/components/shared/location-fields";
import { MapPicker } from "@/components/shared/map-picker";
import { AcademyTrainingPrices } from "./academy-training-prices";
import { BranchesCard } from "@/components/settings/branches-card";
import { AcademyMediaManager } from "@/components/media/academy-media-manager";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useAcademy, useUpdateAcademy } from "@/lib/queries";

export function SettingsClient({
  isAdmin,
  canDelete = true,
}: {
  isAdmin: boolean;
  canDelete?: boolean;
}) {
  const { t, lang } = useI18n();
  const academyQuery = useAcademy();
  const { data: academy, isLoading, isError } = academyQuery;
  const update = useUpdateAcademy();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [area, setArea] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [slug, setSlug] = useState("");
  const [sessionBooking, setSessionBooking] = useState(false);
  const [platformFee, setPlatformFee] = useState("5");
  const [copied, setCopied] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (academy) {
      setName(academy.name);
      setDescription(academy.description ?? "");
      setAddress(academy.address ?? "");
      setCountry(academy.country ?? "");
      setGovernorate(academy.governorate ?? "");
      setArea(academy.area ?? "");
      setLat(academy.lat ?? null);
      setLng(academy.lng ?? null);
      setCoverUrl(academy.cover_url ?? null);
      setIsPublic(academy.is_public ?? false);
      setSlug(academy.slug ?? "");
      setSessionBooking(academy.session_booking_enabled ?? false);
      setPlatformFee(String(academy.platform_fee_percent ?? 5));
    }
  }, [academy]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("settings_title")} subtitle={t("settings_subtitle")} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) return <div role="alert" className="space-y-3"><p>{t("common_error")}</p><Button onClick={() => void academyQuery.refetch()}>{t("common_retry")}</Button></div>;
  if (!academy) return <div role="status" className="rounded-xl border p-6">{lang === "ar" ? "حسابك مش مرتبط بأكاديمية. تواصل مع الدعم لتصحيح بيانات الحساب." : "Your account is not linked to an academy. Contact support to correct your account."}</div>;

  const publicUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/a/${slug}`
      : "";
  const calendarUrl =
    typeof window !== "undefined" && academy.calendar_token
      ? `${window.location.origin}/api/calendar/${academy.calendar_token}`
      : "";

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      const fee = platformFee.trim() === "" ? 5 : Number(platformFee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 100) throw new Error(lang === "ar" ? "النسبة لازم تكون من ٠ إلى ١٠٠" : "Fee must be between 0 and 100 percent");
      await update.mutateAsync({
        id: academy.id,
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        country: country.trim() || null,
        governorate: governorate.trim() || null,
        area: area.trim() || null,
        lat,
        lng,
        cover_url: coverUrl || null,
        is_public: isPublic,
        slug: slug.trim() || null,
        session_booking_enabled: sessionBooking,
        platform_fee_percent: fee,
      });
      toast.success(t("settings_saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `covers/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("session-photos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("session-photos")
        .getPublicUrl(filePath);
      setCoverUrl(urlData.publicUrl);
      toast.success(t("settings_cover_upload"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(t("cal_copied"));
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings_title")} subtitle={t("settings_subtitle")}>
        <Button onClick={handleSave} disabled={update.isPending || !name.trim()}>
          <Save className="h-4 w-4" />
          {update.isPending ? t("common_saving") : t("common_save")}
        </Button>
      </PageHeader>
      {isAdmin && <AcademyTrainingPrices academy={academy} />}

      <Card id="settings-academy-info" className="scroll-mt-24">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-4 w-4 text-primary" />
            {t("settings_academy_info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("signup_new_academy_name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("teams_description")}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("settings_public_hint")}
            />
          </div>
          <LocationFields
            country={country}
            governorate={governorate}
            city={area}
            onCountryChange={setCountry}
            onGovernorateChange={setGovernorate}
            onCityChange={setArea}
          />
          <div className="space-y-2">
            <Label>{t("settings_address")}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("directory_no_address")}
            />
          </div>
          <MapPicker
            lat={lat}
            lng={lng}
            onChange={(loc) => {
              setLat(loc.lat);
              setLng(loc.lng);
              if (loc.label) setAddress(loc.label);
            }}
            hint={t("settings_map_hint")}
          />
          <div className="space-y-2">
            <Label>{t("settings_cover_photo")}</Label>
            {coverUrl ? (
              <div className="relative overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={t("settings_cover_photo")}
                  className="aspect-video w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={t("settings_cover_remove")}
                  onClick={() => setCoverUrl(null)}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {t("settings_cover_hint")}
                </p>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
            >
              <Upload className="h-4 w-4" />
              {uploadingCover ? t("photos_uploading") : t("settings_cover_upload")}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              id="public-toggle"
            />
            <Label htmlFor="public-toggle" className="cursor-pointer text-sm">
              {t("settings_public_toggle")}
            </Label>
          </div>
          {isPublic && (
            <p className="rounded-md bg-interactive-50 p-3 text-xs text-info-ink ">
              {t("settings_public_hint")}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t("settings_slug")}</Label>
            <div className="flex items-center gap-2">
              <Input
                dir="ltr"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="my-academy"
              />
              {publicUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("cal_copy")}
                  onClick={() => copy(publicUrl, "public")}
                >
                  {copied === "public" ? (
                    <Check className="h-4 w-4 text-success-ink" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                dir="ltr"
              >
                <Link2 className="h-3 w-3" />
                {publicUrl}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <BranchesCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            {t("settings_media_title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("settings_media_subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <AcademyMediaManager />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invite code */}
        <Card id="settings-invite" className="scroll-mt-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("settings_invite_code")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings_invite_hint")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input dir="ltr" readOnly value={academy.invite_code} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("cal_copy")}
                onClick={() => copy(academy.invite_code, "invite")}
              >
                {copied === "invite" ? (
                  <Check className="h-4 w-4 text-success-ink" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Session booking */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {t("settings_session_booking")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings_session_booking_hint")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={sessionBooking}
                onCheckedChange={setSessionBooking}
                id="session-booking-toggle"
                disabled={academy.plan !== "elite"}
              />
              <Label htmlFor="session-booking-toggle" className="cursor-pointer text-sm">
                {t("settings_session_booking_toggle")}
              </Label>
            </div>
            {academy.plan !== "elite" && (
              <div className="rounded-lg border border-attention-300/60 bg-attention-50 p-3 text-xs text-warning-ink ">
                <p className="flex items-center gap-1.5 font-medium">
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  {t("settings_booking_elite_only")}
                </p>
                <p className="mt-1">{t("settings_booking_elite_hint")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1 border-attention-400/60 text-warning-ink hover:bg-attention-100 "
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = "/upgrade";
                    }
                  }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  {t("premium_upgrade_cta")}
                </Button>
              </div>
            )}
            {sessionBooking && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("settings_platform_fee")}</Label>
                  <span className="font-mono font-medium">
                    {platformFee}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>10%</span>
                  <span>20%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings_platform_fee_hint")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {t("settings_calendar_feed")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings_calendar_hint")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input dir="ltr" readOnly value={calendarUrl} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("cal_copy")}
                onClick={() => copy(calendarUrl, "cal")}
              >
                {copied === "cal" ? (
                  <Check className="h-4 w-4 text-success-ink" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {canDelete && <DeleteAccountCard isAdmin={isAdmin} />}
    </div>
  );
}
