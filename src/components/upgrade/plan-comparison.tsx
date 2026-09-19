"use client";

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

type Tier = "starter" | "plus" | "elite";

type PlanCell =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "value"; key: keyof Dict };

type PlanRow = {
  feature: keyof Dict;
  cells: [PlanCell, PlanCell, PlanCell];
};

type PlanSection = {
  category: keyof Dict;
  rows: PlanRow[];
};

const YES: PlanCell = { kind: "yes" };
const NO: PlanCell = { kind: "no" };
const value = (key: keyof Dict): PlanCell => ({ kind: "value", key });

const SECTIONS: PlanSection[] = [
  {
    category: "plan_cat_members",
    rows: [
      {
        feature: "plan_feat_member_limit",
        cells: [
          value("plans_value_unlimited"),
          value("plans_value_unlimited"),
          value("plans_value_unlimited"),
        ],
      },
      { feature: "plan_feat_roles", cells: [YES, YES, YES] },
      { feature: "plan_feat_invite_signup", cells: [NO, YES, YES] },
      { feature: "plan_feat_attendance", cells: [NO, YES, YES] },
      { feature: "plan_feat_evaluations", cells: [NO, NO, YES] },
      { feature: "plan_feat_churn", cells: [NO, YES, YES] },
    ],
  },
  {
    category: "plan_cat_schedule",
    rows: [
      { feature: "plan_feat_sessions", cells: [YES, YES, YES] },
      {
        feature: "plan_feat_venues",
        cells: [
          value("plans_venue_1"),
          value("plans_venue_3"),
          value("plans_value_unlimited"),
        ],
      },
      { feature: "plan_feat_recurring", cells: [NO, YES, YES] },
      { feature: "plan_feat_guests", cells: [NO, YES, YES] },
      { feature: "plan_feat_calendar", cells: [NO, NO, YES] },
    ],
  },
  {
    category: "plan_cat_payments",
    rows: [
      { feature: "plan_feat_payments", cells: [NO, YES, YES] },
      { feature: "plan_feat_expenses", cells: [NO, YES, YES] },
      { feature: "plan_feat_forecast", cells: [NO, NO, YES] },
      { feature: "plan_feat_revenue_breakdown", cells: [NO, NO, YES] },
    ],
  },
  {
    category: "plan_cat_reporting",
    rows: [
      { feature: "plan_feat_summary", cells: [NO, YES, YES] },
      { feature: "plan_feat_full_analytics", cells: [NO, YES, YES] },
      { feature: "plan_feat_rollup", cells: [NO, NO, YES] },
    ],
  },
  {
    category: "plan_cat_community",
    rows: [
      { feature: "plan_feat_announcements", cells: [NO, YES, YES] },
      { feature: "plan_feat_friendlies", cells: [NO, YES, YES] },
      { feature: "plan_feat_map", cells: [YES, YES, YES] },
      { feature: "plan_feat_leaderboard", cells: [NO, YES, YES] },
      { feature: "plan_feat_push", cells: [YES, YES, YES] },
      { feature: "plan_feat_bell", cells: [YES, YES, YES] },
    ],
  },
  {
    category: "plan_cat_marketplace",
    rows: [
      { feature: "plan_feat_teams", cells: [NO, NO, YES] },
      { feature: "plan_feat_marketplace", cells: [NO, NO, YES] },
      { feature: "plan_feat_events", cells: [NO, NO, YES] },
      { feature: "plan_feat_scouting", cells: [NO, NO, YES] },
    ],
  },
  {
    category: "plan_cat_platform",
    rows: [
      {
        feature: "plan_feat_coaches",
        cells: [
          value("plans_coach_1"),
          value("plans_value_unlimited"),
          value("plans_value_unlimited"),
        ],
      },
      { feature: "plan_feat_branding", cells: [NO, NO, YES] },
      { feature: "plan_feat_ai_coach", cells: [NO, NO, YES] },
      { feature: "plan_feat_support", cells: [NO, NO, YES] },
    ],
  },
];

const TIER_ORDER: Tier[] = ["starter", "plus", "elite"];

const MONTHLY: Record<Tier, string> = {
  starter: "0",
  plus: "200",
  elite: "350",
};

const YEARLY: Record<Tier, string> = {
  starter: "0",
  plus: "2100",
  elite: "3800",
};

export function PlanComparison({
  current,
  busy,
  onSubscribe,
}: {
  current: Tier;
  busy: boolean;
  onSubscribe?: (tier: Tier) => void;
}) {
  const { t } = useI18n();

  const renderCell = (cell: PlanCell) => {
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

  return (
    <div className="space-y-8">
      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const isCurrent = tier === current;
          const isPopular = tier === "plus";
          const tierName = t(`plans_tier_${tier}` as keyof Dict);
          const monthly =
            tier === "starter" ? t("plans_free") : `${MONTHLY[tier]} EGP`;
          const yearly = `${YEARLY[tier]} EGP`;

          return (
            <Card
              key={tier}
              className={`relative flex flex-col transition-colors ${
                isCurrent
                  ? "border-primary/50 bg-primary/5"
                  : isPopular
                    ? "border-interactive-400/60"
                    : ""
              }`}
            >
              {isPopular && (
                <Badge className="absolute -top-2.5 start-1/2 -translate-x-1/2 bg-info text-info-foreground dark:bg-interactive-500">
                  <Sparkles className="me-1 h-3 w-3" />
                  {t("plans_popular")}
                </Badge>
              )}
              <CardHeader className="pb-2 text-center">
                {isCurrent && (
                  <Badge
                    variant="outline"
                    className="mx-auto mb-2 border-primary/50 text-primary"
                  >
                    {t("plans_current")}
                  </Badge>
                )}
                <CardTitle className="flex items-center justify-center gap-1.5 text-lg">
                  {tier === "elite" && (
                    <Crown className="h-4 w-4 text-info-ink" />
                  )}
                  {tierName}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t(`plans_tagline_${tier}` as keyof Dict)}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="space-y-0.5 text-center">
                  <p className="text-3xl font-extrabold">{monthly}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("plans_per_month")}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {yearly} {t("plans_per_year")}
                  </p>
                </div>
                {tier !== "starter" && onSubscribe && (
                  <Button
                    className="w-full bg-gradient-to-r from-interactive-600 to-interactive-700 text-white hover:from-interactive-700 hover:to-interactive-800"
                    disabled={busy || isCurrent}
                    onClick={() => onSubscribe(tier)}
                  >
                    {isCurrent
                      ? t("plans_current")
                      : t("plans_subscribe")}
                  </Button>
                )}
                {tier === "starter" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isCurrent}
                  >
                    {t("plans_free")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Minus className="h-4 w-4" />
            {t("plans_compare_title")}
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
                  {TIER_ORDER.map((tier) => (
                    <th
                      key={tier}
                      className="px-3 py-3 text-center font-medium"
                    >
                      {t(`plans_tier_${tier}` as keyof Dict)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((section) => (
                  <>
                    <tr
                      key={section.category}
                      className="border-b bg-muted/40 text-start"
                    >
                      <td
                        colSpan={4}
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
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}