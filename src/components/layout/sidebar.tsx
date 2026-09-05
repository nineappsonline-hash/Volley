"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Crown,
  HandCoins,
  LandPlot,
  LayoutDashboard,
  LineChart,
  Map,
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
] as const;

const superAdminItems = [
  { href: "/admin", key: "super_admin_title", icon: Crown },
] as const;

const memberItems = [
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/schedule", key: "nav_schedule", icon: CalendarDays },
  { href: "/events", key: "nav_events", icon: Map },
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
  const { t } = useI18n();
  // All roles see the full feature set — admin control happens via the
  // Super Admin panel (/admin) and server-side RLS policies.
  const items = role === "super_admin" ? [...superAdminItems, ...adminItems] : role === "admin" ? [...adminItems, ...memberItems] : memberItems;

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
          <Volleyball className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-extrabold tracking-tight">
            {t("appName")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t("appTagline")}
          </span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, key, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  active && "text-primary-foreground"
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
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <Crown className="h-2.5 w-2.5" />
              PRO
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
