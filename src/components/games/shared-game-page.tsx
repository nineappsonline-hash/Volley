"use client";

import { AnalyticsView } from "@/components/analytics/business-analytics";
import { GameShareActions } from "./game-share-actions";
import Link from "next/link";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { AppLogo } from "@/components/shared/app-logo";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { addHoursToTime, formatMoney, formatTime12h, AR_NUMERIC_LOCALE } from "@/lib/constants";
import { venueCardPhoto } from "@/lib/venue-media";
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
  const photo = game ? venueCardPhoto(game.photos, game.cover_url) : null;
  const price = game ? (game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price, lang)) : "";
  return <main className="min-h-screen bg-transparent px-4 py-8" dir={dir}>
    {game && <AnalyticsView event="game_view" id={game.id} context={{sport:game.sport,area:game.area,governorate:game.governorate}} />}
    <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between"><Link href="/" aria-label="Playza"><AppLogo /></Link><LanguageToggle /></header>
    <Card className={`mx-auto max-w-2xl ${styles.invitation}`}>
      <CardHeader>
        <div className={styles.headline}>
          {game && <span className={styles.thumb}>
            {!photo && <span className={styles.thumbFallback} aria-hidden="true">{game.sport}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo && <img src={photo} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} />}
            <span className={styles.thumbLabel}>{game.sport}</span>
          </span>}
          <CardTitle><h1 className="break-words text-2xl font-extrabold">{game?.title ?? t("games_invite_invalid")}</h1></CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {game && <>
          <div className={styles.shareBar}>
            <GameShareActions game={{ ...game, place: game.map_label ?? game.location_link ?? "" }} compact={false} />
            {gameIsJoinable(game) && <div className={styles.inviteBar}>\n              <button onClick={() => navigator.clipboard.writeText(publicGamePath(game.id))} className="border rounded px-4 py-2 text-sm hover:bg-muted/30">{lang === "ar" ? "انسخ الرابط" : "Copy link"}</button>\n              <a href="https://wa.me/?text={encodeURIComponent(`${game.title}\n${publicGamePath(game.id)}`)}" target="_blank" rel="noopener noreferrer" className="ml-3 border rounded px-4 py-2 text-sm hover:bg-muted/30">{lang === "ar" ? "واتساب" : "WhatsApp"}</a>\n            </div>}\n          </div>\n          <div className={styles.meta}>
            <p className={styles.metaLine}><bdi>{formatTime12h(game.start_time, lang)}{endTime && <> – {formatTime12h(endTime, lang)}</>}</bdi>{nextDay && <span className={styles.muted}>{ar ? "(تاني يوم)" : "(next day)"}</span>}<span className={styles.muted}>{ar ? "بتوقيت القاهرة" : "Cairo time"}</span></p>
            <p className={styles.metaLine}><time dateTime={game.game_date}>{new Intl.DateTimeFormat(ar ? AR_NUMERIC_LOCALE : "en-GB", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`))}</time></p>
            <p className={styles.metaLine}>{t(`games_gender_${game.gender}`)}<span className={styles.sep} aria-hidden="true">·</span><span className="break-words">{game.map_label}</span></p>
          </div>
          <p className={styles.price}>{price}{!game.host_pays && game.share_price != null && <span className="text-sm">{ar ? "لكل لاعب" : "per player"}</span>}</p>
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
