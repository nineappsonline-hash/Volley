"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Building2, CalendarDays, Clock, MapPin, Navigation, Users } from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  useFriendlyGames,
  useJoinFriendlyGame,
  useMyGameParticipants,
  usePublicAcademies,
} from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import type {
  Academy,
  FriendlyGameParticipant,
  FriendlyGameWithDetails,
  Profile,
} from "@/lib/types";

function pinFor(kind: "game" | "academy") {
  const color = kind === "game" ? "hsl(var(--info))" : "hsl(var(--playza-navy))";
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" fill="${color}" stroke="hsl(var(--on-brand))" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="hsl(var(--on-brand))"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

const GAME_ICON = pinFor("game");
const ACADEMY_ICON = pinFor("academy");

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useMemo(() => {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
  }, [map, bounds]);
  return null;
}

export default function DiscoverMap({ profile }: { profile: Profile }) {
  const { t, locale } = useI18n();
  const { data: games, isLoading: loadingGames } = useFriendlyGames();
  const { data: academies, isLoading: loadingAcademies } = usePublicAcademies();
  const { data: myParticipants } = useMyGameParticipants();
  const join = useJoinFriendlyGame();

  const [showGames, setShowGames] = useState(true);
  const [showAcademies, setShowAcademies] = useState(true);
  const [active, setActive] = useState<
    | { kind: "game"; item: FriendlyGameWithDetails }
    | { kind: "academy"; item: Pick<Academy, "id" | "name" | "slug" | "lat" | "lng" | "area"> }
    | null
  >(null);

  const points = useMemo(() => {
    const gs: { kind: "game"; lat: number; lng: number }[] =
      showGames
        ? (games ?? [])
            .filter((g) => g.lat != null && g.lng != null)
            .map((g) => ({ kind: "game" as const, lat: g.lat!, lng: g.lng! }))
        : [];
    const as: { kind: "academy"; lat: number; lng: number }[] =
      showAcademies
        ? (academies ?? [])
            .filter((a) => a.lat != null && a.lng != null)
            .map((a) => ({ kind: "academy" as const, lat: a.lat!, lng: a.lng! }))
        : [];
    return [...gs, ...as];
  }, [games, academies, showGames, showAcademies]);

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (points.length === 0) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [points]);

  const joinedGameIds = useMemo(
    () => new Set((myParticipants ?? []).map((p) => p.game_id)),
    [myParticipants]
  );
  const isOrganizer = (game: FriendlyGameWithDetails, p: FriendlyGameParticipant[]) =>
    game.creator_id === profile.id || p.some((x) => x.game_id === game.id);

  const handleJoin = async (gameId: string) => {
    try {
      await join.mutateAsync({ gameId });
      toast.success(t("community_joined"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  if (loadingGames || loadingAcademies || points.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex h-64 w-full items-center justify-center">
          {loadingGames || loadingAcademies ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <p className="text-sm text-muted-foreground">{t("map_empty")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* Legend / toggles */}
      <div className="space-y-3 lg:max-h-[560px] lg:overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={showGames ? "default" : "outline"}
            onClick={() => setShowGames((v) => !v)}
          >
            {t("map_layer_games")}
            <span className="ms-1.5 rounded-full bg-background/20 px-1.5 text-[10px]">
              {(games ?? []).filter((g) => g.lat != null).length}
            </span>
          </Button>
          <Button
            size="sm"
            variant={showAcademies ? "default" : "outline"}
            onClick={() => setShowAcademies((v) => !v)}
          >
            {t("map_layer_academies")}
            <span className="ms-1.5 rounded-full bg-background/20 px-1.5 text-[10px]">
              {(academies ?? []).filter((a) => a.lat != null).length}
            </span>
          </Button>
        </div>

        {/* Games list */}
        {showGames &&
          (games ?? [])
            .filter((g) => g.lat != null && g.lng != null)
            .map((g) => {
              const mine = isOrganizer(g, myParticipants ?? []);
              const joined = joinedGameIds.has(g.id);
              const full =
                g.status === "full" || g.participants_count >= g.max_players;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActive({ kind: "game", item: g })}
                  className={`w-full rounded-lg border p-3 text-start transition-colors ${
                    active?.kind === "game" && active.item.id === g.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{g.title}</p>
                    <Badge
                      variant={g.status === "full" ? "secondary" : "outline"}
                      className={`shrink-0 text-[10px] ${
                        g.status === "full"
                          ? "bg-attention-100 text-warning-ink dark:bg-attention-500/15 dark:text-attention-400"
                          : "bg-positive-100 text-success-ink dark:bg-positive-500/15 dark:text-positive-400"
                      }`}
                    >
                      {t(`community_status_${g.status}`)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(g.game_date + "T00:00:00"), "EEE d MMM", {
                        locale,
                      })}{" "}
                      · {g.start_time.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {g.sport}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {g.participants_count}/{g.max_players}
                    </span>
                  </div>
                  {g.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {g.location}
                    </p>
                  )}
                  {!mine && !joined && !full && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoin(g.id);
                      }}
                      disabled={join.isPending}
                    >
                      {t("community_join")}
                    </Button>
                  )}
                  {mine && (
                    <p className="mt-2 text-xs font-medium text-primary">
                      {t("community_organizer")}
                    </p>
                  )}
                </button>
              );
            })}

        {/* Academies list */}
        {showAcademies &&
          (academies ?? [])
            .filter((a) => a.lat != null && a.lng != null)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActive({ kind: "academy", item: a })}
                className={`w-full rounded-lg border p-3 text-start transition-colors ${
                  active?.kind === "academy" && active.item.id === a.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {a.name}
                </p>
                {a.area && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <MapPin className="me-1 inline h-3 w-3" />
                    {a.area}
                  </p>
                )}
              </button>
            ))}
      </div>

      {/* Map */}
      <div className="h-[420px] overflow-hidden rounded-lg border lg:h-[560px]">
        <MapContainer
          center={[30.0444, 31.2357]}
          zoom={6}
          scrollWheelZoom
          className="z-0 h-full w-full"
          style={{ height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {bounds && <FitBounds bounds={bounds} />}

          {showGames &&
            (games ?? [])
              .filter((g) => g.lat != null && g.lng != null)
              .map((g) => (
                <Marker
                  key={`g-${g.id}`}
                  position={[g.lat!, g.lng!]}
                  icon={GAME_ICON}
                  eventHandlers={{ click: () => setActive({ kind: "game", item: g }) }}
                >
                  <Popup>
                    <div className="w-52 space-y-1">
                      <p className="text-sm font-semibold">{g.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.sport} · {format(
                          new Date(g.game_date + "T00:00:00"),
                          "EEE d MMM",
                          { locale }
                        )}{" "}
                        · {g.start_time.slice(0, 5)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {g.participants_count}/{g.max_players}
                      </p>
                      <a
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                        href={`https://www.google.com/maps?q=${g.lat},${g.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Navigation className="h-3 w-3" />
                        {t("map_directions")}
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {showAcademies &&
            (academies ?? [])
              .filter((a) => a.lat != null && a.lng != null)
              .map((a) => (
                <Marker
                  key={`a-${a.id}`}
                  position={[a.lat!, a.lng!]}
                  icon={ACADEMY_ICON}
                  eventHandlers={{ click: () => setActive({ kind: "academy", item: a }) }}
                >
                  <Popup>
                    <div className="w-52 space-y-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <Building2 className="h-3.5 w-3.5" />
                        {a.name}
                      </p>
                      {a.area && (
                        <p className="text-xs text-muted-foreground">{a.area}</p>
                      )}
                      <a
                        className="block text-xs font-medium text-primary"
                        href={`/a/${a.slug}`}
                      >
                        {t("map_visit_academy")}
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
        </MapContainer>
      </div>
    </div>
  );
}