"use client";

import { AppLogo } from "@/components/shared/app-logo";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Crown,
  HandCoins,
  Gamepad2,
  QrCode,
  Heart,
  LandPlot,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  Mail,
  Map,
  MessageCircle,
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
import { MessagesUnreadBadge } from "@/components/contact/messages-unread-badge";
import { ContactFormDialog } from "@/components/contact/contact-form-dialog";

const adminItems = [
  { href: "/academy", key: "nav_academy_profile", icon: Building2 },
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/members", key: "nav_members", icon: Users },
  { href: "/teams", key: "nav_teams", icon: Trophy },
  { href: "/coaches", key: "nav_coaches", icon: UserRound },
  { href: "/schedule", key: "nav_schedule", icon: CalendarDays },
  { href: "/attendance", key: "nav_attendance", icon: ClipboardCheck },
  { href: "/costs", key: "nav_costs", icon: CreditCard },
  { href: "/reports", key: "nav_reports", icon: LineChart },
  { href: "/analytics", key: "nav_analytics", icon: BarChart3 },
  { href: "/dashboard/tournaments", key: "nav_tournaments", icon: Swords },
  { href: "/playgrounds", key: "nav_playgrounds", icon: LandPlot },
  { href: "/rentals", key: "nav_rentals", icon: HandCoins },
  { href: "/settings", key: "nav_settings", icon: Settings },
  { href: "/upgrade", key: "nav_upgrade", icon: Crown },
] as const;

const ownerItems = [
  { href: "/playgrounds", key: "nav_playgrounds", icon: LandPlot },
] as const;

const superAdminItems = [
  { href: "/admin?tab=Approvals", key: "nav_approvals", icon: ClipboardCheck },
  { href: "/admin", key: "super_admin_title", icon: Crown },
  { href: "/admin?tab=Members", key: "nav_members", icon: Users },
  { href: "/admin?tab=Academies", key: "nav_academies", icon: Building2 },
  { href: "/admin?tab=Messages", key: "nav_messages", icon: Mail },
  { href: "/admin?tab=Friendly%20games", key: "nav_games", icon: Volleyball },
  { href: "/admin?tab=Tournaments", key: "nav_tournaments", icon: Trophy },
  { href: "/admin?tab=Playgrounds", key: "nav_playgrounds", icon: LandPlot },
] as const;

const academyItems = [
  { href: "/profile", key: "nav_academy_profile", icon: Building2 },
] as const;

const memberItems = [
  { href: "/profile#checkin", key: "nav_profile", icon: QrCode },
  { href: "/profile#upcoming-training", key: "nav_schedule", icon: CalendarDays },
  { href: "/profile#training-renewal", key: "nav_profile", icon: CreditCard },
  { href: "/parent", key: "nav_profile", icon: Users },
  { href: "/games/beach-volleyball", key: "nav_games", icon: Gamepad2 },
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/academies", key: "nav_academies", icon: Search },
  { href: "/academy-bookings", key: "nav_academies", icon: CalendarDays },
  { href: "/following", key: "nav_following", icon: Heart },
  { href: "/schedule", key: "nav_schedule", icon: CalendarDays },
  { href: "/events", key: "nav_events", icon: Map },
  { href: "/dashboard/games", key: "nav_games", icon: Volleyball },
  { href: "/dashboard/tournaments", key: "nav_tournaments", icon: Swords },
  { href: "/community", key: "nav_community", icon: Network },
  { href: "/leaderboard", key: "nav_leaderboard", icon: Trophy },
  { href: "/scouting", key: "nav_scouting", icon: Radar },
  { href: "/profile", key: "nav_profile", icon: Users },
  { href: "/upgrade", key: "nav_upgrade", icon: Crown },
  { href: "/marketplace", key: "nav_marketplace", icon: Ticket },
] as const;

/** Available to academy staff: admins always, coaches when linked to a staff record. */
const staffItems = [
  { href: "/coach-ai", key: "nav_coach_ai", icon: BrainCircuit },
  { href: "/insights", key: "nav_insights", icon: Lightbulb },
] as const;

