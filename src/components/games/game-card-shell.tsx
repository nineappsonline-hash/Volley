"use client";

import styles from "./game-card-shell.module.css";
import { trackView } from "@/lib/analytics/events";
import { GameShareActions } from "./game-share-actions";
import Link from "next/link";
import Image from "next/image";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { useEffect, useId, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, ChevronDown, Clock, MapPin, Trophy, Users, CheckCircle2 } from "lucide-react";
import { sportToSlug } from "@/lib/sport-slugs";
import { SportIcon } from "@/components/marketing/sport-icons";
import { GameCardBackground } from "./game-card-background";
import { venueCardPhoto } from "@/lib/venue-media";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { gameBookingPayment } from "@/lib/game-costs";
import type { FriendlyGameWithDetails } from "@/lib/types";

/** Compact overview shared by the games directory and community feed. */
export function GameCardShell({ game, joined, waitlisted, paymentPending = false, children, detailsHref, initialExpanded = false, layout = "card", hideActionsWhenExpanded = false, deferPhotoLoading = false, hideBackgroundArt = false, onJoinClick, joinHref }: { onJoinClick?: () => void; joinHref?: string; detailsHref?: string; initialExpanded?: boolean; layout?: "card" | "list" | "cinematic"; deferPhotoLoading?: boolean; hideBackgroundArt?: boolean; game: FriendlyGameWithDetails; joined: boolean; waitlisted?: boolean; paymentPending?: boolean; children?: ReactNode; hideActionsWhenExpanded?: boolean }) {
  const { lang, locale, t } = useI18n();
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState(initialExpanded);
  const detailsId = useId();
  useEffect(() => {
    if (expanded && !detailsHref) trackView("game_view", game.id, {sport:game.sport,area:game.area,country:game.playground?.country,governorate:game.playground?.governorate});
  }, [expanded,detailsHref,game.id,game.sport,game.area,game.playground?.country,game.playground?.governorate]);
  const pendingCreation = (game as FriendlyGameWithDetails & {creation_payment_approved?:boolean}).creation_payment_approved === false;
  const awaitingPayment = paymentPending || pendingCreation;
  const players = (game.participants ?? []).filter(p => !p.is_waitlisted && p.pay_status === "approved");
  const slots = game.status === "full" ? 0 : Math.max(0, game.max_players - game.participants_count);
  const percent = Math.min(100, Math.max(0, game.participants_count / Math.max(1, game.max_players) * 100));
  const sport = sportToSlug(game.sport);
  const theme = sport === "football" ? "from-brand to-brand-900"
    : sport === "basketball" ? "from-brand to-brand-900"
    : sport === "tennis" || sport === "padel" ? "from-brand to-brand-900"
    : "from-brand to-brand-900";
  const booking = gameBookingPayment(game);
  const statusStyle = game.status === "completed" ? "border-emerald-200/40 bg-emerald-700" : game.status === "open" ? "border-blue-200/40 bg-blue-600" : game.status === "full" ? "border-red-400/60 bg-red-700 ring-2 ring-red-400/70" : "border-red-200/40 bg-red-700";
  const Indicator = detailsHref ? ArrowUpRight : ChevronDown;
  const overviewClass = `${styles.content} flex w-full items-start gap-3 p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-3`;
  const directions = googleDirectionsUrl(game.playground?.location_link);
  const venuePhoto = venueCardPhoto(game.playground?.photos, game.playground?.cover_url);
  const optimizeVenuePhoto = !!venuePhoto?.startsWith("https://jqysnlkykznwdonicwsm.supabase.co/storage/v1/object/public/");
  const optimizeLandingPhoto = deferPhotoLoading && optimizeVenuePhoto;
  const share = <GameShareActions compact game={{...game,joined:game.participants_count,place:[game.playground?.name,game.playground?.area??game.area,game.playground?.governorate].filter(Boolean).join(", ")||game.location||""}} />;
  const overview = <>
      <span data-game-photo="" className="relative isolate block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand" style={venuePhoto && !deferPhotoLoading && !optimizeVenuePhoto ? { backgroundImage: `linear-gradient(130deg, rgba(67,33,107,.3), rgba(67,33,107,.1)), url("${venuePhoto.replace(/"/g, "%22")}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
        {!deferPhotoLoading && optimizeVenuePhoto && venuePhoto && <><Image src={venuePhoto} alt="" fill sizes="80px" quality={70} loading="lazy" className="object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#43216b]/30 to-[#43216b]/10" /></>}
        {deferPhotoLoading && venuePhoto && <>{optimizeLandingPhoto ? <Image src={venuePhoto} alt="" fill sizes="80px" quality={70} loading="lazy" className="object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : <img src={venuePhoto} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />}<span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#43216b]/30 to-[#43216b]/10" /></>}
        <span className="absolute inset-0 flex items-center justify-center text-white/70" aria-hidden="true">{SportIcon({ id: sport, size: 48 })}</span>
        <span className={styles.mobileStatus}>{game.status === "open" ? (slots <= 2 ? (ar ? "قرب يكتمل" : "Almost Full") : (ar ? "متاح" : "Open")) : t(`community_status_${game.status}`)}</span>
        <span className="absolute inset-x-0 bottom-0 bg-brand/95 px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-highlight sm:text-[10px]">{game.sport}</span>
      </span>
      <span data-game-info="" className="block min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-extrabold leading-5 sm:text-base">{game.title}</span><Indicator size={16} className={`mt-0.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></span>
        <span className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-1">{game.playground?.name || game.location || game.area || t("games_no_playground")}</span></span>
        <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 text-xs"><span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><time className="block" dateTime={game.game_date}>{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })}</time><span className="block text-muted-foreground">{formatTime12h(game.start_time, lang)}</span></span><span className="text-end"><strong className={`block text-sm ${styles.price}`}>{game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price, lang)}</strong><span className="text-[10px] text-muted-foreground">{ar ? "لكل لاعب" : "per player"}</span></span></span>
        <span className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground"><span>{game.participants_count}/{game.max_players} {ar ? "لاعب" : "players"}</span><span>{slots ? (ar ? `${slots} أماكن متاحة` : `${slots} spots left`) : (ar ? "مكتمل" : "Full")}</span></span>
        <span className="block h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "hsl(var(--playza-lime) / 0.2)" }} aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: "var(--color-primary)" }} /></span>
        <span className="flex flex-wrap gap-1.5 text-[10px]"><span className="rounded bg-muted px-1.5 py-0.5 font-medium">{t(`community_status_${game.status}`)}</span>{joined && <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold">{waitlisted ? (ar ? "قائمة الانتظار" : "On the waitlist") : (awaitingPayment ? (ar ? "بانتظار اعتماد الدفع" : "Awaiting payment approval") : (ar ? "أنت مشارك" : "You're participating"))}</span>}{pendingCreation && <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">{ar ? "الماتش بانتظار اعتماد دفع المنظم" : "Game awaiting organizer payment approval"}</span>}{!game.is_public && <span className="rounded bg-muted px-1.5 py-0.5">{ar ? "خاص" : "Private"}</span>}{booking?.confirmed && <span className="rounded bg-muted px-1.5 py-0.5">{ar ? "الحجز مؤكد" : "Booking confirmed"}</span>}</span>
        <span className="sr-only">{detailsHref ? (ar ? "عرض تفاصيل الماتش" : "View game details") : (ar ? "التفاصيل والمشاركة" : "Details & participation")}</span>
      </span>
      <span className={styles.desktopCta}>{expanded ? (ar ? "إخفاء التفاصيل" : "Hide details") : waitlisted ? (ar ? "قائمة الانتظار" : "On waiting list") : paymentPending ? (ar ? "عرض الدفع" : "View payment") : joined ? (ar ? "عرض الحجز" : "View Booking") : (ar ? "انضم للماتش" : "Join Game")} <ArrowUpRight size={17} aria-hidden="true" /></span>
  </>;

  if (layout === "cinematic") {
    const imageSport = ["volleyball", "beach-volleyball", "basketball", "padel", "tennis"].includes(sport) ? sport : "volleyball";
    const statusLabel = !game.is_public ? (ar ? "خاص" : "Private")
      : pendingCreation ? (ar ? "بانتظار الموافقة" : "Needs approval")
      : game.status === "full" || slots === 0 ? (ar ? "مكتمل" : "Full")
      : game.status === "open" ? (ar ? "متاح" : "Open") : t(`community_status_${game.status}`);
    const startMinutes = (() => {
      const match = /^(\d{1,2}):(\d{2})/.exec(game.start_time);
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    })();
    const endTime = startMinutes === null ? null : (() => {
      const minutes = (startMinutes + Math.round(game.duration_hours * 60)) % (24 * 60);
      const raw = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      return formatTime12h(raw, lang);
    })();
    const primaryLabel = joined ? (ar ? "عرض حجزي" : "My booking")
      : slots === 0 ? (ar ? "تفاصيل الماتش" : "Game details")
      : ar ? "انضم للماتش" : "Join Game";
    const canJoin = slots > 0 && !joined && game.status === "open";
    const openDetails = (label: ReactNode) => canJoin && joinHref
      ? <Link href={joinHref} className={styles.cinematicJoin}>{label}<ArrowUpRight size={18} aria-hidden="true" /></Link>
      : canJoin && onJoinClick
        ? <button type="button" onClick={onJoinClick} className={styles.cinematicJoin}>{label}<ArrowUpRight size={18} aria-hidden="true" /></button>
        : detailsHref
          ? <Link href={detailsHref} className={styles.cinematicJoin}>{label}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          : <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId} className={styles.cinematicJoin}>{expanded ? (ar ? "إخفاء التفاصيل" : "Hide details") : label}<ArrowUpRight size={18} aria-hidden="true" /></button>;
    return <article data-game-overview="" data-sport={imageSport} dir="ltr" className={styles.cinematicCard}>
      <div className={styles.cinematicScene}>
        <div className={styles.cinematicPhoto} style={{backgroundImage:`url("/images/match-cards/${imageSport}.webp")`}} aria-hidden="true"/>
        <div className={styles.cinematicTint} aria-hidden="true"/>
        <div className={styles.cinematicBody}>
          <div className={styles.cinematicTop}>
            <span className={styles.cinematicSport}><span aria-hidden="true">{SportIcon({id:sport,size:22})}</span><span dir="auto">{ar ? ({Volleyball:"كرة طائرة","Beach Volleyball":"طائرة شاطئية",Basketball:"كرة سلة",Padel:"بادل",Tennis:"تنس"} as Record<string,string>)[game.sport] ?? game.sport : game.sport}</span></span>
            <div className={styles.cinematicBadges}>
              <span className={styles.cinematicStatus} dir="auto">{statusLabel}</span>
              <span className={styles.cinematicGender} dir="auto">{game.gender === "mixed" ? (ar ? "ميكس" : "Mixed") : game.gender === "male" ? (ar ? "رجالة بس" : "Men only") : (ar ? "سيدات بس" : "Women only")}</span>
              <span className={styles.cinematicLevel} dir="auto">{game.skill_level ? t(`skill_${game.skill_level}`) : (ar ? "كل المستويات" : "Any level")}</span>
              <span className={styles.cinematicAge} dir="auto">{game.min_age == null && game.max_age == null
                ? (ar ? "كل الأعمار" : "All ages")
                : game.min_age != null && game.max_age != null
                  ? `${game.min_age}–${game.max_age} ${ar ? "سنة" : "yrs"}`
                  : game.min_age != null
                    ? `${game.min_age}+ ${ar ? "سنة" : "yrs"}`
                    : `${ar ? "حتى" : "Up to"} ${game.max_age} ${ar ? "سنة" : "yrs"}`}</span>
            </div>
          </div>
          <div className={styles.cinematicHeading}>
            <h3 data-game-info="" dir="auto" className={styles.cinematicTitle}>{game.title}</h3>
          </div>
          <div className={styles.cinematicWhen}><span><CalendarDays size={16}/><time dateTime={game.game_date}>{format(new Date(`${game.game_date}T00:00:00`),"EEE, d MMM",{locale})}</time></span><span><Clock size={16}/><span dir="ltr">{formatTime12h(game.start_time,lang)}{endTime ? ` – ${endTime}` : ""}</span></span></div>
          <div className={styles.cinematicWhere}><MapPin size={17}/><span dir="auto">{game.playground?.name || game.location || game.area || t("games_no_playground")}</span></div>
          <div className={styles.cinematicBottom}>
            <div className={styles.cinematicMetrics}>
              <div className={styles.cinematicPrice}><strong>{game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price,lang)}</strong><small>{ar ? "للفرد" : "per player"}</small></div>
              <div className={styles.cinematicProgress}><div className={styles.cinematicProgressText}><span><Users size={17}/>{game.participants_count}/{game.max_players} {ar ? "لاعب" : "players"}</span><span>{slots ? (ar ? `${slots} أماكن متاحة` : `${slots} spots left`) : (ar ? "مكتمل" : "Full")}</span></div><div className={styles.cinematicTrack}><div style={{width:`${percent}%`}}/></div></div>
            </div>
            <div className={styles.cinematicActions}>{openDetails(primaryLabel)}
              <div className={styles.cinematicUtilities}>{!detailsHref && <button type="button" className={styles.cinematicDetailsLink} onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId}>{expanded ? (ar ? "إخفاء" : "Hide") : (ar ? "التفاصيل" : "Details")}</button>}{directions && <GoogleMapsDirectionsButton compact href={directions}/>} {share}</div>
            </div>
          </div>
        </div>
      </div>
      {!detailsHref && <div id={detailsId} hidden={!expanded} className={styles.cinematicExpanded}>{children}</div>}
    </article>;
  }

  if (layout === "list") return <article data-game-overview="" className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-shadow hover:shadow-sm">
    <div className={`${styles.surface} sm:grid sm:grid-cols-[minmax(0,1fr)_auto]`}>
    {!hideBackgroundArt && <div className={styles.art} aria-hidden="true">{venuePhoto ? <>{optimizeVenuePhoto ? <Image src={venuePhoto} alt="" fill sizes="(max-width: 640px) 100vw, 420px" quality={70} loading={deferPhotoLoading ? "lazy" : "eager"} className="object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : <img src={venuePhoto} alt="" loading={deferPhotoLoading ? "lazy" : "eager"} decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />}<div className="absolute inset-0 bg-gradient-to-r from-[#251044]/90 via-[#251044]/65 to-[#251044]/40" /></> : <GameCardBackground sport={game.sport} />}</div>}
    {detailsHref ? <Link href={detailsHref} data-game-summary="" className={overviewClass}>{overview}</Link> : <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)} data-game-summary="" className={overviewClass}>{overview}</button>}
    {(!hideActionsWhenExpanded || !expanded) && <div className={`${styles.content} ${styles.actions} flex flex-wrap items-start justify-end gap-2 px-3 pb-2 sm:items-end sm:py-3 sm:ps-0`}>{directions && <GoogleMapsDirectionsButton compact href={directions} />}{share}</div>}
    </div>
    {!detailsHref && <div id={detailsId} hidden={!expanded} className={`${styles.details} border-t border-border bg-card text-card-foreground pt-2`}>{children}</div>}
  </article>;
  return <article className={`group/card self-start overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/10 ${game.status === "completed" ? "border-emerald-500/50" : game.status === "open" ? "border-blue-400/60 ring-1 ring-blue-400/15" : "border-border"}`}>
    <div className={`relative isolate flex min-h-40 items-end gap-3 overflow-hidden bg-gradient-to-br ${theme} px-4 pb-4 pt-12 text-white`}>
      {venuePhoto ? (<>{optimizeVenuePhoto ? <Image src={venuePhoto} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" quality={70} loading="lazy" className="pointer-events-none absolute inset-0 z-0 object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : <img src={venuePhoto} alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />}<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#170c2e]/95 via-[#170c2e]/60 to-[#170c2e]/30" /></>) : <GameCardBackground sport={game.sport} />}
      {game.status === "completed" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] bg-emerald-900/55" />}
      <span className={`absolute end-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${statusStyle}`}>
        {game.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : game.status === "open" ? <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" /> : null}
        {game.status === "full" ? (ar ? "محجوز بالكامل" : "FULLY BOOKED") : t(`community_status_${game.status}`)}
      </span>
      <span aria-hidden="true" className="relative z-10 shrink-0 rounded-xl border border-white/20 bg-white/10 p-2">{SportIcon({ id: sport, size: 32 })}</span>
      <div className="relative z-10 min-w-0">
        <p className="text-sm font-bold">{game.sport}</p>
        <p className="mt-1 text-base font-semibold">{game.playground?.name || game.location || game.area || game.title}</p>
        <p className="mt-1 text-xs text-white/90">{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })} · {formatTime12h(game.start_time, lang)}</p>
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
        {joined && <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{waitlisted ? (ar ? "قائمة الانتظار" : "On the waitlist") : (awaitingPayment ? (ar ? "بانتظار اعتماد الدفع" : "Awaiting payment approval") : (ar ? "أنت مشارك" : "You're participating"))}</span>}
        {pendingCreation && <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">{ar ? "الماتش بانتظار اعتماد دفع المنظم" : "Game awaiting organizer payment approval"}</span>}{!game.is_public && <span className="rounded-md bg-muted px-2 py-1">{ar ? "خاص" : "Private"}</span>}
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
