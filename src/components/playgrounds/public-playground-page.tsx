"use client";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { LocationMap } from "@/components/shared/location-map";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  LandPlot,
  MapPin,
  MessageSquareText,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCurrentProfile } from "@/lib/queries";
import { ShareMenu } from "@/components/academies/academy-share";
import { CreateGameDialog } from "@/components/games/create-game-dialog";
import { PlaygroundAvailabilityCalendar } from "@/components/shared/playground-availability-calendar";
import { venueCardPhoto } from "@/lib/venue-media";
import { playgroundShareLink, playgroundShareText } from "@/lib/playground-share";
import { parseMapsCoordinates } from "@/lib/maps";
import { formatTime12h } from "@/lib/constants";
import { addDaysInput } from "@/lib/utils";
import {
  allowedIntervalsForDate,
  unavailableIntervalsForDate,
  padMinutes,
  type GameBooking,
} from "@/lib/venue-slots";
import type {
  PublicPlayground,
  PublicPlaygroundGame,
  PublicPlaygroundReview,
} from "@/lib/public-playgrounds";

export function PublicPlaygroundPage({
  venue,
  games,
  rating,
  reviews,
}: {
  venue: PublicPlayground;
  games: PublicPlaygroundGame[];
  rating: { avg: number; count: number };
  reviews: PublicPlaygroundReview[];
}) {
  const { t, lang } = useI18n();
  const { data: profile } = useCurrentProfile();
  const signedIn = !!profile;

  const [date, setDate] = useState(() => addDaysInput(1));
  const [bookOpen, setBookOpen] = useState(false);

  const gameBookings: GameBooking[] = useMemo(
    () =>
      games.map((g) => ({
        game_date: g.game_date,
        start_time: g.start_time,
        duration_hours: Number(g.duration_hours) || 1,
        court_number: g.court_number,
      })),
    [games],
  );

  const busyForDate = useCallback((day: string) =>
    unavailableIntervalsForDate(
      venue.unavailable_slots ?? undefined,
      gameBookings,
      day,
      venue.court_count ?? 1,
      venue.court_availability,
    ), [venue.unavailable_slots, gameBookings, venue.court_count, venue.court_availability]);

  const free = useMemo(() => {
    let result = allowedIntervalsForDate(venue.working_hours ?? undefined, date);
    for (const [start, end] of busyForDate(date)) {
      result = result.flatMap(([from, to]): Array<[number, number]> =>
        end <= from || start >= to
          ? [[from, to]]
          : [
              ...(start > from ? ([[from, start]] as Array<[number, number]>) : []),
              ...(end < to ? ([[end, to]] as Array<[number, number]>) : []),
            ],
      );
    }
    return result;
  }, [busyForDate, date, venue.working_hours]);

  const time = (minutes: number) =>
    minutes === 1440 ? (lang === "ar" ? "منتصف الليل" : "Midnight") : formatTime12h(padMinutes(minutes), lang);

  const place = [venue.area, venue.governorate, venue.country].filter(Boolean).join(", ");
  const thumbnail = venueCardPhoto(venue.photos, venue.cover_url);
  const photos = [...new Set([venue.cover_url, ...(venue.photos ?? [])].filter((url): url is string => !!url))];
  const reviewComments = reviews.filter((r) => r.comment?.trim());

  const coordinates =
    venue.lat != null && venue.lng != null
      ? { lat: venue.lat, lng: venue.lng }
      : parseMapsCoordinates(venue.location_link ?? "");
  const directions = googleDirectionsUrl(venue.location_link);

  return (
    <>
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
        <Link href="/book-courts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {lang === "ar" ? "كل الملاعب" : "All playgrounds"}
        </Link>
        <ShareMenu
          target={{ url: playgroundShareLink(venue.id), title: venue.name, text: playgroundShareText(venue) }}
          label={lang === "ar" ? "مشاركة الملعب" : "Share playground"}
          align="end"
        />
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-brand via-brand to-interactive-800 py-8 text-white sm:py-12">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={venue.name}
              className="h-40 w-full max-w-xl rounded-2xl border border-white/20 object-cover shadow-lg sm:h-56"
            />
          )}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <LandPlot className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{venue.name}</h1>
          {place && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-white/85">
              <MapPin className="h-4 w-4" />
              {place}
            </p>
          )}
          {venue.sport?.name && (
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold">
              {venue.sport.name}
            </span>
          )}
          <div className="flex items-center gap-2 text-sm text-white/90">
            <span className="flex items-center gap-0.5" dir="ltr">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i <= Math.round(rating.avg) ? "fill-attention-300 text-attention-300" : "text-white/40"
                  }`}
                />
              ))}
            </span>
            <span>
              {rating.count > 0
                ? `${rating.avg.toFixed(1)} · ${t("directory_reviews").replace("{n}", String(rating.count))}`
                : t("directory_no_rating")}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#book"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-brand shadow-lg transition-transform hover:scale-105"
            >
              <CalendarDays className="h-4 w-4" />
              {t("public_playground_book")}
            </a>
            {directions && <GoogleMapsDirectionsButton href={directions} />}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Availability + booking */}
        <section id="book" className="scroll-mt-24 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t("public_playground_book")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("public_playground_book_hint")}</p>
          </div>

          <PlaygroundAvailabilityCalendar
            unavailableSlots={venue.unavailable_slots ?? undefined}
            workingHours={venue.working_hours ?? undefined}
            busyForDate={busyForDate}
            selectedDate={date}
            onSelectDate={setDate}
            minDate={addDaysInput(1)}
          />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {free.map(([start, end]) => (
                <span dir="auto" key={`${start}-${end}`} className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                  {time(start)} – {time(end)}
                </span>
              ))}
            </div>
            {!free.length && <p className="text-sm text-muted-foreground">{t("public_playground_no_times")}</p>}
            <p className="text-xs text-muted-foreground">{t("public_playground_booking_note")}</p>
            {!venue.working_hours?.length && (
              <p className="text-xs text-muted-foreground">{t("public_playground_open_hours_unknown")}</p>
            )}
          </div>
            {!free.length && <p className="text-sm text-muted-foreground">{t("public_playground_no_times")}</p>}

          {profile ? (
            <Button disabled={!free.length} onClick={() => setBookOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("public_playground_book")}
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              <p className="text-sm text-muted-foreground">{t("public_playground_auth_hint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/login?redirectedFrom=/p/${encodeURIComponent(venue.id)}`}>
                    {t("public_playground_login")}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/signup?redirectedFrom=/p/${encodeURIComponent(venue.id)}`}>
                    {t("public_playground_signup")}
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Details */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-3 text-lg font-bold">{t("public_playground_details")}</h2>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {venue.sport?.name && (
              <div className="flex items-center gap-2">
                <LandPlot className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {t("public_playground_sport")}: <span className="font-medium">{venue.sport.name}</span>
                </span>
              </div>
            )}
            {venue.capacity != null && (
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {t("public_playground_capacity")}: <span className="font-medium">{venue.capacity}</span>
                </span>
              </p>
            )}
            {!!venue.court_count && venue.court_count > 1 && (
              <p className="flex items-center gap-2">
                <LandPlot className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {t("public_playground_courts")}: <span className="font-medium">{venue.court_count}</span>
                </span>
              </p>
            )}
            {(venue.address || place) && (
              <p className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                {[venue.address, place].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </section>

        <LocationMap name={venue.name} address={[venue.address, place].filter(Boolean).join(", ")} lat={coordinates?.lat} lng={coordinates?.lng} locationLink={venue.location_link} />

        {/* Photos */}
        {photos.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Camera className="h-5 w-5 text-primary" />
              {lang === "ar" ? "الصور" : "Photos"}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={venue.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming games here */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-primary" />
            {t("public_playground_games_here")}
          </h2>
          {games.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {games.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p dir="auto" className="truncate font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.game_date} · {formatTime12h(g.start_time, lang)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={g.invite_code ? `/games?join=${encodeURIComponent(g.invite_code)}` : "/games"}>
                      {t("public_playground_see_game")}
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("public_playground_no_future_games")}</p>
          )}
        </section>

        {/* Reviews */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <MessageSquareText className="h-5 w-5 text-primary" />
            {lang === "ar" ? "التقييمات" : "Reviews"}
          </h2>
          {reviewComments.length ? (
            <div className="space-y-3">
              {reviewComments.map((r) => (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.member_name ?? "—"}</p>
                    <span className="flex items-center gap-0.5" dir="ltr">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i <= r.rating ? "fill-attention-400 text-attention-400" : "text-muted-foreground/40"}`}
                        />
                      ))}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("public_playground_reviews_empty")}</p>
          )}
        </section>
      </div>

      {profile && (
        <CreateGameDialog
          open={bookOpen}
          onOpenChange={setBookOpen}
          memberPlan={profile.member_plan}
          // The dialog only reads a Venue subset (id, sport, court count,
          // hours…) and re-resolves the full row from the live playground list.
          initialPlayground={{ ...venue, academy_id: null, owner_profile_id: null, unavailable_slots: venue.unavailable_slots ?? undefined, working_hours: venue.working_hours ?? undefined, blocked_dates: venue.blocked_dates ?? undefined, court_count: venue.court_count ?? 1 }}
          initialDate={date}
        />
      )}
    </>
  );
}