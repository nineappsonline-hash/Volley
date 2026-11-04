"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { format } from "date-fns";
import { useMyUpcomingGames } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/shared/query-state";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { venueCardPhoto } from "@/lib/venue-media";
import { formatTime12h } from "@/lib/constants";
import styles from "./member-home.module.css";

export function DesktopNextGame({ memberId }: { memberId: string }) {
  const query = useMyUpcomingGames(memberId);
  const { lang, locale } = useI18n();
  const ar = lang === "ar";
  const game = [...(query.data ?? [])].filter(row => !row.is_waitlisted && ["open", "full"].includes(row.game.status)).sort((a, b) => `${a.game.game_date}T${a.game.start_time}`.localeCompare(`${b.game.game_date}T${b.game.start_time}`))[0]?.game;
  const photo = game && venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  const directions = googleDirectionsUrl(game?.playground?.location_link);
  return <aside className={styles.nextGame}><h2><CalendarDays size={28} />{ar ? "ماتشك الجاي" : "Your Next Game"}</h2><Link className={styles.nextGameViewAll} href="/dashboard/games">{ar ? "عرض الكل" : "View All"} →</Link><QueryState queries={[query]}>{game ? <div className={styles.nextGameCard}><div className={styles.nextGameInfo}><div className={styles.nextGamePhoto} style={{ backgroundImage: `url("${photo || '/images/playza-dashboard-sports.webp'}")` }} /><div><h3>{game.title}</h3><p><CalendarDays size={16} />{format(new Date(`${game.game_date}T00:00:00`), "EEE, MMM d", { locale })} · {formatTime12h(game.start_time, lang)}</p><p><MapPin size={16} />{game.playground?.name || game.location || game.area}</p></div></div><Link className={styles.nextGameMobileLink} href={`/dashboard/games?focus=${encodeURIComponent(game.id)}`} aria-label={ar ? `عرض حجز ${game.title}` : `View booking for ${game.title}`}>›</Link><div className={styles.nextGameActions}><Link href={`/dashboard/games?focus=${encodeURIComponent(game.id)}`}><Ticket size={20} />{ar ? "عرض الحجز" : "View Booking"}</Link>{directions && <GoogleMapsDirectionsButton href={directions} />}</div></div> : <div className={styles.nextGameCard}><p>{ar ? "ماتشك الجاي مستنيك. اختار ماتش وشارك!" : "Your next game is waiting. Find a game and join in!"}</p><Link className={styles.emptyGameLink} href="/dashboard/games">{ar ? "اكتشف الماتشات" : "Explore games"} →</Link></div>}</QueryState></aside>;
}
