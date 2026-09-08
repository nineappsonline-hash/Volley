"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Flame,
  Link2,
  Mail,
  MapPin,
  Phone,
  Save,
  Swords,
  Timer,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { CheckinQrCard } from "@/components/profile/checkin-qr-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { MapPicker } from "@/components/shared/map-picker";
import { useI18n, type Dict } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import { initials } from "@/lib/utils";
import {
  useAcademy,
  useAllPayments,
  useAttendance,
  useMemberSessionCosts,
  useMyCommunityRecord,
  useMyStreaks,
  useProfile,
  useSessions,
  useUpdateOwnProfile,
  useUpcomingSessions,
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
  const [phone, setPhone] = useState(p.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
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
        phone: phone || null,
      });
      toast.success(t("profile_saved"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSaving(false);
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

  const location = [
    academy.country,
    academy.governorate,
    academy.area,
    academy.address,
  ]
    .filter(Boolean)
    .join(" · ");
  const publicUrl =
    typeof window !== "undefined" && academy.slug
      ? `${window.location.origin}/a/${academy.slug}`
      : "";

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
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {initials(academy.name) || "A"}
                </AvatarFallback>
              </Avatar>
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

            <div className="space-y-3 border-t pt-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("profile_location")}
                </p>
                <p className="mt-0.5 flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{location || t("common_not_set")}</span>
                </p>
              </div>
              {academy.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("profile_about")}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {academy.description}
                  </p>
                </div>
              )}
            </div>
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
                <Link2 className="h-4 w-4 text-primary" />
                {t("profile_public_link")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings_invite_code")}</Label>
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
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings_invite_hint")}
                </p>
              </div>
              {publicUrl && (
                <div className="space-y-2">
                  <Label>{t("settings_slug")}</Label>
                  <div className="flex items-center gap-2">
                    <Input dir="ltr" readOnly value={publicUrl} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("cal_copy")}
                      onClick={() => copy(publicUrl, "public")}
                    >
                      {copied === "public" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteAccountCard isAdmin />
    </div>
  );
}

function MemberProfile({ serverProfile }: { serverProfile: Profile }) {
  const { t, lang, locale } = useI18n();
  const { data: profile } = useProfile(serverProfile.id);
  const p = profile ?? serverProfile;

  const [name, setName] = useState(p.name);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [gender, setGender] = useState<Profile["gender"]>(p.gender ?? null);
  const [birthDate, setBirthDate] = useState(p.birth_date ?? "");
  const [locLat, setLocLat] = useState<number | null>(p.lat ?? null);
  const [locLng, setLocLng] = useState<number | null>(p.lng ?? null);
  const [saving, setSaving] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const updateProfile = useUpdateOwnProfile();

  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: upcoming } = useUpcomingSessions();
  const { data: costs } = useMemberSessionCosts();
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

  const myPayments = useMemo(
    () => (payments ?? []).filter((x) => x.member_id === p.id),
    [payments, p.id]
  );

  const myAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.member_id === p.id),
    [attendance, p.id]
  );

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((s) => [s.id, s])),
    [sessions]
  );

  const used = usedSessionsSincePayment(myAttendance, sessions ?? [], myPayments);
  const remaining = Math.max(p.subscription_sessions - used, 0);
  const progress =
    p.subscription_sessions > 0
      ? Math.min(100, Math.round((used / p.subscription_sessions) * 100))
      : 0;

  const attendedSessions = myAttendance
    .filter((a) => a.is_present)
    .map((a) => sessionById.get(a.session_id))
    .filter(Boolean)
    .sort((a, b) => (b!.date + b!.time).localeCompare(a!.date + a!.time));

  const lastPayment = myPayments[0];
  const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);
  const hasPlan = myPayments.length > 0;

  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const monthCost = (costs ?? []).find((c) => c.month === m && c.year === y);

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
        phone: phone || null,
        gender,
        birth_date: birthDate || null,
      });
      toast.success(t("profile_saved"));
    } catch {
      toast.error(t("common_error"));
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile_title")} subtitle={t("profile_subtitle")} />

      {premiumWarning && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
            premiumWarning === "expired"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
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
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {p.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold">{p.name}</p>
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
                    <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
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

        {/* Middle column: subscription + payments */}
        <div className="space-y-6 lg:col-span-2">
{p.checkin_code && (
            <CheckinQrCard code={p.checkin_code} memberName={p.name} />
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
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{t("streak_current")}</span>
                </div>
                <Badge variant="outline">
                  {streaks?.current ?? 0} {t("streak_days")}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
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
                            ? "border-amber-300 bg-amber-50 dark:bg-amber-500/10"
                            : "border-dashed opacity-50"
                        }`}
                      >
                        <Trophy
                          className={`h-4 w-4 ${
                            unlocked
                              ? "text-amber-500"
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
            <CardContent className="space-y-4">
              {hasPlan ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {used} {t("dash_sessions_used")} {t("member_sessions_remaining_of")}{" "}
                      {p.subscription_sessions}
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
                        new Date(lastPayment.payment_date + "T00:00:00"),
                        "MMM d, yyyy",
                        { locale }
                      )}`
                    : t("common_never")}
                </span>
              </div>
              {monthCost && (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <span className="text-muted-foreground">{t("dash_session_cost_info")}</span>
                  <span className="font-mono font-semibold">
                    {formatMoney(Number(monthCost.cost_per_session), lang)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                {t("profile_payment_status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
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
                          {format(new Date(x.payment_date + "T00:00:00"), "MMM d, yyyy", {
                            locale,
                          })}
                          {" · "}
                          {x.membership_type === "half" ? t("membership_half") : t("membership_full")}
                          {" · "}
                          {x.subscription_sessions} {t("member_payment_sessions")}
                        </p>
                      </div>
                      <Badge variant="success">{t("dash_active")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Attendance history */}
      <Card>
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
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {format(new Date(s!.date + "T00:00:00"), "EEE, MMM d", { locale })}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {s!.time.slice(0, 5)}
                      {s!.location ? ` · ${s!.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-primary" />
            {t("profile_upcoming_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!upcoming || upcoming.length === 0 ? (
            <EmptyState message={t("profile_no_upcoming")} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(s.date + "T00:00:00"), "EEEE, MMM d", { locale })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.time.slice(0, 5)}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {s.time.slice(0, 5)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteAccountCard isAdmin={false} />
    </div>
  );
}