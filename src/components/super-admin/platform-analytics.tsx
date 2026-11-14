"use client";

import { CHART_COLORS } from "@/lib/brand";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Gamepad2,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GAME_PLATFORM_FEE, formatMoneyShort } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { useSuperAdminStats } from "@/lib/queries";

const PLAN_COLORS: Record<string, string> = {
  free: CHART_COLORS.neutral,
  plus: CHART_COLORS.interaction,
  enterprise: CHART_COLORS.success,
};

const STATUS_ORDER = ["open", "full", "completed", "cancelled"] as const;

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function toChartPoints(
  months: string[],
  series: { month: string; count: number }[],
  locale?: import("date-fns").Locale
): { key: string; label: string; count: number }[] {
  const map = new Map(series.map((s) => [s.month, s.count]));
  return months.map((m, i) => ({
    key: m,
    label:
      i % 2 === 0
        ? format(new Date(m + "-01T00:00:00"), "MMM yy", { locale })
        : "",
    count: map.get(m) ?? 0,
  }));
}

export function PlatformAnalytics({ showSummary = true }: { showSummary?: boolean }) {
  const { t, lang, locale } = useI18n();
  const { data: stats, isLoading } = useSuperAdminStats();

  const months = useMemo(() => lastMonths(12), []);

  const membersChart = useMemo(
    () => toChartPoints(months, stats?.members.by_month ?? [], locale),
    [months, stats, locale]
  );
  const gamesChart = useMemo(
    () => toChartPoints(months, stats?.games.by_month ?? [], locale),
    [months, stats, locale]
  );

  const feesChart = useMemo(() => {
    const map = new Map<
      string,
      { session: number; game: number; payments: number }
    >();
    for (const m of months) map.set(m, { session: 0, game: 0, payments: 0 });
    for (const s of stats?.fees.session_by_month ?? [])
      if (map.has(s.month)) map.get(s.month)!.session = Number(s.total);
    for (const s of stats?.fees.game_by_month ?? [])
      if (map.has(s.month))
        map.get(s.month)!.game = Number(s.count) * GAME_PLATFORM_FEE;
    for (const s of stats?.fees.payments_by_month ?? [])
      if (map.has(s.month)) map.get(s.month)!.payments = Number(s.total);
    return months.map((m, i) => ({
      key: m,
      label:
        i % 2 === 0
          ? format(new Date(m + "-01T00:00:00"), "MMM yy", { locale })
          : "",
      ...map.get(m)!,
    }));
  }, [months, stats, locale]);

  const platformFees = useMemo(() => {
    const session = Number(stats?.fees.session_total ?? 0);
    const game = Number(stats?.fees.game_count ?? 0) * GAME_PLATFORM_FEE;
    return { session, game, total: session + game };
  }, [stats]);

  const planData = useMemo(() => {
    const p = stats?.academies.by_plan;
    if (!p) return [];
    return [
      { name: "free", label: t("sa_free_plan"), value: p.starter },
      { name: "plus", label: t("sa_plus_plan"), value: p.plus },
      { name: "enterprise", label: t("sa_enterprise_plan"), value: p.elite },
    ];
  }, [stats, t]);

  const statusData = useMemo(() => {
    const counts = new Map(
      (stats?.games.by_status ?? []).map((s) => [s.status, s.count])
    );
    return STATUS_ORDER.map((s) => ({
      key: s,
      label: t(`community_status_${s}` as any),
      count: counts.get(s) ?? 0,
    }));
  }, [stats, t]);

  const sportData = useMemo(
    () => (stats?.games.by_sport ?? []).slice(0, 8),
    [stats]
  );

  const money = (v: number) => formatMoneyShort(v, lang);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {showSummary && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t("sa_members")}
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold">
              {stats.members.total}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.members.members} {t("sa_members_role")} ·{" "}
              {stats.members.admins} {t("sa_admins")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gamepad2 className="h-3.5 w-3.5" />
              {t("sa_games")}
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold">
              {stats.games.total}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.games.approved} {t("sa_games_approved_fees")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("sa_memberships")}
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold">
              {stats.academies.total}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.academies.paid} {t("sa_paid")} · {stats.academies.trials}{" "}
              {t("sa_active_trials")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              {t("sa_fees_paid")}
            </p>
            <p className="mt-1 truncate font-mono text-2xl font-extrabold">
              {money(platformFees.total)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("sa_member_payments")} · {money(Number(stats.fees.payments_total))}
            </p>
          </CardContent>
        </Card>
      </div>}

      <div className="rounded-[14px] border border-[#eeecf3] bg-white p-5"><h2 className="text-lg font-extrabold text-[#211a30]">{lang === "ar" ? "تحليلات المنصة" : "Platform analytics"}</h2><p className="mt-1 text-sm text-[#716c7d]">{lang === "ar" ? "مؤشرات النمو والنشاط والمدفوعات" : "Growth, activity and payment trends"}</p></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Members by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_members")}</CardTitle>
            <CardDescription>{t("sa_members_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={membersChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.interaction} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.interaction} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | string) => [String(value), t("sa_members")]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.interaction}
                  fill="url(#fillMembers)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Memberships by plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_memberships")}</CardTitle>
            <CardDescription>{t("sa_memberships_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="45%" height={180}>
                <PieChart>
                  <Pie
                    data={planData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {planData.map((entry) => (
                      <Cell key={entry.name} fill={PLAN_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      String(value),
                      name,
                    ]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {planData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: PLAN_COLORS[p.name] }}
                      />
                      {p.label}
                    </span>
                    <span className="font-mono font-semibold">{p.value}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Badge variant="secondary">{t("sa_paid")} {stats.academies.paid}</Badge>
                  <Badge variant="outline">
                    {t("sa_active_trials")} {stats.academies.trials}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_games")}</CardTitle>
            <CardDescription>{t("sa_games_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gamesChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | string) => [String(value), t("sa_games")]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Games by status + sport */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_by_status")}</CardTitle>
            <CardDescription>
              {t("sa_games")} · {t("sa_by_sport")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {statusData.map((s) => (
                <Badge key={s.key} variant="secondary" className="gap-1">
                  {s.label}
                  <span className="font-mono font-semibold">{s.count}</span>
                </Badge>
              ))}
            </div>
            {sportData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("sa_no_data")}</p>
            ) : (
              <div className="space-y-2">
                {sportData.map((s, i) => {
                  const max = sportData[0].count || 1;
                  return (
                    <div key={s.sport} className="flex items-center gap-2 text-sm">
                      <span className="w-32 shrink-0 truncate">{s.sport}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(s.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-end font-mono text-xs">
                        {s.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fees by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_fees_paid")}</CardTitle>
            <CardDescription>{t("sa_fees_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={feesChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => money(v)}
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => [
                    money(Number(value)),
                    name === "session"
                      ? t("sa_session_fees")
                      : name === "game"
                        ? t("sa_game_fees")
                        : t("sa_member_payments"),
                  ]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="session" stackId="a" fill={CHART_COLORS.interaction} radius={[0, 0, 0, 0]} maxBarSize={28} />
                <Bar dataKey="game" stackId="a" fill={CHART_COLORS.success} radius={[0, 0, 0, 0]} maxBarSize={28} />
                <Bar dataKey="payments" fill={CHART_COLORS.attention} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-interactive-600" />
                {t("sa_session_fees")} · {money(platformFees.session)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-positive-500" />
                {t("sa_game_fees")} · {money(platformFees.game)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-attention-500" />
                {t("sa_member_payments")} · {money(Number(stats.fees.payments_total))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Receipt summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sa_total_collected")}</CardTitle>
            <CardDescription>{t("sa_fees_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-primary" />
                {t("sa_session_fees")}
              </span>
              <span className="font-mono font-semibold">
                {money(platformFees.session)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm">
                <Gamepad2 className="h-4 w-4 text-foreground" />
                {t("sa_game_fees")}
                <span className="text-xs text-muted-foreground">
                  ({stats.fees.game_count})
                </span>
              </span>
              <span className="font-mono font-semibold">
                {money(platformFees.game)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-warning-ink" />
                {t("sa_member_payments")}
                <span className="text-xs text-muted-foreground">
                  ({stats.fees.payments_count})
                </span>
              </span>
              <span className="font-mono font-semibold">
                {money(Number(stats.fees.payments_total))}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-3">
              <span className="text-sm font-semibold">{t("sa_platform_fees_total")}</span>
              <span className="font-mono text-lg font-extrabold">
                {money(platformFees.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}