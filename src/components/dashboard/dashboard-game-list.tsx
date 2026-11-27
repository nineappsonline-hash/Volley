"use client";

import styles from "./member-home.module.css";
import { useState } from "react";
import { toast } from "sonner";
import { GameCard } from "@/components/games/games-client";
import { useMyGameParticipants, usePlaygrounds, useMyUpcomingGames } from "@/lib/queries";
import { gamePlaygroundPhoto } from "@/lib/venue-media";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import type { FriendlyGameWithDetails, Profile } from "@/lib/types";

/** The same participation card used by My upcoming games, kept inline on home. */
export function DashboardGameList({ games, profile }: { games: FriendlyGameWithDetails[]; profile: Profile }) {
  const participants = useMyGameParticipants();
  const venues = usePlaygrounds();
  const upcoming = useMyUpcomingGames(profile.id);
  const { t } = useI18n();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      toast.error(t("common_error"));
    }
  };
  return <QueryState queries={[participants]}>
    <div className={`grid grid-cols-1 gap-5 xl:grid-cols-2`}>
      {games.map(game => {
        const upcomingGame = upcoming.data?.find(row => row.game.id === game.id || (row.game.title === game.title && row.game.game_date === game.game_date && row.game.start_time === game.start_time))?.game;
        const photo = gamePlaygroundPhoto(game, venues.data ?? []) || (upcomingGame ? gamePlaygroundPhoto(upcomingGame, venues.data ?? []) : null);
        const displayGame = photo ? { ...game, playground: { ...game.playground, name: game.playground?.name ?? upcomingGame?.playground?.name ?? game.location ?? "", photos: [photo], cover_url: photo } } as typeof game : game;
        return <div key={game.id} id={`game-${game.id}`} className="scroll-mt-20"><GameCard cinematic game={displayGame} profile={profile} myParticipants={participants.data ?? []} copiedKey={copiedKey} onCopy={copy} /></div>;
      })}
    </div>
  </QueryState>;
}
