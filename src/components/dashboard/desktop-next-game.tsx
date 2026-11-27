"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Ticket, UsersRound, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { useMyUpcomingGames } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { GameShareActions } from "@/components/games/game-share-actions";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { sportToSlug } from "@/lib/sport-slugs";
import { SportIcon } from "@/components/marketing/sport-icons";
import { formatTime12h, formatMoney } from "@/lib/constants";
import styles from "./next-game-premium.module.css";

const sports: Record<string, string> = {
  Volleyball: "كرة طائرة", "Beach Volleyball": "طائرة شاطئية",
  Basketball: "كرة سلة", Padel: "بادل", Tennis: "تنس",
};

function gameEnd(start: string, hours: number, lang: "ar" | "en") {
  const match = /^(\d{1,2}):(\d{2})/.exec(start);
  if (!match || !Number.isFinite(hours)) return null;
  const mins = (Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60)) % 1440;
  return formatTime12h(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`, lang);
}

export function DesktopNextGame({ memberId }: { memberId: string }) {
  const query = useMyUpcomingGames(memberId);
  const { lang, locale } = useI18n();
  const ar = lang === "ar";
  const row = [...(query.data ?? [])]
    .filter(item => !item.is_waitlisted && ["open", "full"].includes(item.game.status))
    .sort((a, b) => `${a.game.game_date}T${a.game.start_time}`.localeCompare(`${b.game.game_date}T${b.game.start_time}`))[0];
  const game = row?.game;
  const directions = googleDirectionsUrl(game?.playground?.location_link);
  const bookingHref = game ? `/dashboard/games?focus=${encodeURIComponent(game.id)}` : "/dashboard/games";
  const sport = game ? sportToSlug(game.sport) : "volleyball";
  const imageSport = ["volleyball", "beach-volleyball", "basketball", "padel", "tennis"].includes(sport) ? sport : "volleyball";
  const end = game ? gameEnd(game.start_time, game.duration_hours, lang) : null;
  const count = game?.participants_count ?? null;
  const progress = count === null ? null : Math.max(0, Math.min(100, count / Math.max(1, game!.max_players) * 100));
  const full = game?.status === "full" || (count !== null && !!game && count >= game.max_players);
  const place = [game?.playground?.name ?? game?.location ?? game?.area, game?.playground?.area ?? (game?.playground?.name ? game?.area : null)].filter(Boolean).join(" · ");
  const price = game ? (game.host_pays || game.share_price === 0
    ? (ar ? "مجاني" : "Free")
    : game.share_price == null ? (ar ? "السعر عند الحجز" : "See booking") : formatMoney(game.share_price, lang)) : "";
  return <aside className={styles.section} aria-label={ar ? "ماتشك الجاي" : "Your next game"}>
    <QueryState queries={[query]}>
      {game ? <article className={styles.card} data-sport={imageSport} dir="ltr">
        <div className={styles.photo} style={{ backgroundImage: 'url("/images/playza-next-game-designed.avif")' }} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.body}>
          <header className={styles.eyebrow}><CalendarDays size={26} aria-hidden="true"/><span>{ar ? "ماتشك الجاي" : "Your Next Game"}</span></header>
          <h2 className={styles.title} dir="auto">{game.title}</h2>
          <div className={styles.badges}>
            <span className={styles.sport}><span aria-hidden="true">{SportIcon({ id: sport, size: 20 })}</span><span>{ar ? (sports[game.sport] ?? game.sport) : game.sport}</span></span>
            <span className={styles.gender}>{game.gender === "mixed" ? (ar ? "ميكس" : "Mixed") : game.gender === "male" ? (ar ? "رجالة بس" : "Men only") : (ar ? "سيدات بس" : "Women only")}</span>
            <span className={styles.confirmed}><CheckCircle2 size={17} />{ar ? "الحجز مؤكد" : "Confirmed"}</span>
          </div>
          <div className={styles.meta}>
            <span><CalendarDays size={18} /><time dateTime={game.game_date}>{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })}</time></span>
            <span><Clock3 size={18} /><span dir="ltr">{formatTime12h(game.start_time, lang)}{end ? ` – ${end}` : ""}</span></span>
            <span><MapPin size={18} /><span dir="auto">{place || (ar ? "المكان غير محدد" : "Venue to be confirmed")}</span></span>
          </div>
          <div className={styles.lower}>
            <div className={styles.infoRow}>
              <div className={styles.price}><strong>{price}</strong><small>{ar ? "للفرد" : "per player"}</small></div>
              <div className={styles.players}>
                <div className={styles.playerText}>
                  <span><UsersRound size={18} />{count !== null ? `${count}/${game.max_players} ${ar ? "لاعب" : "players"}` : (ar ? `السعة ${game.max_players} لاعب` : `${game.max_players} player capacity`)}</span>
                  {count !== null && <span>{full ? (ar ? "مكتمل" : "Full") : (ar ? `${game.max_players - count} أماكن متاحة` : `${game.max_players - count} spots left`)}</span>}
                </div>
                <div className={styles.track} aria-hidden="true"><div style={{ width: `${progress ?? (full ? 100 : 0)}%` }} /></div>
              </div>
            </div>
            <div className={styles.actions}>
              <Link href={bookingHref} className={styles.booking}><Ticket size={21}/>{ar ? "عرض الحجز" : "View Booking"}<ArrowUpRight size={19}/></Link>
              {directions && <GoogleMapsDirectionsButton href={directions} compact className={styles.directions}/>}
              <div className={styles.share}><GameShareActions compact game={{
                id:game.id,title:game.title,sport:game.sport,game_date:game.game_date,start_time:game.start_time,
                status:game.status,max_players:game.max_players,joined:count ?? 0,share_price:game.share_price,
                host_pays:game.host_pays,is_public:game.is_public,invite_code:game.invite_code,
                duration_hours:game.duration_hours,place:place || "",
              }}/></div>
            </div>
          </div>
        </div>
      </article> : <div className={styles.empty}>
        <CalendarDays size={28}/>
        <div><h2>{ar ? "ماتشك الجاي" : "Your Next Game"}</h2><p>{ar ? "ماتشك الجاي مستنيك. اختار ماتش واحجز مكانك!" : "Your next game is waiting. Find a game and join!"}</p></div>
        <Link href="/games">{ar ? "اكتشف الماتشات" : "Explore games"} <ArrowUpRight size={17}/></Link>
      </div>}
    </QueryState>
  </aside>;
}
