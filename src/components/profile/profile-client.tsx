"use client";

import { AcademySuggestionOnboarding } from "@/components/academies/academy-suggestion-onboarding";
import { QueryState } from "@/components/shared/query-state";
import { useMemberTraining } from "@/lib/use-member-training";
import { trainingPaymentHistory, bookingBalance } from "@/lib/member-training";
import { MemberTrainingPreview } from "@/components/dashboard/member-training-preview";

import { AvatarCropDialog } from "./avatar-crop-dialog";
import { TrainingGoals, TrainingRenewal } from "@/components/workflows/player-workflows";
import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Image from "next/image";
import { toast } from "sonner";
import {
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  Crown,
  Flame,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings as SettingsIcon,
  SmilePlus,
  Swords,
  Dices,
  Check,
  Timer,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UsernameField } from "@/components/shared/username-field";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { EvaluationsCard } from "@/components/members/evaluations-card";
import { CheckinQrCard } from "@/components/profile/checkin-qr-card";
import { FamilyCard } from "@/components/profile/family-card";
import { PasswordChangeCard } from "@/components/profile/password-change-card";
import { MapPicker } from "@/components/shared/map-picker";
import { createClient } from "@/lib/supabase/client";
import {
  AVATAR_GALLERY,
  avatarSlot,
  randomAvatarId,
} from "@/lib/avatars";
import { useI18n, type Dict } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAcademy,
  useAllPayments,
  useAttendance,
  useMyCommunityRecord,
  useMyStreaks,
  useProfile,
  useSessions,
  useUpdateOwnProfile,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function ProfileClient({ serverProfile }: { serverProfile: Profile }) {
  if (serverProfile.role === "admin") {
    return <AcademyProfile serverProfile={serverProfile} />;
  }
  return <MemberProfile serverProfile={serverProfile} />;
}

