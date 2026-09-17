"use client";
import Link from "next/link";
import { useMyUpcomingGames } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/lib/useRealtime";

export function MyUpcomingGames({ memberId }: { memberId: string }) {
  const { t, lang } = useI18n();
  const query = useMyUpcomingGames(memberId);
  useRealtime(["friendly_games", "friendly_game_participants"]);
  return <Card id="my-upcoming-games">
    <CardHeader><CardTitle>{t("games_my_upcoming")}</CardTitle></CardHeader>
    <CardContent><QueryState queries={[query]}>
      {!query.data?.length ? <p className="text-sm text-muted-foreground">{t("games_my_upcoming_empty")}</p> :
        <ul className="space-y-3">{query.data.map(({ id, game, is_waitlisted }) => <li key={id} className="rounded-lg border p-3">
          <Link className="font-semibold text-info-ink" href={game.invite_code ? `/games?join=${encodeURIComponent(game.invite_code)}` : "/dashboard/games"}>{game.title}</Link>
          <p className="text-sm text-muted-foreground">{game.sport} · {game.game_date} · {game.start_time.slice(0, 5)}{game.area ? ` · ${game.area}` : ""}</p>
          {is_waitlisted && <Badge variant="secondary">{lang === "ar" ? "قائمة الانتظار" : "Waitlisted"}</Badge>}
        </li>)}</ul>}
    </QueryState></CardContent>
  </Card>;
}
