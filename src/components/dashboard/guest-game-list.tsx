"use client";

import Link from "next/link";
import detailsStyles from "./guest-game-list.module.css";
import { usePathname, useSearchParams } from "next/navigation";
import { GameCardShell } from "@/components/games/game-card-shell";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { authLink } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";
import type { FriendlyGameWithDetails } from "@/lib/types";

export function GuestGameList({ games }: { games: FriendlyGameWithDetails[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  return <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4`}>{games.map(game => {
    const next = new URLSearchParams(params.toString()); next.set("focus", game.id);
    const returnTo = `${pathname}?${next}#game-${game.id}`;
    return <div key={game.id} id={`game-${game.id}`} className="scroll-mt-20"><GameCardShell layout="cinematic" game={game} joined={false} initialExpanded={params.get("focus") === game.id}>
      <section className={detailsStyles.panel} aria-label={ar ? "تفاصيل الماتش" : "Game details"}>
        <div className={detailsStyles.info}>
          <span className={detailsStyles.tag}>{t(`games_gender_${game.gender}`)}</span>
          {game.skill_level && <span className={detailsStyles.tag}>{t(`skill_${game.skill_level}`)}</span>}
          <span className={detailsStyles.tag}>{ar ? "المدة" : "Duration"}: {game.duration_hours} {ar ? "ساعة" : "hours"}</span>
          {(game.min_age != null || game.max_age != null) && <span className={detailsStyles.tag}>{ar ? "العمر" : "Age"}: {game.min_age ?? 0}–{game.max_age ?? (ar ? "مفتوح" : "Any")}</span>}
        </div>
        {game.description && <p dir="auto" className={detailsStyles.description}>{game.description}</p>}
        <div className={detailsStyles.buttons}>
          <DirectionsLinks locationLink={game.playground?.location_link} venueId={game.playground_id} query={game.playground?.name ?? game.location ?? ""} compact className={detailsStyles.directions}/>
          <Link className={detailsStyles.join} href={authLink("/login", returnTo)}>{ar ? "انضم للماتش" : "Join game"} <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </GameCardShell></div>;
  })}</div>;
}
