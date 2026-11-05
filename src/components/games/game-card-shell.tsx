"use client";

import styles from "./game-card-shell.module.css";
import { trackView } from "@/lib/analytics/events";
import { GameShareActions } from "./game-share-actions";
import Link from "next/link";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { useEffect, useId, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, ChevronDown, Clock, MapPin, Trophy, Users, CheckCircle2 } from "lucide-react";
import { sportToSlug } from "@/lib/sport-slugs";
import { SportIcon } from "@/components/marketing/sport-icons";
import { venueCardPhoto } from "@/lib/venue-media";
import { GameCardBackground } from "./game-card-background";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { gameBookingPayment } from "@/lib/game-costs";
import type { FriendlyGameWithDetails } from "@/lib/types";

/** Compact overview shared by the games directory and community feed. */
export function GameCardShell({ game, joined, waitlisted, children, detailsHref, initialExpanded = false, layout = "card", hideActionsWhenExpanded = false }: { detailsHref?: string; initialExpanded?: boolean; layout?: "card" | "list"; game: FriendlyGameWithDetails; joined: boolean; waitlisted?: boolean; children?: ReactNode; hideActionsWhenExpanded?: boolean }) {
  const { lang, locale, t } = useI18n();
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState(initialExpanded);
  const detailsId = useId();
  useEffect(() => {
    if (expanded && !detailsHref) trackView("game_view", game.id, {sport:game.sport,area:game.area,country:game.playground?.country,governorate:game.playground?.governorate});
  }, [expanded,detailsHref,game.id,game.sport,game.area,game.playground?.country,game.playground?.governorate]);
  const players = (game.participants ?? []).filter(p => !p.is_waitlisted);
  const slots = Math.max(0, game.max_players - game.participants_count);
  const percent = Math.min(100, Math.max(0, game.participants_count / Math.max(1, game.max_players) * 100));
  const sport = sportToSlug(game.sport);
  const theme = sport === "football" ? "from-brand to-brand-900"
    : sport === "basketball" ? "from-brand to-brand-900"
    : sport === "tennis" || sport === "padel" ? "from-brand to-brand-900"
    : "from-brand to-brand-900";
  const photo = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  const booking = gameBookingPayment(game);
  const statusStyle = game.status === "completed" ? "border-emerald-200/40 bg-emerald-700" : game.status === "open" ? "border-blue-200/40 bg-blue-600" : game.status === "full" ? "border-red-400/60 bg-red-700 ring-2 ring-red-400/70" : "border-red-200/40 bg-red-700";
  const Indicator = detailsHref ? ArrowUpRight : ChevronDown;
  const overviewClass = `${styles.content} flex w-full items-start gap-3 p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-3`;
  const directions = googleDirectionsUrl(game.playground?.location_link);
  const share = <GameShareActions compact game={{...game,joined:game.participants_count,place:[game.playground?.name,game.playground?.area??game.area,game.playground?.governorate].filter(Boolean).join(", ")||game.location||""}} />;
  const overview = <>
      <span data-game-photo="" className="relative isolate block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand">
        {!photo && <span className="absolute inset-0 flex items-center justify-center text-white/30" aria-hidden="true">{SportIcon({ id: sport, size: 48 })}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />}
        <span className={styles.mobileStatus}>{game.status === "open" ? (slots <= 2 ? (ar ? "قرب يكتمل" : "Almost Full") : (ar ? "متاح" : "Open")) : t(`community_status_${game.status}`)}</span>
        <span className="absolute inset-x-0 bottom-0 bg-brand/95 px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-highlight sm:text-[10px]">{game.sport}</span>
      </span>
      <span data-game-info="" className="block min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-extrabold leading-5 sm:text-base">{game.title}</span><Indicator size={16} className={`mt-0.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></span>
        <span className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-1">{game.playground?.name || game.location || game.area || t("games_no_playground")}</span></span>
        <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 text-xs"><span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><time className="block" dateTime={game.game_date}>{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })}</time><span className="block text-muted-foreground">{formatTime12h(game.start_time, lang)}</span></span><span className="text-end"><strong className={`block text-sm ${styles.price}`}>{game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price, lang)}</strong><span className="text-[10px] text-muted-foreground">{ar ? "لكل لاعب" : "per player"}</span></span></span>
        <span className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground"><span>{game.participants_count}/{game.max_players} {ar ? "لاعب" : "players"}</span><span>{slots ? (ar ? `${slots} أماكن متاحة` : `${slots} spots left`) : (ar ? "مكتمل" : "Full")}</span></span>
        <span className="block h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "hsl(var(--playza-lime) / 0.2)" }} aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: "var(--color-primary)" }} /></span>
        <span className="flex flex-wrap gap-1.5 text-[10px]"><span className="rounded bg-muted px-1.5 py-0.5 font-medium">{t(`community_status_${game.status}`)}</span>{joined && <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold">{waitlisted ? (ar ? "قائمة الانتظار" : "On the waitlist") : (ar ? "أنت مشارك" : "You're participating")}</span>}{!game.is_public && <span className="rounded bg-muted px-1.5 py-0.5">{ar ? "خاص" : "Private"}</span>}{booking?.confirmed && <span className="rounded bg-muted px-1.5 py-0.5">{ar ? "الحجز مؤكد" : "Booking confirmed"}</span>}</span>
        {(game.status === "full" || slots === 0) && <span className="block text-xs text-muted-foreground">{ar ? "قائمة الانتظار" : "Waiting list"}: {game.waitlist_count ?? 0}/2</span>}
        <span className="sr-only">{detailsHref ? (ar ? "عرض تفاصيل الماتش" : "View game details") : (ar ? "التفاصيل والمشاركة" : "Details & participation")}</span>
      </span>
      <span className={styles.desktopCta}>{expanded ? (ar ? "إخفاء التفاصيل" : "Hide details") : waitlisted ? (ar ? "قائمة الانتظار" : "On waiting list") : joined ? (ar ? "عرض الحجز" : "View Booking") : (ar ? "انضم للماتش" : "Join Game")} <ArrowUpRight size={17} aria-hidden="true" /></span>
  </>;
  if (layout === "list") return <article data-game-overview="" className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-shadow hover:shadow-sm">
    <div className={`${styles.surface} sm:grid sm:grid-cols-[minmax(0,1fr)_auto]`}>
    <div className={styles.art} aria-hidden="true"><GameCardBackground sport={game.sport} /></div>
    {detailsHref ? <Link href={detailsHref} data-game-summary="" className={overviewClass}>{overview}</Link> : <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)} data-game-summary="" className={overviewClass}>{overview}</button>}
    {(!hideActionsWhenExpanded || !expanded) && <div className={`${styles.content} ${styles.actions} flex flex-wrap items-start justify-end gap-2 px-3 pb-2 sm:items-end sm:py-3 sm:ps-0`}>{directions && <GoogleMapsDirectionsButton compact href={directions} />}{share}</div>}
    </div>
    {!detailsHref && <div id={detailsId} hidden={!expanded} className={`${styles.details} border-t border-border bg-card text-card-foreground pt-2`}>{children}</div>}
  </article>;
  return <article className={`group/card self-start overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/10 ${game.status === "completed" ? "border-emerald-500/50" : game.status === "open" ? "border-blue-400/60 ring-1 ring-blue-400/15" : "border-border"}`}>
    <div className={`relative isolate min-h-48 overflow-hidden bg-gradient-to-br ${theme} px-5 pb-5 pt-4 text-white`}>
      {/* User venue photos can be hosted outside the configured image domains. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={photo} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />}
      {photo && <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/15" />}
      <div aria-hidden="true" className="pointer-events-none absolute -end-7 -top-12 h-44 w-44 rounded-full border-[18px] border-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute end-4 top-12 rotate-12 text-white/20">{SportIcon({ id: sport, size: 80 })}</div>
      {!photo && <GameCardBackground sport={game.sport} />}
      {game.status === "completed" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-emerald-900/55" />}
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-white"><Trophy className="h-4 w-4" />{game.sport}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${statusStyle}`}>{game.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{game.status === "full" ? (lang === "ar" ? "محجوز بالكامل" : "FULLY BOOKED") : t(`community_status_${game.status}`)}</span>
      </div>
      <h3 className="relative mt-4 line-clamp-2 min-h-12 text-lg font-bold leading-6 text-white">{game.title}</h3>
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/90">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-white"/>{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-white"/>{formatTime12h(game.start_time, lang)}</span>
      </div>
    </div>
    <div className={`${styles.surface} space-y-4 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span className="line-clamp-2 font-medium">{game.playground?.name || game.location || game.area || t("games_no_playground")}</span></p>
        <div className="shrink-0 text-end"><p className={`text-base font-bold ${styles.price}`}>{game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price, lang)}</p><p className="text-[11px] text-muted-foreground">{ar ? "لكل لاعب" : "per player"}</p></div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-1.5 font-medium"><Users className="h-3.5 w-3.5"/>{game.participants_count}/{game.max_players} {ar ? "لاعب" : "players"}</span><span className="text-muted-foreground">{slots ? (ar ? `${slots} أماكن متاحة` : `${slots} spots left`) : (ar ? "مكتمل" : "Full")}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "hsl(var(--playza-lime) / 0.2)" }} aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: "var(--color-primary)" }}/></div>
        {players.length > 0 && <p className="mt-2 truncate text-xs text-muted-foreground">{players.slice(0,3).map(p=>p.player_name).join(" · ")}{players.length > 3 ? ` +${players.length - 3}` : ""}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {joined && <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{waitlisted ? (ar ? "قائمة الانتظار" : "On the waitlist") : (ar ? "أنت مشارك" : "You're participating")}</span>}
        {!game.is_public && <span className="rounded-md bg-muted px-2 py-1">{ar ? "خاص" : "Private"}</span>}
        {booking?.confirmed && game.status !== "completed" && <span className="rounded-md bg-muted px-2 py-1">{ar ? "الحجز مؤكد" : "Booking confirmed"}</span>}
      </div>
      <div className={`${styles.actions} flex flex-wrap items-start gap-2`}>
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(!expanded)} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {expanded ? (ar ? "إخفاء التفاصيل" : "Hide details") : (ar ? "التفاصيل والمشاركة" : "Details & participation")}
        <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}/>
      </button>
      {directions && <GoogleMapsDirectionsButton compact href={directions} />}
      {share}
      </div>
    </div>
    <div id={detailsId} hidden={!expanded} className={`${styles.details} border-t border-border bg-card text-card-foreground pt-2`}>{children}</div>
  </article>;
}
