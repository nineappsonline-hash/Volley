"use client";

import { DashboardGameList } from "@/components/dashboard/dashboard-game-list";
import { QueryState } from "@/components/shared/query-state";
import { useMyGames } from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";
import { useI18n } from "@/lib/i18n";
import { cairoNow } from "@/lib/member-training";
import type { Profile } from "@/lib/types";

export function MyGamesClient({ profile }: { profile: Profile }) {
  const query = useMyGames(profile.id);
  const { lang } = useI18n();
  const ar = lang === "ar";
  useRealtime(["friendly_games", "friendly_game_participants"]);
  const today = cairoNow().slice(0, 10);
  const games = query.data ?? [];
  const upcoming = games.filter(game => ["open", "full"].includes(game.status) && game.game_date >= today).sort((a,b) => `${a.game_date} ${a.start_time}`.localeCompare(`${b.game_date} ${b.start_time}`));
  const upcomingIds = new Set(upcoming.map(game => game.id));
  const history = games.filter(game => !upcomingIds.has(game.id)).sort((a, b) => Number(a.status === "cancelled") - Number(b.status === "cancelled") || `${b.game_date} ${b.start_time}`.localeCompare(`${a.game_date} ${a.start_time}`));
  return <div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-extrabold">{ar ? "ماتشاتي" : "My games"}</h1><p className="mt-2 text-sm text-muted-foreground">{ar ? "كل الماتشات اللي أنشأتها أو انضمّيت ليها، بما فيها الماتشات السابقة." : "All games you created or joined, including past games."}</p></header>
    <QueryState queries={[query]}>
      {!games.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{ar ? "لسه ما أنشأتش أو انضمّيت لأي ماتش." : "You haven’t created or joined any games yet."}</p> : <>
        {upcoming.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold">{ar ? "الماتشات الجاية" : "Upcoming games"}</h2><DashboardGameList games={upcoming} profile={profile} /></section>}
        {history.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold">{ar ? "الماتشات السابقة والملغاة" : "Past & cancelled games"}</h2><DashboardGameList games={history} profile={profile} /></section>}
      </>}
    </QueryState>
  </div>;
}
