"use client";

import { useEffect, useState } from "react";
import { useUpcomingGameParticipants } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";

type Player = { id: string; player_name: string; is_waitlisted: boolean };

export function GameParticipantNames({ participants }: { participants: Player[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
    <h3 className="text-sm font-semibold">{ar ? "المشاركون" : "Participants"}</h3>
    {participants.length === 0 ? <p className="text-xs text-muted-foreground">{ar ? "لا يوجد مشاركون بعد" : "No participants yet"}</p> :
      <ul className="flex flex-wrap gap-2">{[...participants].sort((a, b) => a.player_name.localeCompare(b.player_name, lang)).map(player =>
        <li key={player.id} className="rounded-md bg-background px-2 py-1 text-sm">{player.player_name}{player.is_waitlisted && <span className="ms-1 text-xs text-muted-foreground">({ar ? "قائمة الانتظار" : "Waitlisted"})</span>}</li>
      )}</ul>}
  </section>;
}

/** Public pages fetch names only after checking the visitor's session. */
export function SignedInGameParticipantNames({ gameId }: { gameId: string }) {
  const [memberId, setMemberId] = useState("");
  useEffect(() => {
    const client = createClient();
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (active) setMemberId(session?.user.id ?? "");
    });
    void client.auth.getUser().then(({ data }) => {
      if (active && !authChanged) setMemberId(data.user?.id ?? "");
    }).catch(() => {});
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const query = useUpcomingGameParticipants(gameId, memberId);
  if (!memberId) return null;
  return <QueryState queries={[query]}><GameParticipantNames participants={query.data ?? []} /></QueryState>;
}
