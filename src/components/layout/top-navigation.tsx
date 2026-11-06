"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { AppLogo } from "@/components/shared/app-logo";

export function TopNavigation() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => (ar ? arabic : en);

  return (
    <header className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
      <Link href="/" aria-label="Playza">
        <AppLogo className="h-8 w-auto" />
      </Link>
      <nav className="hidden sm:flex items-center gap-3" aria-label={copy("Main navigation", "القائمة الرئيسية")}>
        <Link href="/games" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Join a game", "انضم لماتش")}
        </Link>
        <Link href="/courts" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Find your court", "لاقي ملعبك")}
        </Link>
        <Link href="/academies" className="text-xs font-medium text-primary">
          {copy("Academies", "الأكاديميات")}
        </Link>
        <Link href="/dashboard?sport=tennis" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Tennis", "التنس")}
        </Link>
        <Link href="/dashboard?sport=padel" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Padel", "البادل")}
        </Link>
        <Link href="/dashboard?sport=archery" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Archery", "الرماية بالقوس")}
        </Link>
        <Link href="/dashboard?sport=beach-volleyball" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Beach volleyball", "الطائرة الشاطئية")}
        </Link>
        <Link href="/dashboard" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("Play now", "العب دلوقتي")}
        </Link>
        <Link href="/dashboard" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {copy("The sports", "الرياضات")}
        </Link>
        <Link href="/shop" className="text-xs font-semibold text-secondary">{copy("Shop", "المتجر")}</Link>
      </nav>
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          {copy("Sign in", "تسجيل الدخول")}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </header>
  );
}
