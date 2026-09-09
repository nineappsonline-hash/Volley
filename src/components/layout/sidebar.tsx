"use client";

import { AppLogo } from "@/components/shared/app-logo";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Crown,
  HandCoins,
  LandPlot,
  LayoutDashboard,
  LineChart,
  Map,
  Network,
  Radar,
  Search,
  Settings,
  Swords,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Volleyball,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/types";

const adminItems = [
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/members", key: "nav_members", icon: Users },
  { href: "/teams", key: "nav_teams", icon: Trophy },
  { href: "/coaches", key: "nav_coaches", icon: UserRound },
  { href: "/schedule", key: "nav_schedule", icon: CalendarDays },
  { href: "/attendance", key: "nav_attendance", icon: ClipboardCheck },
  { href: "/costs", key: "nav_costs", icon: CreditCard },
  { href: "/reports", key: "nav_reports", icon: LineChart },
  { href: "/analytics", key: "nav_analytics", icon: BarChart3 },
  { href: "/tournaments", key: "nav_tournaments", icon: Swords },
  { href: "/playgrounds", key: "nav_playgrounds", icon: LandPlot },
  { href: "/rentals", key: "nav_rentals", icon: HandCoins },
  { href: "/settings", key: "nav_settings", icon: Settings },
  { href: "/upgrade", key: "nav_upgrade", icon: Crown },
] as const;

const superAdminItems = [
  { href: "/admin", key: "super_admin_title", icon: Crown },
  { href: "/admin?tab=Members", key: "nav_members", icon: Users },
  { href: "/admin?tab=Academies", key: "nav_academies", icon: Building2 },
  { href: "/admin?tab=Friendly%20games", key: "nav_community", icon: Volleyball },
  { href: "/admin?tab=Playgrounds", key: "nav_playgrounds", icon: LandPlot },
] as const;

const academyItems = [
  { href: "/profile", key: "nav_academy_profile", icon: Building2 },
] as const;

const memberItems = [
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/academies", key: "nav_academies", icon: Search },
  { href: "/schedule", key: "nav_schedule", icon: CalendarDays },
  { href: "/events", key: "nav_events", icon: Map },
  { href: "/games", key: "nav_games", icon: Volleyball },
  { href: "/community", key: "nav_community", icon: Network },
  { href: "/leaderboard", key: "nav_leaderboard", icon: Trophy },
  { href: "/scouting", key: "nav_scouting", icon: Radar },
  { href: "/profile", key: "nav_profile", icon: Users },
  { href: "/upgrade", key: "nav_upgrade", icon: Crown },
  { href: "/marketplace", key: "nav_marketplace", icon: Ticket },
] as const;

interface SidebarProps {
  role: Role;
  name: string;
  memberPlan?: "free" | "premium";
}

export function Sidebar({ role, name, memberPlan }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  // Admins manage the academy's own pages; members see the member feature set.
  // Platform admins navigate within their cross-academy panel.
  const items =
    role === "super_admin"
      ? superAdminItems
      : role === "admin"
      ? [...adminItems, ...academyItems]
      : memberItems;

  return (
    <div className="playza-navigation flex h-full flex-col gap-6 p-4">
      <Link href={role === "super_admin" ? "/admin" : "/dashboard"} className="flex flex-col items-start gap-1 px-2 pt-2">
        <AppLogo />
        <div className="flex flex-col">

          <span className="text-[11px] text-muted-foreground">
            {t("appTagline")}
          </span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, key, icon: Icon }) => {
          const active =
            role === "super_admin"
              ? pathname === "/admin" && (new URLSearchParams(href.split("?")[1]).get("tab") ?? "") === (searchParams.get("tab") ?? "")
              : pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-brand flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-info text-info-foreground shadow-md shadow-info/25"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  active && "text-info-foreground"
                )}
              />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span>
            {role === "super_admin"
              ? t("role_super_admin")
              : role === "admin"
                ? t("role_admin")
                : t("role_member")}
          </span>
          {role === "member" && memberPlan === "premium" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-attention-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink dark:bg-attention-500/15 dark:text-attention-400">
              <Crown className="h-2.5 w-2.5" />
              PRO
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
