"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import {
  useCurrentProfile,
  useFriendlyGames,
  useMyRatingEligibility,
  usePlaygroundRatings,
  usePlaygrounds,
  useRatePlayground,
} from "@/lib/queries";
import { RatingControl, type RatingSubmit } from "@/components/shared/rating-control";
import { ShareIconButton } from "@/components/academies/academy-share";
import { playgroundShareLink, playgroundShareText } from "@/lib/playground-share";
import { useI18n } from "@/lib/i18n";
import { normalizeCountry } from "@/lib/locations";
import { addDaysInput, errorMessage } from "@/lib/utils";
import { formatTime12h } from "@/lib/constants";
import { allowedIntervalsForDate, unavailableIntervalsForDate, padMinutes } from "@/lib/venue-slots";
import type { Venue } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { PlaygroundLocationFilters, type PlaygroundLocationSelection } from "@/components/shared/playground-location-filters";
import { PlaygroundOptionCard } from "@/components/shared/playground-option-card";
import { PlaygroundAvailabilityCalendar } from "@/components/shared/playground-availability-calendar";
import { CreateGameDialog } from "@/components/games/create-game-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MemberPlaygrounds({ memberPlan }: { memberPlan: "free" | "premium" }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const query = usePlaygrounds();
  const { data: ratings } = usePlaygroundRatings();
  const { data: ratingEligibility } = useMyRatingEligibility();
  const { data: profile } = useCurrentProfile();
  const rate = useRatePlayground();
  const [location, setLocation] = useState<PlaygroundLocationSelection>({ country: "all", governorate: "all", area: "all" });
  const [sport, setSport] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ venue: Venue; date: string } | null>(null);
  const venues = query.data ?? [];

  const statsByVenue = useMemo(() => {
    const map = new Map<string, { avg: number; count: number; mine?: number; mineComment?: string }>();
    for (const r of ratings ?? []) {
      const s = map.get(r.venue_id) ?? { avg: 0, count: 0 };
      const total = s.avg * s.count + r.rating;
      s.count += 1;
      s.avg = total / s.count;
      map.set(r.venue_id, s);
    }
    const uid = profile?.id;
    if (uid) {
      for (const r of ratings ?? []) {
        if (r.member_id === uid) {
          const s = map.get(r.venue_id);
          if (s) {
            s.mine = r.rating;
            s.mineComment = r.comment ?? undefined;
          }
        }
      }
    }
    return map;
  }, [ratings, profile?.id]);

  const canRateVenue = (venueId: string) =>
    !!profile && !!ratingEligibility?.playgrounds.has(venueId);

  const submitVenueRating = async (venueId: string, payload: RatingSubmit) => {
    try {
      await rate.mutateAsync({ venueId, rating: payload.rating, comment: payload.comment });
      toast.success(t("rate_submitted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
      throw err;
    }
  };

  const sports = [...new Set(venues.map(venue => venue.sport?.name).filter((name): name is string => !!name))].sort();
  const filtered = venues.filter(venue =>
    (location.country === "all" || normalizeCountry(venue.country ?? "") === location.country) &&
    (location.governorate === "all" || venue.governorate === location.governorate) &&
    (location.area === "all" || venue.area === location.area) &&
    (sport === "all" || venue.sport?.name === sport) &&
    (!search.trim() || [venue.name, venue.address, venue.area, venue.governorate].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  );

  return <div className="space-y-6">
    <PageHeader title={t("nav_playgrounds")} subtitle={ar ? "اكتشف الملاعب المعتمدة، شوف المواعيد وابدأ ماتشك." : "Explore approved playgrounds, check availability and create your game."} />
    <QueryState queries={[query]}>
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <PlaygroundLocationFilters venues={venues} value={location} onChange={setLocation} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="playground-search">{ar ? "بحث" : "Search"}</Label><Input id="playground-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={ar ? "اسم الملعب أو العنوان" : "Playground name or address"} /></div>
          <div className="space-y-2"><Label htmlFor="playground-sport">{ar ? "الرياضة" : "Sport"}</Label><select id="playground-sport" className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={sport} onChange={event => setSport(event.target.value)}><option value="all">{ar ? "كل الرياضات" : "All sports"}</option>{sports.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        </div>
        <Button variant="ghost" onClick={() => { setLocation({ country: "all", governorate: "all", area: "all" }); setSport("all"); setSearch(""); }}>{ar ? "مسح الفلاتر" : "Clear filters"}</Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{filtered.length} {ar ? "ملعب" : "playgrounds"}</p>
      {!filtered.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{ar ? "مفيش ملاعب مطابقة. جرّب تغيير الفلاتر." : "No matching playgrounds. Try changing your filters."}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">{filtered.map(venue => <article key={venue.id} className="overflow-hidden rounded-2xl border bg-card">
        <PlaygroundOptionCard playground={venue} selected={expanded === venue.id} onSelect={() => setExpanded(expanded === venue.id ? null : venue.id)} />
        <div className="space-y-3 p-4 pt-0">
          <VenueRating
            stat={statsByVenue.get(venue.id)}
            showControl={!!profile}
            canRate={canRateVenue(venue.id)}
            onSubmit={payload => submitVenueRating(venue.id, payload)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{venue.sport?.name ?? (ar ? "الرياضة غير محددة" : "Sport not specified")}</p>
            <ShareIconButton
              target={{
                url: playgroundShareLink(venue.id),
                title: venue.name,
                text: playgroundShareText(venue),
              }}
              label={ar ? "مشاركة الملعب" : "Share playground"}
            />
          </div>
          <Button variant="outline" className="gap-2" aria-expanded={expanded === venue.id} onClick={() => setExpanded(expanded === venue.id ? null : venue.id)}><CalendarDays className="h-4 w-4" />{ar ? "المواعيد المتاحة وإنشاء ماتش" : "Availability & create game"}</Button>
          {expanded === venue.id && <VenueAvailability venue={venue} onCreate={date => setCreating({ venue, date })} />}
        </div>
      </article>)}</div>
    </QueryState>
    {creating && <CreateGameDialog open onOpenChange={open => { if (!open) setCreating(null); }} memberPlan={memberPlan} initialPlayground={creating.venue} initialDate={creating.date} />}
  </div>;
}

function VenueRating({ stat, showControl, canRate, onSubmit }: {
  stat?: { avg: number; count: number; mine?: number; mineComment?: string };
  showControl: boolean;
  canRate: boolean;
  onSubmit: (payload: RatingSubmit) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5" dir="ltr">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-4 w-4 ${i <= Math.round(stat?.avg ?? 0) ? "fill-attention-400 text-attention-400" : "text-muted-foreground/40"}`} />
            ))}
          </span>
          {stat && stat.count > 0 ? (
            <span className="text-xs text-muted-foreground">
              {(stat.avg ?? 0).toFixed(1)} · {t("directory_reviews").replace("{n}", String(stat.count))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("directory_no_rating")}</span>
          )}
        </div>
      </div>
      {showControl && (
        canRate ? (
          <RatingControl
            initialRating={stat?.mine ?? 0}
            initialComment={stat?.mineComment ?? ""}
            onSubmit={onSubmit}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("directory_rating_play_hint")}</p>
        )
      )}
    </div>
  );
}

