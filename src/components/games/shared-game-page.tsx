"use client";

import { GameShareActions } from "./game-share-actions";
import Link from "next/link";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { AppLogo } from "@/components/shared/app-logo";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { addHoursToTime, formatTime12h, AR_NUMERIC_LOCALE } from "@/lib/constants";
import type { SharedGameMeta } from "@/lib/public-games";
import { GameParticipantNames, SignedInGameParticipantNames } from "./game-participant-names";
import { PublicGameJoin } from "./public-game-join";
import { gameIsJoinable, publicGamePath } from "@/lib/game-discovery";
import styles from "./shared-game-page.module.css";

export function SharedGamePage({ game, inviteCode }: { game: SharedGameMeta | null; inviteCode?: string }) {
  const { t, lang, dir } = useI18n();
  const ar = lang === "ar";
  const endTime = game ? addHoursToTime(game.start_time, game.duration_hours) : "";
  const nextDay = game && endTime && endTime <= game.start_time.slice(0, 5);
  return <main className="min-h-screen bg-background px-4 py-8" dir={dir}>
    <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between"><Link href="/" aria-label="Playza"><AppLogo /></Link><LanguageToggle /></header>
    <Card className={`mx-auto max-w-2xl ${styles.invitation}`}>
      <CardHeader><CardTitle><h1 className="break-words text-2xl font-extrabold">{game?.title ?? t("games_invite_invalid")}</h1></CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {game && <>
          <p className={styles.sport}>{game.sport}</p>
          <p><time dateTime={game.game_date}>{new Intl.DateTimeFormat(ar ? AR_NUMERIC_LOCALE : "en-GB", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`))}</time></p>
          <p className={styles.time}><bdi>{formatTime12h(game.start_time, lang)}{endTime && <> – {formatTime12h(endTime, lang)}</>}</bdi>{nextDay && <span className="text-sm">{ar ? "(تاني يوم)" : "(next day)"}</span>}<span className="text-sm">{ar ? "بتوقيت القاهرة" : "Cairo time"}</span></p>
          <p>{t(`games_gender_${game.gender}`)}</p>
          <p className="break-words">{game.map_label}</p>
          <div className={styles.actions}>
            <DirectionsLinks locationLink={game.location_link} lat={game.lat} lng={game.lng} query={game.map_label} />
            <div className={styles.share}><GameShareActions compact game={{ ...game, invite_code: inviteCode, place: game.map_label }} /></div>
          </div>
          <div className={styles.participants}>{inviteCode ? <GameParticipantNames participants={game.participants} /> : <SignedInGameParticipantNames gameId={game.id} publicCount={game.joined} />}</div>
          {!gameIsJoinable(game) && <p role="status">{game.status === "cancelled" ? (ar ? "الماتش اتلغى" : "Cancelled") : game.status === "completed" ? (ar ? "الماتش خلص" : "Completed") : (ar ? "الماتش بدأ أو ميعاده فات" : "This game has started or ended")}</p>}
          {gameIsJoinable(game) && <PublicGameJoin game={game} inviteCode={inviteCode} returnTo={inviteCode ? undefined : publicGamePath(game.id)} />}
        </>}
      </CardContent>
    </Card>
    <Link className="mx-auto mt-6 block max-w-2xl text-sm text-foreground underline-offset-4 hover:underline" href="/dashboard">{t("nav_dashboard")}</Link>
  </main>;
}
