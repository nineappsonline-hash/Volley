"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, Users, LandPlot, Trophy, Sparkles } from "lucide-react";
import { PlatformRecords } from "./platform-records";
import { PlatformAnalytics } from "./platform-analytics";
import { AcademyEditDialog } from "./academy-edit-dialog";
import { AcademyLogo, AcademyLogoDialog } from "@/components/academies/academy-logo";
import { ApprovalsPage } from "./approvals-page";
import { AcademyTrainingPaymentApprovals } from "@/components/academies/training-booking";
import { ShareIconButton, academyShareTarget } from "@/components/academies/academy-share";
import { PaymentApprovals } from "./payment-approvals";
import { MessagesPage } from "./messages-page";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarClock,
  CreditCard,
  CheckCircle2,
  Crown,
  ExternalLink,
  Flag,
  ImagePlus,
  Megaphone,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { PageHeader } from "@/components/shared/page-header";
import type { Academy } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatMoneyShort } from "@/lib/constants";
import {
  useAllAcademies,
  useCommunityMembers,
  useContactMessages,
  useSuperAdminStats,
  useConvertToPaid,
  useExtendTrial,
  useReports,
  useResolveReport,
  useSendBroadcast,
  useSetAcademyPlan,
} from "@/lib/queries";

type AcademyPlan = "starter" | "plus" | "elite";

const PLAN_ORDER: AcademyPlan[] = ["starter", "plus", "elite"];

