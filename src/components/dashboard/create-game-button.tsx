"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateGameDialog } from "@/components/games/create-game-dialog";
import { authLink } from "@/lib/auth-redirect";
import { dashboardCreateGamePath, gameCreationSport } from "@/lib/game-creation";
import { useI18n } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

export function DashboardCreateGameButton({ sport, profile }: { sport: string; profile?: Profile }) {
  const params = useSearchParams();
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(params.get("create") === "1");
  const selected = gameCreationSport(sport);
  const unsupported = sport !== "all" && !selected;
  const label = <><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("games_create")}</>;
  if (unsupported) return <Button disabled title={lang === "ar" ? "إنشاء ماتشات للرياضة دي مش متاح حاليًا" : "Game creation for this sport is not available yet"}>{label}</Button>;
  if (!profile) return <Button asChild className="gap-2"><Link href={authLink("/login", dashboardCreateGamePath(sport))}>{label}</Link></Button>;
  return <>
    <Button className="gap-2" onClick={() => setOpen(true)}>{label}</Button>
    <CreateGameDialog open={open} onOpenChange={setOpen} initialSport={selected} memberPlan={profile.member_plan} />
  </>;
}
