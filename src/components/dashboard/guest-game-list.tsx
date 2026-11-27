"use client";

import Link from "next/link";
import detailsStyles from "./guest-game-list.module.css";
import { usePathname, useSearchParams } from "next/navigation";
import { GameCardShell } from "@/components/games/game-card-shell";
import { SignedInGameParticipantNames } from "@/components/games/game-participant-names";
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
    return <div key={game.id} id={`game-${game.id}`} className="scroll-mt-20"><GameCardShell layout="cinematic" joinHref={authLink("/login", returnTo)} game={game} joined={false} initialExpanded={params.get("focus") === game.id}>
      <section className={detailsStyles.panel} aria-label={ar ? "تفاصيل الماتش" : "Game details"}>
        <SignedInGameParticipantNames gameId={game.id} publicCount={game.participants_count} defaultOpen />
        <div className={detailsStyles.buttons}>
          <Link className={detailsStyles.report} href={authLink("/login", returnTo)}>
            {ar ? "إبلاغ" : "Report"} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </GameCardShell></div>;
  })}</div>;
}
