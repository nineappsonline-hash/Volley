"use client";

import { useState } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { useMyUpcomingGames, useUpcomingGameParticipants } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRealtime } from "@/lib/useRealtime";

export function MyUpcomingGames({ memberId }: { memberId: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const query = useMyUpcomingGames(memberId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.find(row => row.game.id === selectedId);
  const roster = useUpcomingGameParticipants(selectedId, memberId);
  useRealtime(["friendly_games", "friendly_game_participants"]);
  return <>
    <Card id="my-upcoming-games" className="border-2 border-primary/30 bg-primary/5 shadow-md">
      <CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-2xl"><CalendarDays className="h-7 w-7 text-primary" />{t("games_my_upcoming")}</CardTitle></CardHeader>
      <CardContent><QueryState queries={[query]}>
        {!query.data?.length ? <p className="text-sm text-muted-foreground">{t("games_my_upcoming_empty")}</p> :
          <ul className="grid gap-4 md:grid-cols-2">{query.data.map(({ id, game, is_waitlisted }) => <li key={id}>
            <button type="button" onClick={() => setSelectedId(game.id)} className="h-full w-full space-y-3 rounded-xl border bg-card p-6 text-start shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{game.sport}</Badge>{is_waitlisted && <Badge variant="secondary">{ar ? "قائمة الانتظار" : "Waitlisted"}</Badge>}</div>
              <h3 className="text-xl font-bold">{game.title}</h3>
              <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 shrink-0" />{game.game_date}</p>
              <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 shrink-0" />{game.start_time.slice(0, 5)} · {game.duration_hours} {ar ? "ساعة" : "hours"}</p>
              {(game.location || game.area) && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" />{[game.location, game.area].filter(Boolean).join(" · ")}</p>}
              <p className="font-semibold text-info-ink">{ar ? "عرض تفاصيل المباراة والمشاركين" : "View game details and participants"}</p>
            </button>
          </li>)}</ul>}
      </QueryState></CardContent>
    </Card>
    <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{selected?.game.title ?? t("games_my_upcoming")}</DialogTitle><DialogDescription>{ar ? "تفاصيل المباراة والمشاركون" : "Game details and participants"}</DialogDescription></DialogHeader>
        {selected && <div className="space-y-3">
          <Badge variant="secondary">{selected.game.sport}</Badge>
          <p>{selected.game.game_date} · {selected.game.start_time.slice(0, 5)} · {selected.game.duration_hours} {ar ? "ساعة" : "hours"}</p>
          <p>{[selected.game.location, selected.game.area].filter(Boolean).join(" · ")}</p>
          {selected.game.description && <p className="whitespace-pre-wrap">{selected.game.description}</p>}
          <h3 className="flex items-center gap-2 pt-3 text-lg font-semibold"><Users className="h-5 w-5" />{ar ? "المشاركون" : "Participants"}{roster.data && ` (${roster.data.filter(p => !p.is_waitlisted).length}/${selected.game.max_players})`}</h3>
          <QueryState queries={[roster]}>
            {!roster.data?.length ? <p className="text-muted-foreground">{ar ? "لا يوجد مشاركون بعد" : "No participants yet"}</p> : <ul className="space-y-2">{roster.data.map(player => <li key={player.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>{player.player_name}</span>
              {player.is_waitlisted && <Badge variant="secondary">{ar ? "قائمة الانتظار" : "Waitlisted"}</Badge>}
            </li>)}</ul>}
          </QueryState>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
