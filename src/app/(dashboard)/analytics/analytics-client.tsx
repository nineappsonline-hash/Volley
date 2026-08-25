"use client";

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { useI18n } from "@/lib/i18n";

export function AnalyticsClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();

  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("analytics_title")}
        subtitle={t("analytics_subtitle")}
      />
      <AnalyticsDashboard />
    </div>
  );
}