function VenueAvailability({ venue, onCreate }: { venue: Venue; onCreate: (date: string) => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const query = useFriendlyGames();
  const [date, setDate] = useState(addDaysInput(1));
  const games = (query.data ?? []).filter(game => game.playground_id === venue.id);
  const busyForDate = (day: string) => unavailableIntervalsForDate(venue.unavailable_slots, games, day, venue.court_count ?? 1);
  let free = allowedIntervalsForDate(venue.working_hours, date);
  for (const [start, end] of busyForDate(date)) {
    free = free.flatMap(([from, to]): Array<[number, number]> => end <= from || start >= to ? [[from, to]] : [ ...(start > from ? [[from, start] as [number, number]] : []), ...(end < to ? [[end, to] as [number, number]] : []) ]);
  }
  const time = (minutes: number) => minutes === 1440 ? (ar ? "منتصف الليل" : "Midnight") : formatTime12h(padMinutes(minutes), lang);
  return <QueryState queries={[query]}>
    <PlaygroundAvailabilityCalendar unavailableSlots={venue.unavailable_slots} workingHours={venue.working_hours} busyForDate={busyForDate} selectedDate={date} onSelectDate={setDate} minDate={addDaysInput(1)} />
    <div className="space-y-2">
      <p className="text-sm font-semibold">{date} · {ar ? "الأوقات المتاحة" : "Available times"}</p>
      <div className="flex flex-wrap gap-2">{free.map(([start, end]) => <span dir="auto" key={`${start}-${end}`} className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{time(start)} – {time(end)}</span>)}</div>
      {!free.length && <p className="text-sm text-muted-foreground">{ar ? "مفيش أوقات متاحة في هذا اليوم." : "No available times on this day."}</p>}
      <p className="text-xs text-muted-foreground">{ar ? "المواعيد حسب ساعات العمل والحجوزات الظاهرة. يتم التحقق النهائي عند إنشاء الماتش." : "Based on opening hours and visible bookings. Availability is checked again when creating the game."}</p>
      {!venue.working_hours?.length && <p className="text-xs text-muted-foreground">{ar ? "الملعب لم يحدد ساعات العمل؛ المواعيد المعروضة تستخدم ساعات التطبيق الافتراضية." : "This venue has not published opening hours; the app’s default hours are shown."}</p>}
      <Button disabled={!free.length} onClick={() => onCreate(date)} className="gap-2"><Plus className="h-4 w-4" />{ar ? "إنشاء ماتش هنا" : "Create game here"}</Button>
    </div>
  </QueryState>;
}
