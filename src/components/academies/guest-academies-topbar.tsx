"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, GraduationCap, Home, Menu, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { authLink } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";
import dashboardStyles from "@/components/dashboard/member-home.module.css";

// Avoid importing the member/admin Sidebar, authentication, notifications and
// account dropdown code on public first paint. Load the exact existing guest
// navigation only if the visitor opens the menu.
const GuestSidebar = dynamic(
  () => import("@/components/layout/sidebar").then(mod => mod.Sidebar),
  { ssr: false },
);

const links = [
  { href: "/dashboard", icon: Home, en: "Discover", ar: "اكتشف" },
  { href: "/dashboard/games", icon: CalendarDays, en: "My Games", ar: "ماتشاتي" },
  { href: "/dashboard/academies", icon: GraduationCap, en: "Academies", ar: "الأكاديميات" },
  { href: "/dashboard/tournaments", icon: Trophy, en: "Tournaments", ar: "البطولات" },
  { href: "/profile#evaluations", icon: TrendingUp, en: "Player Development", ar: "تطور اللاعب" },
];

export function GuestAcademiesTopbar() {
  const { lang } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const loginHref = authLink("/login", `${pathname}${searchParams.size ? `?${searchParams}` : ""}`);

  return (
    <header className={`pwa-pad-top sticky top-0 z-40 border-b bg-card/95 backdrop-blur-md ${dashboardStyles.mobileTopbar}`}>
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={lang === "ar" ? "افتح القائمة" : "Open navigation"}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72 p-0" aria-describedby={undefined}>
            <SheetTitle className="sr-only">{lang === "ar" ? "القائمة الرئيسية" : "Main navigation"}</SheetTitle>
            {menuOpen && (
              <GuestSidebar guest role="member" name="" onNavigate={() => setMenuOpen(false)} />
            )}
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" aria-label={lang === "ar" ? "الصفحة الرئيسية" : "Go to dashboard"} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AppLogo className="h-7 w-auto" />
        </Link>
        <nav className="mx-auto hidden items-center gap-2 lg:flex" aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main navigation"}>
          {links.map(({ href, icon: Icon, en, ar }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-purple-100 ${pathname === href ? "bg-purple-100 text-purple-800" : ""}`}>
              <Icon size={21} />{lang === "ar" ? ar : en}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle />
          <Button asChild size="sm">
            <Link href={loginHref}>{lang === "ar" ? "دخول / حساب جديد" : "Sign in / Sign up"}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
