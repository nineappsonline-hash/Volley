"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, LandPlot, Trophy, Volleyball } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrentProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Home comes first so the dashboard is always one tap away; it was previously
// only reachable by opening the drawer.
const destinations = [
  { href: "/dashboard", key: "nav_dashboard", icon: Home, exact: true },
  { href: "/dashboard/games", key: "nav_games", icon: Volleyball },
  { href: "/playgrounds", key: "nav_playgrounds", icon: LandPlot },
  { href: "/dashboard/tournaments", key: "nav_tournaments", icon: Trophy },
  { href: "/academies", key: "nav_academies", icon: Building2 },
] as const;

export function MemberBottomNavigation() {
  const pathname = usePathname();
  const { t, lang } = useI18n();

  return (
    <nav
      data-member-navigation
      aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main destinations"}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-2">
        {destinations.map(({ href, key, icon: Icon, ...rest }) => {
          // `/dashboard` is a prefix of every other dashboard route, so it must
          // match exactly or it would stay highlighted while browsing games.
          const active = "exact" in rest && rest.exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`) || (href === "/academies" && pathname.startsWith("/a/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// The academy directory is public and lives outside the authenticated layout.
export function AcademyMemberNavigation() {
  const { data: profile } = useCurrentProfile();
  if (profile?.role !== "member") return null;
  return <div className="h-[calc(6rem+env(safe-area-inset-bottom))]"><MemberBottomNavigation /></div>;
}
