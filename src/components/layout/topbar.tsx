"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LogOut, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Notifications } from "@/components/layout/notifications";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { ProfileAvatar } from "@/components/shared/profile-avatar";

interface TopbarProps {
  role: Role;
  name: string;
  username: string;
  avatarUrl?: string | null;
  avatarId?: string | null;
  memberPlan?: "free" | "premium";
  isCoach?: boolean;
  academy?: {
    plan: string;
    isTrial: boolean;
    trialEndsAt: string | null;
  } | null;
}

export function Topbar({ role, name, username, avatarUrl, avatarId, memberPlan, isCoach, academy }: TopbarProps) {
  const { t, lang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();

  const trialDaysLeft = useMemo(() => {
    if (!academy || !academy.isTrial || !academy.trialEndsAt) return null;
    const endsAt = new Date(academy.trialEndsAt);
    const days = Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 0 ? 0 : days;
  }, [academy]);

  const planLabel = academy ? t(`plan_${academy.plan}` as any) : "";

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="pwa-pad-top sticky top-0 z-40 border-b bg-card/95 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className={role === "member" ? "" : "lg:hidden"} aria-label={lang === "ar" ? "افتح القائمة" : "Open navigation"}>
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">{lang === "ar" ? "القائمة الرئيسية" : "Main navigation"}</SheetTitle>
          <Sidebar onNavigate={() => setMenuOpen(false)} role={role} name={name} memberPlan={memberPlan} isCoach={isCoach} />
        </SheetContent>
      </Sheet>

      <div className="ms-auto flex items-center gap-1">
        {role === "admin" && academy && (
          <span
            className="hidden items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:inline-flex"
            title={academy.isTrial ? "Trial" : undefined}
          >
            {academy.isTrial && trialDaysLeft !== null
              ? trialDaysLeft > 0
                ? t("topbar_trial_left").replace("{plan}", planLabel).replace("{n}", String(trialDaysLeft)).replace("{s}", trialDaysLeft === 1 ? "" : "s")
                : t("topbar_trial_expired").replace("{plan}", planLabel)
              : planLabel}
          </span>
        )}
        {role !== "super_admin" && <Notifications />}
        <ThemeToggle />
        <LanguageToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label={lang === "ar" ? "قائمة الحساب" : "Account menu"}
              className="gap-2 rounded-full pe-1 ps-1 sm:pe-2"
            >
              <ProfileAvatar name={name} url={avatarUrl} avatarId={avatarId} className="h-7 w-7" />
              <span className="hidden text-sm font-medium sm:inline">
                {name.split(" ")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="truncate font-medium">{name}</p>
              {username && (
                <p className="truncate text-xs font-normal text-primary">
                  @{username}
                </p>
              )}
              <p className="text-xs font-normal text-muted-foreground">
                {role === "super_admin" ? t("role_super_admin") : role === "admin" ? t("role_admin") : role === "playground_owner" ? t("role_playground_owner") : t("role_member")}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role === "member" && (
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserRound />
                {t("nav_profile")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut />
              {t("common_logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </header>
  );
}
