"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, Home, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrentProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Home comes first so the dashboard is always one tap away; it was previously
// only reachable by opening the drawer.
const guestDestinations = [
  { href: "/", icon: Home, en: "Discover", ar: "اكتشف", exact: true },
  { href: "/games", icon: CalendarDays, en: "Games", ar: "الماتشات" },
  { href: "/courts", icon: GraduationCap, en: "Courts", ar: "الملاعب" },
  { href: "/academies", icon: UserRound, en: "Academies", ar: "الأكاديميات" },
] as const;

const destinations = [
  { href: "/dashboard", icon: Home, en: "Discover", ar: "اكتشف", exact: true },
  { href: "/dashboard/my-games", icon: CalendarDays, en: "My Games", ar: "ماتشاتي" },
  { href: "/academies", icon: GraduationCap, en: "Academies", ar: "الأكاديميات" },
  { href: "/profile", icon: UserRound, en: "Profile", ar: "حسابي" },
] as const;

export function MemberBottomNavigation({ guest = false }: { guest?: boolean }) {
  const pathname = usePathname();
  const { lang } = useI18n();

  return (
    <nav
      data-member-navigation
      aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main destinations"}
      className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_8px_35px_hsl(var(--playza-purple-dark)/0.1255)] backdrop-blur-lg lg:hidden sm:inset-x-auto sm:start-1/2 sm:w-[min(560px,calc(100%_-_24px))] sm:-translate-x-1/2 sm:rtl:translate-x-1/2"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-2 py-2">
        {(guest ? guestDestinations : destinations).map(({ href, en, ar, icon: Icon, ...rest }) => {
          // `/dashboard` is a prefix of every other dashboard route, so it must
          // match exactly or it would stay highlighted while browsing games.
          const active = "exact" in rest && rest.exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`) || (href === "/academies" && (pathname.startsWith("/a/") || pathname === "/dashboard/academies"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                active ? "bg-purple-100 text-purple-800" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate">{lang === "ar" ? ar : en}</span>
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
