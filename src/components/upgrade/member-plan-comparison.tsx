"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, Minus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n, type Dict } from "@/lib/i18n";
import { useActivatePremium } from "@/lib/queries";

type MemberTier = "free" | "pro";

type MemberCell =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "value"; key: keyof Dict };

type MemberRow = {
  feature: keyof Dict;
  cells: [MemberCell, MemberCell];
};

type MemberSection = {
  category: keyof Dict;
  rows: MemberRow[];
};

const YES: MemberCell = { kind: "yes" };
const NO: MemberCell = { kind: "no" };

const SECTIONS: MemberSection[] = [
  {
    category: "mplan_cat_account",
    rows: [
      { feature: "mplan_dashboard", cells: [YES, YES] },
      { feature: "mplan_profile", cells: [YES, YES] },
      { feature: "mplan_qr", cells: [YES, YES] },
      { feature: "mplan_record", cells: [YES, YES] },
      { feature: "mplan_pro_badge", cells: [NO, YES] },
    ],
  },
  {
    category: "mplan_cat_schedule",
    rows: [
      { feature: "mplan_calendar_view", cells: [YES, YES] },
      { feature: "mplan_session_details", cells: [YES, YES] },
      { feature: "mplan_ratings", cells: [YES, YES] },
      { feature: "mplan_ics", cells: [NO, YES] },
    ],
  },
  {
    category: "mplan_cat_alerts",
    rows: [
      { feature: "mplan_announcements", cells: [YES, YES] },
      { feature: "mplan_bell", cells: [YES, YES] },
      { feature: "mplan_push", cells: [YES, YES] },
    ],
  },
  {
    category: "mplan_cat_directory",
    rows: [
      { feature: "mplan_browse", cells: [YES, YES] },
      { feature: "mplan_radius", cells: [YES, YES] },
      { feature: "mplan_rate_join", cells: [YES, YES] },
    ],
  },
  {
    category: "mplan_cat_games",
    rows: [
      { feature: "mplan_browse_games", cells: [YES, YES] },
      { feature: "mplan_join_games", cells: [YES, YES] },
      { feature: "mplan_create_games", cells: [YES, YES] },
      { feature: "mplan_recurring", cells: [NO, YES] },
      { feature: "mplan_score_entry", cells: [NO, YES] },
    ],
  },
  {
    category: "mplan_cat_members",
    rows: [
      { feature: "mplan_directory", cells: [YES, YES] },
      { feature: "mplan_report_block", cells: [YES, YES] },
    ],
  },
  {
    category: "mplan_cat_map",
    rows: [{ feature: "mplan_map", cells: [YES, YES] }],
  },
  {
    category: "mplan_cat_marketplace",
    rows: [
      { feature: "mplan_browse_sessions", cells: [YES, YES] },
      { feature: "mplan_book_sessions", cells: [YES, YES] },
    ],
  },
  {
    category: "mplan_cat_competitive",
    rows: [
      { feature: "mplan_events", cells: [YES, YES] },
      { feature: "mplan_leaderboard", cells: [NO, YES] },
      { feature: "mplan_scouting", cells: [NO, YES] },
    ],
  },
];

const TIERS: MemberTier[] = ["free", "pro"];

export function MemberPlanComparison({
  currentPlan,
  busy,
  onSubscribe,
}: {
  currentPlan?: "free" | "premium";
  busy?: boolean;
  onSubscribe?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const activate = useActivatePremium();

  const current: MemberTier = currentPlan === "premium" ? "pro" : "free";

  const renderCell = (cell: MemberCell) => {
    if (cell.kind === "yes") {
      return (
        <Check
          className="mx-auto h-4 w-4 text-success-ink dark:text-positive-400"
          aria-label={t("common_yes")}
        />
      );
    }
    if (cell.kind === "no") {
      return (
        <Minus
          className="mx-auto h-4 w-4 text-muted-foreground/40"
          aria-label={t("common_no")}
        />
      );
    }
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {t(cell.key)}
      </span>
    );
  };

  const subscribe = onSubscribe
    ? onSubscribe
    : async () => {
        try {
          await activate.mutateAsync({ months: 1, amount: 100, method: "card" });
          toast.success(t("premium_activated"));
          router.push("/dashboard");
          router.refresh();
        } catch {
          toast.error(t("common_error"));
        }
      };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Free tier */}
        <Card className="relative">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-lg">{t("mplan_tier_free")}</CardTitle>
            <div className="space-y-0.5">
              <p className="text-3xl font-extrabold">{t("plans_free")}</p>
            </div>
          </CardHeader>
          <CardContent>
            {current === "free" ? (
              <Button variant="outline" className="w-full" disabled>
                {t("plans_current")}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {t("mplan_free_note")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pro tier */}
        <Card className="relative border-interactive-400/60">
          <Badge className="absolute -top-2.5 start-1/2 -translate-x-1/2 bg-info text-info-foreground dark:bg-interactive-500">
            <Sparkles className="me-1 h-3 w-3" />
            {t("plans_popular")}
          </Badge>
          <CardHeader className="pb-2 text-center">
            {current === "pro" && (
              <Badge
                variant="outline"
                className="mx-auto mb-2 border-primary/50 text-primary"
              >
                {t("plans_current")}
              </Badge>
            )}
            <CardTitle className="flex items-center justify-center gap-1.5 text-lg">
              <Crown className="h-4 w-4 text-info-ink" />
              {t("mplan_tier_pro")}
            </CardTitle>
            <div className="space-y-0.5">
              <p className="text-3xl font-extrabold">100 {t("currency_egp")}</p>
              <p className="text-xs text-muted-foreground">
                {t("plans_per_month")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                500 {t("currency_egp")} / {t("premium_plan_semi")} · 1000{" "}
                {t("currency_egp")} / {t("plans_per_year")}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-gradient-to-r from-interactive-600 to-interactive-700 text-white hover:from-interactive-700 hover:to-interactive-800"
              disabled={busy || current === "pro"}
              onClick={() => subscribe()}
            >
              {current === "pro" ? t("plans_current") : t("mplan_choose_pro")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Minus className="h-4 w-4" />
            {t("mplan_compare_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="w-1/2 px-4 py-3 font-medium text-muted-foreground">
                    {t("plans_feature")}
                  </th>
                  {TIERS.map((tier) => (
                    <th key={tier} className="px-3 py-3 text-center font-medium">
                      {t(`mplan_tier_${tier}` as keyof Dict)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((section) => (
                  <Fragment key={section.category}>
                    <tr className="border-b bg-muted/40 text-start">
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {t(section.category)}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-b last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {t(row.feature)}
                        </td>
                        {row.cells.map((cell, i) => (
                          <td key={i} className="px-3 py-2.5 text-center">
                            {renderCell(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}