"use client";

import Link from "next/link";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { AppLogo } from "@/components/shared/app-logo";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import type { SharedGameMeta } from "@/lib/public-games";
import { GameParticipantNames } from "./game-participant-names";
import { PublicGameJoin } from "./public-game-join";

export function SharedGamePage({ game, inviteCode }: { game: SharedGameMeta | null; inviteCode: string }) {
  const { t, lang } = useI18n();
  return <main className="min-h-screen bg-background px-4 py-8">
    <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between"><Link href="/" aria-label="Playza"><AppLogo /></Link><LanguageToggle /></header>
    <Card className="mx-auto max-w-2xl">
      <CardHeader><CardTitle className="break-words">{game?.title ?? t("games_invite_invalid")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {game && <>
          <p>{game.sport} · {game.game_date} · {formatTime12h(game.start_time, lang)}</p>
          <p>{t(`games_gender_${game.gender}`)}</p>
          <p>{[game.map_label, game.governorate, game.area].filter(Boolean).join(" · ")}</p>
          <DirectionsLinks locationLink={game.location_link} lat={game.lat} lng={game.lng} query={game.map_label} />
          <GameParticipantNames participants={game.participants} />
          {game.description && <p className="whitespace-pre-wrap break-words">{game.description}</p>}
          <p>{formatMoney(game.host_pays ? 0 : (game.share_price ?? 0), lang)}</p>
          {game.status !== "completed" && game.game_date >= new Date().toISOString().slice(0, 10) && <PublicGameJoin game={game} inviteCode={inviteCode} />}
        </>}
        <Link className="block text-sm text-foreground hover:underline underline-offset-4" href="/dashboard">{t("nav_dashboard")}</Link>
      </CardContent>
    </Card>
  </main>;
}
