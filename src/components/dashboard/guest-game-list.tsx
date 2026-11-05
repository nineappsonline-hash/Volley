"use client";

import Link from "next/link";
import styles from "./member-home.module.css";
import { usePathname, useSearchParams } from "next/navigation";
import { GameCardShell } from "@/components/games/game-card-shell";
import { Button } from "@/components/ui/button";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { authLink } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";
import type { FriendlyGameWithDetails } from "@/lib/types";

export function GuestGameList({ games }: { games: FriendlyGameWithDetails[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  return <div className={`flex flex-col gap-3 ${styles.desktopGames}`}>{games.map(game => {
    const next = new URLSearchParams(params.toString()); next.set("focus", game.id);
    const returnTo = `${pathname}?${next}#game-${game.id}`;
    return <div key={game.id} id={`game-${game.id}`} className="scroll-mt-20"><GameCardShell layout="list" game={game} joined={false} initialExpanded={params.get("focus") === game.id}>
      <div className="space-y-3 p-4 text-sm">
        {game.description && <p className="whitespace-pre-wrap">{game.description}</p>}
        <p>{t(`games_gender_${game.gender}`)}{game.skill_level ? ` · ${t(`skill_${game.skill_level}`)}` : ""}</p>
        {(game.min_age != null || game.max_age != null) && <p>{ar ? "العمر" : "Age"}: {game.min_age ?? 0}–{game.max_age ?? (ar ? "بدون حد أقصى" : "No maximum")}</p>}
        <p>{ar ? "المدة" : "Duration"}: {game.duration_hours} {ar ? "ساعة" : "hours"}</p>
        <DirectionsLinks locationLink={game.playground?.location_link} query={game.playground?.name ?? game.location ?? ""} />
        <Button asChild><Link href={authLink("/login", returnTo)}>{ar ? "انضم للماتش" : "Join game"}</Link></Button>
      </div>
    </GameCardShell></div>;
  })}</div>;
}
