"use client";

import { useId, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, Clock, MapPin, Trophy, Users, CheckCircle2 } from "lucide-react";
import { sportToSlug } from "@/lib/sport-slugs";
import { SportIcon } from "@/components/marketing/sport-icons";
import { venueCardPhoto } from "@/lib/venue-media";
import { GameCardBackground } from "./game-card-background";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { gameBookingPayment } from "@/lib/game-costs";
import type { FriendlyGameWithDetails } from "@/lib/types";

/** Compact overview shared by the games directory and community feed. */
export function GameCardShell({ game, joined, waitlisted, children }: { game: FriendlyGameWithDetails; joined: boolean; waitlisted?: boolean; children: ReactNode }) {
  const { lang, locale, t } = useI18n();
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
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
  const statusStyle = game.status === "completed" ? "border-emerald-200/40 bg-emerald-700" : game.status === "open" ? "border-blue-200/40 bg-blue-600" : game.status === "full" ? "border-amber-200/40 bg-amber-700" : "border-red-200/40 bg-red-700";
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
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${statusStyle}`}>{game.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{t(`community_status_${game.status}`)}</span>
      </div>
      <h3 className="relative mt-4 line-clamp-2 min-h-12 text-lg font-bold leading-6 text-white">{game.title}</h3>
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/90">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-white"/>{format(new Date(`${game.game_date}T00:00:00`), "EEE, d MMM", { locale })}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-white"/>{formatTime12h(game.start_time, lang)}</span>
      </div>
    </div>
    <div className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span className="line-clamp-2 font-medium">{game.playground?.name || game.location || game.area || t("games_no_playground")}</span></p>
        <div className="shrink-0 text-end"><p className="text-base font-bold">{game.host_pays ? (ar ? "مجاني" : "Free") : game.share_price == null ? "—" : formatMoney(game.share_price, lang)}</p><p className="text-[11px] text-muted-foreground">{ar ? "لكل لاعب" : "per player"}</p></div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-1.5 font-medium"><Users className="h-3.5 w-3.5"/>{game.participants_count}/{game.max_players} {ar ? "لاعب" : "players"}</span><span className="text-muted-foreground">{slots ? (ar ? `${slots} أماكن متاحة` : `${slots} spots left`) : (ar ? "مكتمل" : "Full")}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(199, 242, 61, 0.2)" }} aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: "#C7F23D" }}/></div>
        {players.length > 0 && <p className="mt-2 truncate text-xs text-muted-foreground">{players.slice(0,3).map(p=>p.player_name).join(" · ")}{players.length > 3 ? ` +${players.length - 3}` : ""}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {joined && <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{waitlisted ? (ar ? "قائمة الانتظار" : "On the waitlist") : (ar ? "أنت مشارك" : "You're participating")}</span>}
        {!game.is_public && <span className="rounded-md bg-muted px-2 py-1">{ar ? "خاص" : "Private"}</span>}
        {booking?.confirmed && game.status !== "completed" && <span className="rounded-md bg-muted px-2 py-1">{ar ? "الحجز مؤكد" : "Booking confirmed"}</span>}
      </div>
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(!expanded)} className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {expanded ? (ar ? "إخفاء التفاصيل" : "Hide details") : (ar ? "التفاصيل والمشاركة" : "Details & participation")}
        <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}/>
      </button>
    </div>
    <div id={detailsId} hidden={!expanded} className="border-t border-border bg-muted/10 pt-2">{children}</div>
  </article>;
}
