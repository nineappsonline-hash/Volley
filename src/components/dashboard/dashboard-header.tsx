"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";

export function DashboardHeader({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();

  return (
    <PageHeader
      title={t("nav_dashboard")}
      subtitle={isAdmin ? t("dashboard_subtitle_admin") : t("dashboard_subtitle_member")}
    />
  );
}
