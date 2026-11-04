"use client";

import styles from "./member-home.module.css";
import { useState } from "react";
import { toast } from "sonner";
import { GameCard } from "@/components/games/games-client";
import { useMyGameParticipants } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import type { FriendlyGameWithDetails, Profile } from "@/lib/types";

/** The same participation card used by My upcoming games, kept inline on home. */
export function DashboardGameList({ games, profile }: { games: FriendlyGameWithDetails[]; profile: Profile }) {
  const participants = useMyGameParticipants();
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
    <div className={`flex flex-col gap-3 ${styles.desktopGames}`}>
      {games.map(game => <div key={game.id} id={`game-${game.id}`} className="scroll-mt-20"><GameCard game={game} profile={profile} myParticipants={participants.data ?? []} copiedKey={copiedKey} onCopy={copy} /></div>)}
    </div>
  </QueryState>;
}
