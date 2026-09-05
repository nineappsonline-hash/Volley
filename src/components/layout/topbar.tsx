"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Notifications } from "@/components/layout/notifications";
import { useI18n } from "@/lib/i18n";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { useAuth } from "@/lib/auth";

interface TopbarProps {
  role: Role;
  name: string;
  memberPlan?: "free" | "premium";
}

export function Topbar({ role, name, memberPlan }: TopbarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <Sidebar role={role} name={name} memberPlan={memberPlan} />
        </SheetContent>
      </Sheet>

      <div className="ms-auto flex items-center gap-1">
        <Notifications />
        <ThemeToggle />
        <LanguageToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 rounded-full pe-1 ps-1 sm:pe-2"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(name) || "U"}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {name.split(" ")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="truncate font-medium">{name}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {role === "admin" ? t("role_admin") : t("role_member")}
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