export function SuperAdminDashboard() {
  const { t, lang, locale } = useI18n();
  const money = (v: number) => formatMoneyShort(v, lang);
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { data: academies, isLoading, isError: academiesError, refetch: refetchAcademies } = useAllAcademies();
  const extendTrial = useExtendTrial();
  const convertToPaid = useConvertToPaid();
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { data: contactMessages, isLoading: messagesLoading } = useContactMessages(200);
  const { data: members } = useCommunityMembers();
  const { data: platformStats, isLoading: platformStatsLoading } = useSuperAdminStats();
  const resolve = useResolveReport();
  const setAcademyPlan = useSetAcademyPlan();
  const [editing, setEditing] = useState<Academy | null>(null);
  const [logoAcademy, setLogoAcademy] = useState<Academy | null>(null);
  const sendBroadcast = useSendBroadcast();
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");

  const memberName = (id: string) =>
    (members ?? []).find((m) => m.id === id)?.name ?? id.slice(0, 8);
  const memberHandle = (id: string) => {
    const u = (members ?? []).find((m) => m.id === id)?.username;
    return u ? `@${u}` : null;
  };

  const stats = useMemo(() => {
    const list = academies ?? [];
    const now = new Date();
    const total = list.length;
    const trials = list.filter((a) => a.is_trial);
    const activeTrials = trials.filter(
      (a) => a.trial_ends_at && new Date(a.trial_ends_at) > now
    );
    const expiredTrials = trials.filter(
      (a) => a.trial_ends_at && new Date(a.trial_ends_at) <= now
    );
    const paid = list.filter((a) => !a.is_trial);
    return { total, trials: trials.length, activeTrials: activeTrials.length, expiredTrials: expiredTrials.length, paid: paid.length };
  }, [academies]);

  const openReports = (reports ?? []).filter((report) => report.status === "open").length;
  // Inbox hook fetches up to 200 latest messages: this is a visible-list count, not a global total.
  const unreadRecentMessages = (contactMessages ?? []).filter((message) => !message.is_read).length;

  const handleExtend = async (academyId: string, days: number) => {
    try {
      await extendTrial.mutateAsync({ academy_id: academyId, days });
      toast.success(t("super_admin_trial_extended"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleConvert = async (academyId: string) => {
    try {
      await convertToPaid.mutateAsync(academyId);
      toast.success(t("super_admin_converted"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleSetPlan = async (academyId: string, plan: AcademyPlan) => {
    try {
      await setAcademyPlan.mutateAsync({ academyId, plan });
      toast.success(t("super_admin_plan_updated"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim()) {
      toast.error(t("super_admin_broadcast_title_required"));
      return;
    }
    try {
      const n = await sendBroadcast.mutateAsync({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        link: broadcastLink.trim() || null,
      });
      toast.success(t("super_admin_broadcast_sent").replace("{n}", String(n)));
      setBroadcastTitle("");
      setBroadcastBody("");
      setBroadcastLink("");
    } catch {
      toast.error(t("common_error"));
    }
  };

  const getAcademyStatus = (academy: any) => {
    if (!academy.is_trial) return "paid";
    if (!academy.trial_ends_at) return "trial";
    return new Date(academy.trial_ends_at) > new Date() ? "active_trial" : "expired";
  };

  const getTrialDaysLeft = (academy: any) => {
    if (!academy.trial_ends_at) return null;
    const diff = Math.ceil(
      (new Date(academy.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  // The record browser (Members / Academies / Friendly games / Playgrounds)
  // is only shown on its dedicated tabbed routes (/admin?tab=...).
  if (tab === "Approvals") return <ApprovalsPage />;

  if (tab === "Messages") return <MessagesPage />;

  if (tab) {
    return (
      <div className="space-y-6">
        <PlatformRecords />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl bg-[#f7f6fb] p-3 text-[#211a30] sm:p-5">
      {/* Figma Command Center: compact heading, white KPI tiles, and task queue. */}
      <section aria-label={lang === "ar" ? "مركز متابعة المنصة" : "Platform command center"} className="space-y-6 rounded-2xl !bg-[#f7f6fb] p-4 !text-[#211a30] sm:p-6 lg:p-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{lang === "ar" ? "أهلاً بيك في Playza" : "Welcome to Playza"}</h1>
            <p className="mt-2 text-sm text-[#716c7d]">{lang === "ar" ? "دي أهم الأرقام والمهام اللي محتاجة متابعتك." : "Here is what needs your attention across Playza."}</p>
          </div>
          <span className="rounded-full border border-[#eeecf3] !bg-white px-3 py-1.5 text-xs !text-[#716c7d]">{lang === "ar" ? "البيانات الحالية" : "Current data"}</span>
        </div>
        {academiesError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span>{lang === "ar" ? "تعذر تحميل إحصائيات الأكاديميات. حاول مرة أخرى." : "Academy statistics could not be loaded. Please try again."}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetchAcademies()}>{lang === "ar" ? "إعادة المحاولة" : "Retry"}</Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: lang === "ar" ? "إجمالي المستخدمين" : "Total players & accounts", value: platformStatsLoading || !platformStats ? "—" : platformStats.members.total, href: "/admin?tab=Members", detail: lang === "ar" ? "عرض المستخدمين" : "Explore players" },
            { label: lang === "ar" ? "المباريات المفتوحة" : "Open games", value: platformStatsLoading || !platformStats ? "—" : (platformStats.games.by_status.find(item => item.status === "open")?.count ?? 0), href: "/admin?tab=Friendly%20games", detail: lang === "ar" ? "عرض المباريات" : "Explore games" },
            { label: lang === "ar" ? "إجمالي الأكاديميات" : "Total academies", value: isLoading || academiesError ? "—" : stats.total, href: "/admin?tab=Academies", detail: lang === "ar" ? "عرض الأكاديميات" : "Explore academies" },
            { label: lang === "ar" ? "البلاغات المفتوحة" : "Open reports", value: reportsLoading ? "—" : openReports, href: "#admin-reports", detail: lang === "ar" ? "تحتاج مراجعة" : "Needs review" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="group min-w-0 rounded-[14px] border border-[#eeecf3] !bg-white p-5 !text-[#211a30] shadow-sm transition-colors hover:border-[#6739d4]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6739d4]">
              <p className="text-xs font-semibold leading-5 !text-[#716c7d] sm:text-sm">{item.label}</p>
              <p className="mt-3 text-2xl font-extrabold tabular-nums !text-[#211a30] sm:text-3xl">{item.value}</p>
              <p className="mt-2 text-xs font-semibold text-[#6739d4]">{item.detail} →</p>
            </Link>
          ))}
        </div>
        <div className="rounded-[14px] border border-[#eeecf3] !bg-white p-4 !text-[#211a30] shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold !text-[#211a30] sm:text-lg">{lang === "ar" ? "تحتاج متابعتك" : "Needs your attention"}</h3>
              <p className="text-xs !text-[#716c7d]">{lang === "ar" ? "اختصارات مباشرة للمهام الإدارية" : "Quick access to administrative work queues"}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: lang === "ar" ? "مراجعة المدفوعات" : "Review payments", href: "#admin-payments", icon: CreditCard },
              { label: lang === "ar" ? "طلبات الموافقة" : "Approval requests", href: "/admin?tab=Approvals", icon: CheckCircle2 },
              { label: lang === "ar" ? "رسائل الدعم" : "Support messages", href: "/admin?tab=Messages", icon: Megaphone, count: messagesLoading ? null : unreadRecentMessages },
              { label: lang === "ar" ? "بلاغات المجتمع" : "Community reports", href: "#admin-reports", icon: Flag, count: reportsLoading ? null : openReports },
            ].map(({ label, href, icon: Icon, count }) => (
              <Link key={href} href={href} className="flex min-h-16 items-center gap-3 rounded-xl border border-[#eeecf3] !bg-[#faf9fd] px-4 py-3 !text-[#211a30] transition-colors hover:border-[#6739d4]/40 hover:bg-[#f1edfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6739d4]">
                <span className="rounded-lg bg-brand/10 p-2 text-brand"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold !text-[#211a30]">{label}</span>
                {typeof count === "number" && count > 0 && <Badge variant="destructive" className="shrink-0 tabular-nums" title={href.includes("Messages") ? (lang === "ar" ? "غير مقروءة ضمن آخر 200 رسالة" : "Unread among latest 200 messages") : undefined}>{count}</Badge>}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <nav aria-label={lang === "ar" ? "إدارة المنصة" : "Platform management"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { tab: "Members", title: t("sa_records_members"), icon: Users },
          { tab: "Academies", title: t("sa_records_academies"), icon: Building2 },
          { tab: "Friendly games", title: t("sa_records_games"), icon: LandPlot },
          { tab: "Tournaments", title: t("sa_records_tournaments"), icon: Trophy },
          { tab: "Approvals", title: t("nav_approvals"), icon: CheckCircle2 },
          { tab: "Messages", title: lang === "ar" ? "الرسائل" : "Messages", icon: Megaphone },
        ].map(({ tab: destination, title, icon: Icon }) => <Link key={destination} href={`/admin?tab=${encodeURIComponent(destination)}`} className="group flex min-h-20 items-center gap-3 rounded-[14px] border border-[#eeecf3] !bg-white p-4 !text-[#211a30]" shadow-sm transition-colors hover:border-[#6739d4]/40 hover:bg-[#faf9fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6739d4]">
          <span className="rounded-xl bg-[#f1edfa] p-3 text-[#6739d4]"><Icon aria-hidden="true" className="h-5 w-5" /></span>
          <span className="flex-1 text-sm font-bold !text-[#211a30]">{title}</span>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#6739d4] rtl:-scale-x-100" />
        </Link>)}
      </nav>

      <div id="admin-analytics" className="scroll-mt-24"><PlatformAnalytics showSummary={false} /></div>

      {/* Academies table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-48 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : !academies || academies.length === 0 ? (
        <EmptyState message={t("super_admin_all_academies")} icon={Crown} />
      ) : (
        <Reveal index={1}>
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="relative mb-4 overflow-hidden border-b border-[#eeecf3] bg-white py-5 text-[#211a30]">
            <Sparkles aria-hidden="true" className="pointer-events-none absolute -end-2 top-1 h-24 w-24 text-[#6739d4]/10" />
          <CardTitle className="relative flex flex-wrap items-center gap-2 text-base">
              <Crown className="h-6 w-6 text-[#6739d4]" />
              {t("super_admin_all_academies")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-full overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("super_admin_academy_name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("super_admin_admin_email")}</TableHead>
                    <TableHead>{t("super_admin_status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("super_admin_plan_label")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("super_admin_trial_ends")}</TableHead>
                    <TableHead className="text-end">{t("super_admin_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academies.map((academy) => {
                    const status = getAcademyStatus(academy);
                    const daysLeft = getTrialDaysLeft(academy);
                    return (
                      <TableRow key={academy.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AcademyLogo academyId={academy.id} name={academy.name} logoUrl={academy.logo_url} />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <p className="font-medium">{academy.name}</p>
                              {academy.slug && (
                                <a
                                  href={`/a/${academy.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell>
                          {status === "paid" ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("super_admin_active")}
                            </Badge>
                          ) : status === "active_trial" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {t("super_admin_trial")} · {daysLeft}d
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {t("super_admin_expired")}
                            </Badge>
                          )}
                        </TableCell>
<TableCell className="hidden md:table-cell">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  {t(`plans_tier_${academy.plan ?? "starter"}` as any)}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {PLAN_ORDER.map((p) => (
                                  <DropdownMenuItem
                                    key={p}
                                    onClick={() =>
                                      handleSetPlan(academy.id, p)
                                    }
                                  >
                                    {t(`plans_tier_${p}` as any)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {academy.trial_ends_at
                              ? format(new Date(academy.trial_ends_at), "MMM d, yyyy", { locale })
                              : "—"}
                          </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t("sa_academy_logo")}
                              title={t("sa_academy_logo")}
                              onClick={() => setLogoAcademy(academy)}
                            >
                              <ImagePlus className="h-4 w-4" />
                            </Button>
                            {academy.slug && (
                              <ShareIconButton
                                target={academyShareTarget({
                                  name: academy.name,
                                  slug: academy.slug,
                                  area: academy.area,
                                  governorate: academy.governorate,
                                })}
                                label={t("academy_share_title").replace("{name}", academy.name)}
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t("sa_edit")}
                              onClick={() => setEditing(academy)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {academy.is_trial && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1">
                                    <Plus className="h-3 w-3" />
                                    {t("super_admin_extend_trial")}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 7)}>
                                    {t("super_admin_extend_7")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 14)}>
                                    {t("super_admin_extend_14")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 30)}>
                                    {t("super_admin_extend_30")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {academy.is_trial && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-success-ink hover:text-success-ink"
                                onClick={() => handleConvert(academy.id)}
                              >
                                <Shield className="h-3 w-3" />
                                {t("super_admin_convert_paid")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
})}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </Reveal>
      )}

      {/* Payment approvals */}
      <div id="admin-payments" className="scroll-mt-24" />
      <Reveal index={2}>
      <PaymentApprovals />
      <div id="admin-subscriptions" className="scroll-mt-24"><AcademyTrainingPaymentApprovals /></div>
      </Reveal>


      {/* Broadcast to all users */}
      <Reveal index={5}>
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="relative mb-4 overflow-hidden border-b border-[#eeecf3] bg-white py-5 text-[#211a30]">
          <Sparkles aria-hidden="true" className="pointer-events-none absolute -end-2 top-1 h-24 w-24 text-[#6739d4]/10" />
          <CardTitle className="relative flex flex-wrap items-center gap-2 text-base">
            <Megaphone className="h-6 w-6 text-brand-200" />
            {t("super_admin_broadcast")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("super_admin_broadcast_hint")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="broadcast-title">{t("super_admin_broadcast_title")}</Label>
            <Input
              id="broadcast-title"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder={t("super_admin_broadcast_title_placeholder")}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-body">{t("super_admin_broadcast_body")}</Label>
            <Textarea
              id="broadcast-body"
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder={t("super_admin_broadcast_body_placeholder")}
              rows={4}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-link">{t("super_admin_broadcast_link")}</Label>
            <Input
              id="broadcast-link"
              value={broadcastLink}
              onChange={(e) => setBroadcastLink(e.target.value)}
              placeholder="https://…"
              dir="ltr"
            />
          </div>
          <Button
            onClick={handleBroadcast}
            disabled={sendBroadcast.isPending}
            className="gap-1"
          >
            <Megaphone className="h-4 w-4" />
            {sendBroadcast.isPending
              ? t("super_admin_broadcast_sending")
              : t("super_admin_broadcast_send")}
          </Button>
        </CardContent>
      </Card>
      </Reveal>

      {/* Community moderation */}
      <div id="admin-reports" className="scroll-mt-24" />
      <Reveal index={6}>
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="relative mb-4 overflow-hidden border-b border-[#eeecf3] bg-white py-5 text-[#211a30]">
          <Sparkles aria-hidden="true" className="pointer-events-none absolute -end-2 top-1 h-24 w-24 text-[#6739d4]/10" />
          <CardTitle className="relative flex flex-wrap items-center gap-2 text-base">
            <ShieldAlert className="h-6 w-6 text-orange-200" />
            {t("moderation_title")}
            {(reports ?? []).filter((r) => r.status === "open").length > 0 && (
              <Badge variant="destructive">
                {(reports ?? []).filter((r) => r.status === "open").length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <EmptyState
              message={t("moderation_empty")}
              hint={t("moderation_empty_hint")}
              icon={Flag}
            />
          ) : (
            <div className="max-w-full overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("moderation_target")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("moderation_reason")}</TableHead>
                    <TableHead>{t("moderation_status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("moderation_date")}</TableHead>
                    <TableHead className="text-end">{t("moderation_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reports ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {r.target_type === "game" ? t("moderation_type_game") : t("moderation_type_member")}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {r.target_type === "member"
                                ? memberName(r.target_id)
                                : r.target_id.slice(0, 8)}
                            </p>
                            {r.target_type === "member" && memberHandle(r.target_id) && (
                              <p className="text-xs text-muted-foreground">{memberHandle(r.target_id)}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {t("moderation_reported_by")} {memberName(r.reporter_id)}
                              {memberHandle(r.reporter_id) && <> ({memberHandle(r.reporter_id)})</>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[280px] sm:table-cell">
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.reason}</p>
                      </TableCell>
                      <TableCell>
                        {r.status === "open" ? (
                          <Badge variant="warning">{t("moderation_open")}</Badge>
                        ) : r.status === "resolved" ? (
                          <Badge variant="success">{t("moderation_resolved")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("moderation_dismissed")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy", { locale })}
                      </TableCell>
                      <TableCell className="text-end">
                        {r.status === "open" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-success-ink hover:text-success-ink"
                              onClick={() =>
                                resolve
                                  .mutateAsync({ reportId: r.id, status: "resolved" })
                                  .then(() => toast.success(t("moderation_resolved_ok")))
                                  .catch(() => toast.error(t("common_error")))
                              }
                              disabled={resolve.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t("moderation_resolve")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-muted-foreground"
                              onClick={() =>
                                resolve
                                  .mutateAsync({ reportId: r.id, status: "dismissed" })
                                  .catch(() => toast.error(t("common_error")))
                              }
                              disabled={resolve.isPending}
                            >
                              <XCircle className="h-3 w-3" />
                              {t("moderation_dismiss")}
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </Reveal>

      <AcademyEditDialog
        academy={editing}
        onClose={() => setEditing(null)}
        onDeleted={() => setEditing(null)}
      />

      {logoAcademy && (
        <AcademyLogoDialog
          academyId={logoAcademy.id}
          name={logoAcademy.name}
          open
          onOpenChange={(open) => !open && setLogoAcademy(null)}
        />
      )}
    </div>
  );
}
