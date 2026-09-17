"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { useUpcomingGameParticipants } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import { cn } from "@/lib/utils";

type Player = { id: string; player_name: string; is_waitlisted: boolean };

export function GameParticipantNames({ participants }: { participants: Player[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const heading = ar ? "المشاركون" : "Participants";
  const count = participants.length;
  return (
    <section className="rounded-lg border bg-muted/20">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" />
          {heading}
          <span className="text-xs font-normal text-muted-foreground">
            ({count})
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="border-t p-3">
          {count === 0 ? (
            <p className="text-xs text-muted-foreground">{ar ? "لا يوجد مشاركون بعد" : "No participants yet"}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {[...participants].sort((a, b) => a.player_name.localeCompare(b.player_name, lang)).map((player) => (
                <li key={player.id} className="rounded-md bg-background px-2 py-1 text-sm">
                  {player.player_name}
                  {player.is_waitlisted && (
                    <span className="ms-1 text-xs text-muted-foreground">
                      ({ar ? "قائمة الانتظار" : "Waitlisted"})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
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