interface SidebarProps {
  role: Role;
  name: string;
  memberPlan?: "free" | "premium";
  isCoach?: boolean;
  hasAcademyWorkspace?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ role, name, memberPlan, isCoach, hasAcademyWorkspace, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();
  const catalog = role === "super_admin"
    ? superAdminItems
    : role === "playground_owner"
      ? ownerItems
      : role === "member"
        ? [...memberItems, ...staffItems, ...adminItems]
        : [...adminItems, ...academyItems, ...memberItems, ...staffItems];
  const memberLabels: Record<string, [string, string]> = {
    "/profile#checkin": ["My check-in code", "كود الحضور"],
    "/profile#upcoming-training": ["Upcoming training", "التدريب القادم"],
    "/profile#training-renewal": ["Training membership & renewal", "اشتراك التدريب وتجديده"],
    "/parent": ["My family", "عيلتي"],
    "/games/beach-volleyball": ["Virtual volleyball court", "الملعب الافتراضي"],
  };
  const group = (en: string, ar: string, paths: string[]) => ({
    label: lang === "ar" ? ar : en,
    items: paths.map(path => catalog.find(item => item.href === path)!),
  });
  const groups = role === "super_admin"
    ? [{ label: lang === "ar" ? "إدارة المنصة" : "Platform management", items: superAdminItems }]
    : role === "playground_owner" ? [
      group("My playgrounds", "الملاعب بتاعتي", ["/playgrounds"]),
    ]
    : role === "admin" ? [
      group("Daily operations", "الإدارة اليومية", ["/dashboard", "/academy", "/schedule", "/attendance", "/members"]),
      group("Academy & training", "الأكاديمية والتدريب", ["/teams", "/coaches", "/dashboard/tournaments", "/playgrounds", "/rentals"]),
      group("Finance & insights", "الماليات والإحصائيات", ["/costs", "/reports", "/analytics"]),
      group("AI coach & predictions", "الذكاء الاصطناعي والتنبؤات", ["/coach-ai", "/insights"]),
      group("Academy settings", "إعدادات الأكاديمية", ["/profile", "/settings", "/upgrade"]),
    ] : [
      ...(hasAcademyWorkspace ? [group("Academy staff", "فريق الأكاديمية", ["/academy"])] : []),
      group("My Playza", "بلايزا بتاعتي", ["/dashboard", "/profile", "/parent", "/games/beach-volleyball"]),
      group("My training & member pass", "تدريبي وكود الحضور", ["/profile#checkin", "/profile#upcoming-training", "/profile#training-renewal", "/schedule", "/academy-bookings"]),
      ...(isCoach ? [group("Coaching tools", "أدوات التدريب", ["/coaches", "/coach-ai", "/insights"])] : []),
      group("Find a place to play", "اكتشف مكان تلعب فيه", ["/academies", "/playgrounds", "/following", "/marketplace", "/dashboard/games", "/events"]),
      group("Community", "المجتمع", ["/community", "/leaderboard", "/scouting", "/dashboard/tournaments"]),
      group("Membership", "الاشتراك", ["/upgrade"]),
    ];

  return (
    <div className="playza-navigation flex h-full min-h-0 flex-col gap-4 p-4">
      <Link onClick={onNavigate} href={role === "super_admin" ? "/admin" : role === "playground_owner" ? "/playgrounds" : "/dashboard"} className="flex flex-col items-start gap-1 px-2 pt-2">
        <AppLogo />
        <div className="flex flex-col">

          <span className="text-[11px] text-muted-foreground">
            {t("appTagline")}
          </span>
        </div>
      </Link>

      <nav aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main navigation"} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
        {groups.map(group => <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
        {group.items.map(({ href, key, icon: Icon }) => {
          const active =
            role === "super_admin"
              ? pathname === "/admin" && (new URLSearchParams(href.split("?")[1]).get("tab") ?? "") === (searchParams.get("tab") ?? "")
              : pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
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
              <span className="min-w-0 flex-1 truncate">
                {role === "member" && memberLabels[href] ? memberLabels[href][lang === "ar" ? 1 : 0] : href === "/academy" ? (lang === "ar" ? "إدارة الأكاديمية" : "Academy workspace") : href === "/academy-bookings" ? (lang === "ar" ? "حجوزات الأكاديميات" : "Academy bookings") : href === "/profile" && role === "member" ? (lang === "ar" ? "ملفي وعيلتي" : "My profile & family") : t(key)}
              </span>
              {href === "/admin?tab=Messages" && role === "super_admin" && <MessagesUnreadBadge />}
            </Link>
          );
        })}
        </div>)}
      </nav>

      <ContactFormDialog
        trigger={
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {t("contact_menu")}
          </button>
        }
      />

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span>
            {role === "super_admin"
              ? t("role_super_admin")
              : role === "admin"
                ? t("role_admin")
                : role === "playground_owner"
                  ? t("role_playground_owner")
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