function AcademyProfile({ serverProfile }: { serverProfile: Profile }) {
  const { t, locale } = useI18n();
  const { data: academy, isLoading } = useAcademy();
  const { data: profile } = useProfile(serverProfile.id);
  const p = profile ?? serverProfile;

  const [name, setName] = useState(p.name);
  const [username, setUsername] = useState(p.username);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [saving, setSaving] = useState(false);
  const updateProfile = useUpdateOwnProfile();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        id: p.id,
        name: name.trim(),
        username,
        phone: phone || null,
      });
      toast.success(t("profile_saved"));
    } catch (e) {
      toast.error(
        e instanceof Error && /duplicate key|already exists/i.test(e.message)
          ? t("field_username_taken")
          : t("common_error")
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !academy) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("profile_academy_title")}
          subtitle={t("profile_academy_subtitle")}
        />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isLoading || !academy) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("profile_academy_title")}
          subtitle={t("profile_academy_subtitle")}
        />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile_academy_title")}
        subtitle={t("profile_academy_subtitle")}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Academy identity */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              {t("settings_academy_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                name={academy.name}
                url={p.avatar_url}
                className="h-16 w-16"
                fallbackClassName="text-lg"
              />
              <div className="min-w-0">
                <p className="text-lg font-bold">{academy.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{t("role_academy")}</Badge>
                  {academy.is_trial && (
                    <Badge variant="outline">{t("trial_badge")}</Badge>
                  )}
                </div>
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="w-full">
              <a href="/settings#settings-academy-info">
                <SettingsIcon className="h-4 w-4" />
                {t("profile_manage_settings_title")}
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Owner contact + links */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-primary" />
                {t("profile_owner_contact")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base font-semibold">{p.name}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("profile_owner_name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <UsernameField value={username} onChange={setUsername} />
                </div>
                <div className="space-y-2">
                  <Label>{t("profile_phone")}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4" />
                {saving ? t("common_saving") : t("profile_save")}
              </Button>
              <div className="space-y-2 border-t pt-4 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span dir="ltr" className="truncate">{p.email}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  {p.phone || t("common_not_set")}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t("profile_join_date")}:{" "}
                  {academy.created_at
                    ? format(
                        new Date(academy.created_at),
                        "MMM d, yyyy",
                        { locale }
                      )
                    : t("common_not_set")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <SettingsIcon className="h-4 w-4 text-primary" />
                {t("profile_manage_settings_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("profile_manage_settings_hint")}
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
              >
                <a href="/settings#settings-academy-info">
                  <Building2 className="h-4 w-4" />
                  {t("settings_academy_info")}
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
              >
                <a href="/settings#settings-invite">
                  <Link2 className="h-4 w-4" />
                  {t("settings_invite_code")}
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <PasswordChangeCard />
    </div>
  );
}

function MemberProfile({ serverProfile }: { serverProfile: Profile }) {
  const { t, lang, locale } = useI18n();
  const { data: profile } = useProfile(serverProfile.id);
  const p = profile ?? serverProfile;

  const [name, setName] = useState(p.name);
  const [username, setUsername] = useState(p.username);
  const [nickname, setNickname] = useState(p.nickname ?? "");
  const [phone, setPhone] = useState(p.phone ?? "");
  const [gender, setGender] = useState<Profile["gender"]>(p.gender ?? null);
  const [birthDate, setBirthDate] = useState(p.birth_date ?? "");
  const [locLat, setLocLat] = useState<number | null>(p.lat ?? null);
  const [locLng, setLocLng] = useState<number | null>(p.lng ?? null);
  const [saving, setSaving] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const updateProfile = useUpdateOwnProfile();

  const paymentsQuery = useAllPayments();
  const { data: payments, isLoading: loadingPayments } = paymentsQuery;
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const training = useMemberTraining(p);
  const { data: record } = useMyCommunityRecord();
  const { data: streaks } = useMyStreaks();

  const premiumWarning = useMemo(() => {
    if (!p.premium_expires_at) return null;
    const exp = new Date(p.premium_expires_at);
    const diffDays = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    if (diffDays < 0) return "expired";
    if (diffDays <= 14) return "soon";
    return null;
  }, [p.premium_expires_at]);

  const legacyPayments = (payments ?? []).filter(x => x.member_id === p.id);
  const myPayments = trainingPaymentHistory(p.id, payments ?? [], training.bookings.data ?? []);
  const balance = bookingBalance(p.id, training.bookings.data ?? []);

  const myAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.member_id === p.id),
    [attendance, p.id]
  );

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((s) => [s.id, s])),
    [sessions]
  );

  const used = usedSessionsSincePayment(myAttendance, sessions ?? [], legacyPayments);
  const sessionTotal = balance.hasBooking ? balance.total : p.subscription_sessions;
  const remaining = balance.hasBooking ? balance.remaining : Math.max(sessionTotal - used, 0);
  const progress =
    sessionTotal > 0
      ? Math.min(100, Math.round(((sessionTotal - remaining) / sessionTotal) * 100))
      : 0;

  const attendedSessions = myAttendance
    .filter((a) => a.is_present)
    .map((a) => sessionById.get(a.session_id))
    .filter(Boolean)
    .sort((a, b) => (b!.date + b!.time).localeCompare(a!.date + a!.time));

  const lastPayment = myPayments[0];
  const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);
  const hasPlan = balance.hasBooking || legacyPayments.length > 0;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        id: p.id,
        name: name.trim(),
        username,
        nickname: nickname.trim() || null,
        phone: phone || null,
        gender,
        birth_date: birthDate || null,
      });
      toast.success(t("profile_saved"));
    } catch (e) {
      toast.error(
        e instanceof Error && /duplicate key|already exists/i.test(e.message)
          ? t("field_username_taken")
          : t("common_error")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async () => {
    setSavingLoc(true);
    try {
      await updateProfile.mutateAsync({
        id: p.id,
        lat: locLat,
        lng: locLng,
      });
      toast.success(t("profile_saved"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSavingLoc(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("avatar_invalid_type"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("avatar_too_large"));
      return;
    }
    setCropFile(file);
  };

  const saveCroppedAvatar = async (blob: Blob) => {
    setUploadingAvatar(true);
    const client = createClient();
    // Storage policies require the owner ID as the first folder.
    // A new filename also prevents browsers from showing a cached old photo.
    const path = `${p.id}/${crypto.randomUUID()}.jpg`;
    let uploaded = false;
    try {
      const { error } = await client.storage.from("avatars").upload(path, blob, {
        contentType: "image/jpeg", upsert: false,
      });
      if (error) throw error;
      uploaded = true;
      await updateProfile.mutateAsync({ id: p.id, avatar_url: path });
      setCropFile(null);
      toast.success(t("profile_saved"));
      if (p.avatar_url?.startsWith(`${p.id}/`)) {
        void client.storage.from("avatars").remove([p.avatar_url]).catch(() => {});
      }
    } catch (error) {
      if (uploaded) await client.storage.from("avatars").remove([path]).catch(() => {});
      toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : t("common_error"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const commitAvatar = async () => {
    if (!avatarDraft) return;
    setAvatarPickerOpen(false);
    try {
      await updateProfile.mutateAsync({ id: p.id, avatar_id: avatarDraft, avatar_url: null });
      toast.success(t("profile_saved"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setAvatarDraft(null);
    }
  };

  return (
    <div className="space-y-6">
      <AcademySuggestionOnboarding memberName={p.name} hasAcademy={!!p.academy_id} />
      <PageHeader title={t("profile_title")} subtitle={t("profile_subtitle")} />
      <nav aria-label={lang === "ar" ? "أقسام الملف" : "Profile sections"} className="flex flex-wrap gap-2">
        {[
          ["family", lang === "ar" ? "عيلتي" : "My family"],
          ["evaluations", lang === "ar" ? "التقييم والتطور" : "Feedback & progress"],
          ...(p.checkin_code ? [["checkin", lang === "ar" ? "كود الحضور" : "Attendance QR"]] : []),
          ["payments", t("profile_payment_status")],
          ["attendance-history", t("profile_attendance_title")],
        ].map(([id, label]) => <Button key={id} asChild variant="outline" size="sm"><a href={`#${id}`}>{label}</a></Button>)}
      </nav>

      {premiumWarning && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
            premiumWarning === "expired"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-attention-300 bg-attention-50 text-warning-ink dark:bg-attention-500/10 dark:text-attention-300"
          }`}
        >
          <Crown className="h-4 w-4 shrink-0" />
          <span>
            {premiumWarning === "expired"
              ? t("premium_expired_banner")
              : t("premium_expiring_banner").replace(
                  "{days}",
                  String(
                    Math.ceil(
                      (new Date(p.premium_expires_at!).getTime() -
                        Date.now()) /
                        86400000
                    )
                  )
                )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              {t("nav_profile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProfileAvatar
                  name={p.name}
                  url={p.avatar_url}
                  avatarId={p.avatar_id}
                  className="h-16 w-16"
                  fallbackClassName="text-lg"
                />
                <div className="absolute -bottom-1 -end-1 flex gap-1">
                  <button
                    type="button"
                    aria-label={t("avatar_change")}
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={t("avatar_pick_preset")}
                    onClick={() => {
                      setAvatarDraft(avatarSlot(p.avatar_id) ?? randomAvatarId());
                      setAvatarPickerOpen(true);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  >
                    <SmilePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="text-lg font-bold">{p.nickname || p.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{t("role_member")}</Badge>
                  {hasPlan ? (
                    <Badge variant={p.membership_type === "half" ? "outline" : "default"}>
                      {p.membership_type === "half" ? t("membership_half") : t("membership_full")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t("membership_none")}
                    </Badge>
                  )}
                  {p.member_plan === "premium" && (
                    <Badge className="bg-info/15 text-info-ink">
                      <Crown className="mr-1 h-3 w-3" />
                      Premium
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("signup_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("profile_nickname")}</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("profile_nickname_hint")}
              />
              <p className="text-xs text-muted-foreground">{t("profile_nickname_help")}</p>
            </div>
            <div className="space-y-2">
              <UsernameField value={username} onChange={setUsername} />
            </div>
            <div className="space-y-2">
              <Label>{t("signup_phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("profile_gender")}</Label>
              <Select
                value={gender ?? "none"}
                onValueChange={(v) => setGender(v === "none" ? null : (v as "male" | "female"))}
              >
                <SelectTrigger aria-label={t("profile_gender")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common_not_set")}</SelectItem>
                  <SelectItem value="male">{t("games_gender_male")}</SelectItem>
                  <SelectItem value="female">{t("games_gender_female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("profile_birth_date")}</Label>
              <Input
                type="date"
                dir="ltr"
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4" />
              {saving ? t("common_saving") : t("profile_save")}
            </Button>

            <div className="space-y-2 border-t pt-4 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span dir="ltr" className="truncate">{p.email}</span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                {p.phone || t("common_not_set")}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t("profile_join_date")}:{" "}
                {p.join_date
                  ? format(new Date(p.join_date + "T00:00:00"), "MMM d, yyyy", { locale })
                  : t("common_not_set")}
              </p>
            </div>
          </CardContent>
        </Card>

        {cropFile && <AvatarCropDialog file={cropFile} busy={uploadingAvatar} onClose={() => setCropFile(null)} onSave={saveCroppedAvatar} />}
        <Dialog open={avatarPickerOpen} onOpenChange={(open) => { setAvatarPickerOpen(open); if (!open) setAvatarDraft(null); }}>
          <DialogContent className="max-w-md space-y-4">
            <DialogHeader>
              <DialogTitle>{t("avatar_presets_title")}</DialogTitle>
              <DialogDescription>{t("avatar_presets_subtitle")}</DialogDescription>
            </DialogHeader>
            {avatarDraft && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <ProfileAvatar name={p.name} avatarId={avatarDraft} className="h-24 w-24" />
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {AVATAR_GALLERY.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-label={a.id}
                      aria-pressed={avatarDraft === a.id}
                      onClick={() => setAvatarDraft(a.id)}
                      className={`relative h-12 w-12 overflow-hidden rounded-full border-2 bg-background sm:h-14 sm:w-14 ${
                        avatarDraft === a.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border"
                      }`}
                    >
                      <Image
                        src={a.src}
                        alt={a.id}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setAvatarDraft(randomAvatarId())}>
                    <Dices className="h-4 w-4" />
                    {t("avatar_shuffle")}
                  </Button>
                  <Button className="flex-1" onClick={commitAvatar}>
                    <Check className="h-4 w-4" />
                    {t("profile_save")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Middle column: subscription + payments */}
        <div className="space-y-6 lg:col-span-2">
<section id="family" className="scroll-mt-24"><FamilyCard /></section>
<section id="training-renewal" className="scroll-mt-24"><TrainingRenewal memberId={p.id} academyId={p.academy_id}/></section><TrainingGoals memberId={p.id} canEdit ownGoals/><section id="evaluations" className="scroll-mt-24"><EvaluationsCard memberId={p.id} isAdmin={false} /></section>
{p.checkin_code && (
            <section id="checkin" className="scroll-mt-24"><CheckinQrCard code={p.checkin_code} memberName={p.name} profile={p} /></section>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                {t("profile_location_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MapPicker
                lat={locLat}
                lng={locLng}
                onChange={(loc) => {
                  setLocLat(loc.lat);
                  setLocLng(loc.lng);
                }}
                hint={t("profile_location_hint")}
              />
              <Button
                onClick={handleSaveLocation}
                disabled={savingLoc || (locLat == null && locLng == null)}
                className="w-full"
              >
                <Save className="h-4 w-4" />
                {savingLoc ? t("common_saving") : t("profile_save")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Swords className="h-4 w-4 text-primary" />
                {t("community_stats_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-lg font-bold">{record?.played ?? "–"}</p>
                  <p className="text-[10px] text-muted-foreground">{t("record_played")}</p>
                </div>
                <div className="rounded-lg bg-success/10 p-2">
                  <p className="text-lg font-bold text-success">{record?.wins ?? "–"}</p>
                  <p className="text-[10px] text-muted-foreground">{t("record_wins")}</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-2">
                  <p className="text-lg font-bold text-destructive">{record?.losses ?? "–"}</p>
                  <p className="text-[10px] text-muted-foreground">{t("record_losses")}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-lg font-bold">{record?.draws ?? "–"}</p>
                  <p className="text-[10px] text-muted-foreground">{t("record_draws")}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Flame className="h-4 w-4 text-warning-ink" />
                  <span>{t("streak_current")}</span>
                </div>
                <Badge variant="outline">
                  {streaks?.current ?? 0} {t("streak_days")}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-warning-ink" />
                  <span>{t("streak_best")}</span>
                </div>
                <Badge variant="outline">
                  {streaks?.best ?? 0} {t("streak_days")}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  {t("achievements_title")}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { min: 1, icon: "1", key: "achievement_first" },
                    { min: 10, icon: "10", key: "achievement_ten" },
                    { min: 25, icon: "25", key: "achievement_twentyfive" },
                    { min: 50, icon: "50", key: "achievement_fifty" },
                    { min: 30, icon: "30", key: "achievement_streak" },
                  ].map((b) => {
                    const unlocked =
                      b.key === "achievement_streak"
                        ? (streaks?.best ?? 0) >= b.min
                        : (streaks?.attendedSessions ?? 0) >= b.min;
                    return (
                      <div
                        key={b.key}
                        title={t(b.key as keyof Dict)}
                        className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-center ${
                          unlocked
                            ? "border-attention-300 bg-attention-50 dark:bg-attention-500/10"
                            : "border-dashed opacity-50"
                        }`}
                      >
                        <Trophy
                          className={`h-4 w-4 ${
                            unlocked
                              ? "text-warning-ink"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-[9px] font-semibold text-muted-foreground">
                          {b.icon}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4 text-primary" />
                {t("profile_remaining_sessions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4"><QueryState queries={[paymentsQuery, training.bookings]}>
              {hasPlan ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {balance.hasBooking ? (lang === "ar" ? "الجلسات المجدولة المتبقية" : "Scheduled sessions remaining") : `${used} ${t("dash_sessions_used")}`} · {sessionTotal}
                    </span>
                    <span className="font-semibold">
                      {remaining} {t("profile_sessions_left")}
                    </span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4 shrink-0" />
                  {t("members_no_plan_msg")}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t("dash_my_status")}</p>
                  <Badge
                    variant={hasPlan ? (remaining > 0 ? "success" : "warning") : "outline"}
                    className="mt-1"
                  >
                    {hasPlan
                      ? remaining > 0
                        ? t("dash_active")
                        : t("dash_expired")
                      : t("membership_none")}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t("member_total_paid")}</p>
                  <p className="mt-1 font-extrabold font-mono">
                    {formatMoney(totalPaid, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="text-muted-foreground">{t("member_last_payment")}</span>
                <span className="font-medium">
                  {lastPayment
                    ? `${formatMoney(Number(lastPayment.amount), lang)} · ${format(
                        new Date(lastPayment.date + "T00:00:00"),
                        "MMM d, yyyy",
                        { locale }
                      )}`
                    : t("common_never")}
                </span>
              </div>

            </QueryState></CardContent>
          </Card>

          <Card id="payments" className="scroll-mt-24">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                {t("profile_payment_status")}
              </CardTitle>
            </CardHeader>
            <CardContent><QueryState queries={[paymentsQuery, training.bookings]}>
              {loadingPayments || training.bookings.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : myPayments.length === 0 ? (
                <EmptyState message={t("member_no_payments")} icon={CreditCard} />
              ) : (
                <div className="space-y-2">
                  {myPayments.map((x) => (
                    <div
                      key={x.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-mono font-bold">
                          {formatMoney(Number(x.amount), lang)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(x.date + "T00:00:00"), "MMM d, yyyy", {
                            locale,
                          })}
                          {" · "}
                          {x.source === "booking" ? x.label : x.label === "half" ? t("membership_half") : t("membership_full")}
                          {" · "}
                          {x.sessions} {t("member_payment_sessions")}
                        </p>
                      </div>
                      <Badge variant="success">{t("dash_active")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </QueryState></CardContent>
          </Card>
        </div>
      </div>

      {/* Attendance history */}
      <Card id="attendance-history" className="scroll-mt-24">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("profile_attendance_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendedSessions.length === 0 ? (
            <EmptyState message={t("member_no_attendance")} icon={CheckCircle2} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {attendedSessions.map((s) => (
                <div
                  key={s!.id}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {format(new Date(s!.date + "T00:00:00"), "EEE, MMM d", { locale })}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {formatTime12h(s!.time, lang)}
                      {s!.location ? ` · ${s!.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <section id="upcoming-training" className="scroll-mt-24"><MemberTrainingPreview profile={p} /></section>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div className="text-sm">
          <p className="font-medium">{t("profile_manage_settings_title")}</p>
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "حسابك وإعدادات الأكاديمية وحذف الحساب"
              : "Your account, academy settings and account deletion"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href="/settings">
            <SettingsIcon className="h-4 w-4" />
            {t("nav_settings")}
          </a>
        </Button>
      </div>

      <PasswordChangeCard />
    </div>
  );
}