"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MapPin, Volleyball } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { COMMUNITY_SPORTS, formatTime12h } from "@/lib/constants";
import { normalizeCountry } from "@/lib/locations";
import { matchesGameLocation } from "@/lib/game-filters";
import { LocationFields } from "@/components/shared/location-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { QueryState } from "@/components/shared/query-state";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { PlaygroundDistance } from "@/components/shared/playground-distance";
import { parseMapsCoordinates } from "@/lib/maps";
import { venueCardPhoto } from "@/lib/venue-media";
import { useFriendlyGames } from "@/lib/queries";
import type { FriendlyGameWithDetails } from "@/lib/types";

type GamesQuery = ReturnType<typeof useFriendlyGames>;

function playgroundLabel(
  playground: NonNullable<FriendlyGameWithDetails["playground"]>
) {
  return [playground.governorate, playground.area]
    .filter(Boolean)
    .join(" · ");
}

function GameRow({
  game,
  isMine,
}: {
  game: FriendlyGameWithDetails;
  isMine: boolean;
}) {
  const { locale, lang } = useI18n();
  const ar = lang === "ar";
  const playgroundThumb = venueCardPhoto(
    game.playground?.photos,
    game.playground?.cover_url
  );
  const playgroundTarget = (() => {
    if (!game.playground) return null;
    const fromLink = parseMapsCoordinates(game.playground.location_link ?? "");
    if (fromLink) return fromLink;
    if (game.playground.lat != null && game.playground.lng != null) {
      return { lat: game.playground.lat, lng: game.playground.lng };
    }
    return null;
  })();

  const slotsLeft = Math.max(game.max_players - game.participants_count, 0);
  const full = game.status === "full" || game.participants_count >= game.max_players;

  return (
    <div
      className={`group flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-3 transition-colors ${
        isMine
          ? "border-primary/40 bg-primary/[0.03]"
          : "border-border/60 hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold">{game.title}</h4>
          {isMine && (
            <Badge className="mt-1 border-primary/40 bg-primary/10 text-primary">
              {ar ? "مشاركتك" : "Your game"}
            </Badge>
          )}
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 gap-1 text-[11px]"
        >
          <span className="sr-only">{game.sport}</span>
          {game.sport}
        </Badge>
      </div>

      {game.playground && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
          {playgroundThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={playgroundThumb}
              alt={game.playground?.name ?? ""}
              className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">
              {game.playground.name ?? game.location ?? game.title}
            </p>
            {playgroundLabel(game.playground) !== game.playground.name && (
              <p className="truncate text-xs text-muted-foreground">
                {playgroundLabel(game.playground)}
              </p>
            )}
            {playgroundTarget && (
              <span className="mt-0.5 flex items-center gap-1.5">
                <PlaygroundDistance
                  lat={playgroundTarget.lat}
                  lng={playgroundTarget.lng}
                />
              </span>
            )}
          </div>
          {game.playground.location_link && (
            <DirectionsLinks
              lat={playgroundTarget?.lat}
              lng={playgroundTarget?.lng}
              query={game.playground.name ?? game.location ?? game.title}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="sr-only">Date</span>
          {format(
            new Date(game.game_date + "T00:00:00"),
            ar ? "EEE d MMM" : "MMM d, EEE",
            { locale }
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="sr-only">Time</span>
          {formatTime12h(game.start_time, lang)}
        </span>
        {game.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{game.location}</span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="sr-only">Players</span>
          {game.participants_count}/{game.max_players}
        </span>
        <span className="text-muted-foreground">
          {full
            ? (ar ? "مكتمل" : "Full")
            : `${slotsLeft} ${ar ? "أماكن شاغرة" : "spots free"}`}
        </span>
      </div>
    </div>
  );
}

/** Horizontal strip of game cards, shared by "yours" and "around you". */
function GameStrip({
  label,
  games,
  myIds,
}: {
  label: string;
  games: FriendlyGameWithDetails[];
  myIds: ReadonlySet<string>;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="px-1 text-sm font-semibold">
        {label}
        {games.length === 1 ? "" : ` (${games.length})`}
      </legend>
      <ul
        role="list"
        aria-label={label}
        className="flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1"
      >
        {games.map((game) => (
          <li
            key={game.id}
            className="flex min-w-0 shrink-0 basis-[82%] sm:basis-4/9 lg:basis-3/10"
          >
            <GameRow game={game} isMine={myIds.has(game.id)} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * Dashboard "graphic card" for games: header with a View-all link plus a
 * horizontally scrollable strip of game rows (mine first, then nearby).
 */
export function ActiveUpcomingGamesCard({
  myGames,
  allGames,
  today: _today,
}: {
  myGames: GamesQuery;
  allGames: GamesQuery;
  today: string;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [countryFilter, setCountryFilter] = useState("");
  const [governorateFilter, setGovernorateFilter] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState("");

  const myIds = useMemo(
    () => new Set((myGames.data ?? []).map((g) => g.id)),
    [myGames.data]
  );

  const subset = useMemo(() => {
    const list = (allGames.data ?? []).filter((g) => {
      const country = normalizeCountry(g.playground?.country ?? "");
      if (countryFilter && country !== normalizeCountry(countryFilter)) return false;
      if (sportFilter !== "all" && g.sport !== sportFilter) return false;
      if (governorateFilter && !matchesGameLocation({ area: g.playground?.governorate }, governorateFilter)) return false;
      if (!matchesGameLocation(g, areaFilter)) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      const aMine = myIds.has(a.id);
      const bMine = myIds.has(b.id);
      if (aMine && !bMine) return -1;
      if (!aMine && bMine) return 1;
      return a.game_date.localeCompare(b.game_date);
    });
    return sorted;
  }, [allGames.data, myIds, countryFilter, governorateFilter, sportFilter, areaFilter]);

  const mineRows = useMemo(
    () => subset.filter((g) => myIds.has(g.id)),
    [subset, myIds]
  );
  const otherRows = useMemo(
    () => subset.filter((g) => !myIds.has(g.id)),
    [subset, myIds]
  );

  return (
    <section aria-label={ar ? "مبارياتك ومباريات حولك" : "Your games & games around you"} className="min-w-0">
      <Card className="rounded-2xl border border-border/60 shadow-none">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Volleyball className="h-5 w-5 text-primary" aria-hidden="true" />
            {ar ? "مبارياتك ومباريات حولك" : "Your games & games around you"}
          </div>
          <Link
            href="/dashboard/games"
            className="rounded text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ar ? "عرض الكل" : "View all"}
          </Link>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1">
              <LocationFields
                country={countryFilter}
                governorate={governorateFilter}
                city={areaFilter}
                onCountryChange={setCountryFilter}
                onGovernorateChange={setGovernorateFilter}
                onCityChange={setAreaFilter}
                filterMode
              />
            </div>
            <Select
              value={sportFilter}
              onValueChange={(v) => setSportFilter(v)}
            >
              <SelectTrigger aria-label={t("community_sport")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("community_filter_all_sports")}</SelectItem>
                {COMMUNITY_SPORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <QueryState queries={[myGames, allGames]}>
            {subset.length === 0 ? (
              <div className="border-y border-border/40 p-6">
                <p className="text-sm text-muted-foreground">
                  {ar
                    ? "مفيش مباريات مطابقة للتصفية. جرّب تعديل الفلاتر."
                    : "No games found with your filters. Try adjusting your search."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {mineRows.length > 0 && (
                  <GameStrip
                    label={ar ? "مشاركتك" : "Your games"}
                    games={mineRows}
                    myIds={myIds}
                  />
                )}

                {otherRows.length > 0 && (
                  <GameStrip
                    label={ar ? "مباريات حولك" : "Games around you"}
                    games={otherRows}
                    myIds={myIds}
                  />
                )}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </section>
  );
}
