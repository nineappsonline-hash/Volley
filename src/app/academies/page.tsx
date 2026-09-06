"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, Loader2, MapPin, Navigation, Search, Star, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { matchesBilingual } from "@/lib/search";
import { formatKm, haversineKm, type LatLng } from "@/lib/geo";
import { COUNTRIES, COUNTRIES_AR, localizeCountry, normalizeCountry } from "@/lib/locations";
import { createClient } from "@/lib/supabase/client";
import {
  joinPublicAcademy,
  useAcademyRatings,
  usePublicAcademies,
  usePublicSports,
  useRateAcademy,
} from "@/lib/queries";

function Stars({
  value,
  size = "h-4 w-4",
}: {
  value: number;
  size?: string;
}) {
  return (
    <span className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

export default function AcademiesDirectoryPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const { data: academies, isLoading } = usePublicAcademies();
  const { data: sports } = usePublicSports();
  const { data: ratings } = useAcademyRatings();
  const rate = useRateAcademy();

  const [myId, setMyId] = useState<string | null>(null);
  const [myAcademyId, setMyAcademyId] = useState<string | null | undefined>(
    undefined
  );
  const [joining, setJoining] = useState<string | null>(null);

  // Who am I? Anonymous visitors can browse but not join or rate.
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setMyId(null);
        setMyAcademyId(undefined);
        return;
      }
      setMyId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("academy_id, lat, lng")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) {
        setMyAcademyId(profile?.academy_id ?? null);
        // Default the "nearest" reference to the member's saved profile pin.
        if (profile?.lat != null && profile?.lng != null) {
          setMyLoc({ lat: profile.lat, lng: profile.lng });
          setSortMode("nearest");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const statsByAcademy = useMemo(() => {
    const map = new Map<
      string,
      { avg: number; count: number; mine?: number }
    >();
    for (const r of ratings ?? []) {
      const s = map.get(r.academy_id) ?? { avg: 0, count: 0 };
      const total = s.avg * s.count + r.rating;
      s.count += 1;
      s.avg = total / s.count;
      map.set(r.academy_id, s);
    }
    if (myId) {
      for (const r of ratings ?? []) {
        if (r.member_id === myId) {
          const s = map.get(r.academy_id);
          if (s) s.mine = r.rating;
        }
      }
    }
    return map;
  }, [ratings, myId]);

  const sportsByAcademy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of sports ?? []) {
      const list = map.get(s.academy_id) ?? [];
      list.push(s.name);
      map.set(s.academy_id, list);
    }
    return map;
  }, [sports]);

  // ── Filters ──
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterGov, setFilterGov] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [filterSport, setFilterSport] = useState("all");
  const [filterRating, setFilterRating] = useState("0");
  const [searchQuery, setSearchQuery] = useState("");
  const [maxKm, setMaxKm] = useState("0");
  const [myLoc, setMyLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [sortMode, setSortMode] = useState<"name" | "nearest">("name");

  const countries = useMemo(() => {
    // Full localized catalog so the member's own country is always available.
    const catalog = lang === "ar" ? Object.values(COUNTRIES_AR) : COUNTRIES;
    const set = new Set<string>(catalog);
    for (const a of academies ?? []) {
      if (a.country) set.add(localizeCountry(a.country, lang));
    }
    return [...set].sort((x, y) => x.localeCompare(y, lang));
  }, [academies, lang]);

  const governorates = useMemo(() => {
    const set = new Set<string>();
    for (const a of academies ?? []) {
      if (filterCountry !== "all" && a.country !== filterCountry) continue;
      if (a.governorate) set.add(a.governorate);
    }
    return [...set].sort();
  }, [academies, filterCountry]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const a of academies ?? []) {
      if (filterCountry !== "all" && a.country !== filterCountry) continue;
      if (filterGov !== "all" && a.governorate !== filterGov) continue;
      if (a.area) set.add(a.area);
    }
    return [...set].sort();
  }, [academies, filterCountry, filterGov]);

  const allSports = useMemo(() => {
    const set = new Set<string>();
    for (const s of sports ?? []) set.add(s.name);
    return [...set].sort();
  }, [sports]);

  // Distance from the member's location to each academy (km, null if no coords).
  const distances = useMemo(() => {
    const map = new Map<string, number>();
    if (myLoc) {
      for (const a of academies ?? []) {
        if (a.lat != null && a.lng != null) {
          map.set(a.id, haversineKm(myLoc, { lat: a.lat, lng: a.lng }));
        }
      }
    }
    return map;
  }, [academies, myLoc]);

  const filteredAcademies = useMemo(() => {
    const min = parseFloat(filterRating) || 0;
    const radius = parseFloat(maxKm) || 0;
    const q = searchQuery.trim();
    return (academies ?? []).filter((a) => {
      if (filterCountry !== "all" &&
        normalizeCountry(a.country ?? "") !== normalizeCountry(filterCountry)) return false;
      if (filterGov !== "all" && a.governorate !== filterGov) return false;
      if (filterArea !== "all" && a.area !== filterArea) return false;
      if (filterSport !== "all") {
        const list = sportsByAcademy.get(a.id) ?? [];
        if (!list.includes(filterSport)) return false;
      }
      if (radius > 0 && myLoc) {
        if (a.lat == null || a.lng == null) return false;
        const d = distances.get(a.id) ?? Infinity;
        if (d > radius) return false;
      }
      if (q) {
        const hay = `${a.name} ${a.description ?? ""} ${a.area ?? ""} ${a.governorate ?? ""} ${a.country ?? ""}`;
        if (!matchesBilingual(hay, q)) return false;
      }
      if (min > 0) {
        const stat = statsByAcademy.get(a.id);
        if ((stat?.avg ?? 0) < min) return false;
      }
      return true;
    });
  }, [
    academies,
    filterCountry,
    filterGov,
    filterArea,
    filterSport,
    filterRating,
    maxKm,
    searchQuery,
    myLoc,
    distances,
    sportsByAcademy,
    statsByAcademy,
  ]);

  const locationLabel = (a: NonNullable<typeof academies>[number]) => {
    const country = a.country ? localizeCountry(a.country, lang) : "";
    return a.country || a.governorate || a.area
      ? [a.area, a.governorate, country].filter(Boolean).join(", ")
      : t("directory_no_location");
  };

  // Apply the requested ordering on top of the active filters.
  const sortedAcademies = useMemo(() => {
    const list = filteredAcademies;
    if (sortMode === "nearest" && myLoc) {
      return [...list].sort((a, b) => {
        const da = distances.get(a.id) ?? Infinity;
        const db = distances.get(b.id) ?? Infinity;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [filteredAcademies, sortMode, myLoc, distances]);

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortMode("nearest");
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onJoin = async (academyId: string) => {
    if (!myId) {
      router.push("/signup");
      return;
    }
    setJoining(academyId);
    try {
      const { data: ok, error } = await joinPublicAcademy(academyId);
      if (error) throw error;
      if (ok) {
        toast.success(t("directory_joined"));
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.info(t("directory_already"));
      }
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setJoining(null);
    }
  };

  const onRate = async (academyId: string, value: number) => {
    try {
      await rate.mutateAsync({ academyId, rating: value });
      toast.success(t("rate_submitted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 py-14 text-white">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Volleyball className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {t("directory_title")}
          </h1>
          <p className="max-w-xl text-sm text-white/85">
            {t("directory_subtitle")}
          </p>
          {!myId && (
            <Button asChild variant="secondary" className="mt-2">
              <Link href="/signup">{t("directory_login_to_join")}</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Directory */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Near me toolbar */}
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant={myLoc ? "outline" : "default"}
              onClick={requestLocation}
              disabled={locating}
            >
              <Crosshair
                className={`h-4 w-4 ${locating ? "animate-spin" : ""}`}
              />
              {locating
                ? t("geo_locating")
                : myLoc
                  ? t("geo_near_me")
                  : t("geo_find_near_me")}
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t("directory_sort")}
              </Label>
              <Select
                value={sortMode}
                onValueChange={(v) => {
                  if (v === "nearest") {
                    if (myLoc) setSortMode("nearest");
                    else requestLocation();
                  } else {
                    setSortMode("name");
                  }
                }}
              >
                <SelectTrigger aria-label={t("directory_sort")} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t("directory_sort_name")}</SelectItem>
                  <SelectItem value="nearest">{t("directory_sort_nearest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search + radius */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("directory_search_placeholder")}
                className="ps-9"
              />
            </div>
            {myLoc && (
              <Select value={maxKm} onValueChange={setMaxKm}>
                <SelectTrigger aria-label={t("directory_radius")} className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("directory_radius_any")}</SelectItem>
                  <SelectItem value="5">{t("directory_radius_5")}</SelectItem>
                  <SelectItem value="10">{t("directory_radius_10")}</SelectItem>
                  <SelectItem value="25">{t("directory_radius_25")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {geoError && (
          <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {t("geo_location_error")}
          </p>
        )}

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("directory_filter_country")}
            </Label>
            <Select
              value={filterCountry}
              onValueChange={(v) => {
                setFilterCountry(v);
                setFilterGov("all");
                setFilterArea("all");
              }}
            >
              <SelectTrigger aria-label={t("directory_filter_country")}>
                <SelectValue placeholder={t("directory_filter_country")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("directory_filter_all")}</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("directory_filter_governorate")}
            </Label>
            <Select
              value={filterGov}
              onValueChange={(v) => {
                setFilterGov(v);
                setFilterArea("all");
              }}
            >
              <SelectTrigger aria-label={t("directory_filter_governorate")}>
                <SelectValue placeholder={t("directory_filter_governorate")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("directory_filter_all")}</SelectItem>
                {governorates.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("directory_filter_area")}
            </Label>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger aria-label={t("directory_filter_area")}>
                <SelectValue placeholder={t("directory_filter_area")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("directory_filter_all")}</SelectItem>
                {areas.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("directory_filter_sport")}
            </Label>
            <Select value={filterSport} onValueChange={setFilterSport}>
              <SelectTrigger aria-label={t("directory_filter_sport")}>
                <SelectValue placeholder={t("directory_filter_sport")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("directory_filter_all")}</SelectItem>
                {allSports.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("directory_filter_rating")}
            </Label>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger aria-label={t("directory_filter_rating")}>
                <SelectValue placeholder={t("directory_filter_rating")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("directory_rating_any")}</SelectItem>
                <SelectItem value="3">{t("directory_rating_3")}</SelectItem>
                <SelectItem value="4">{t("directory_rating_4")}</SelectItem>
                <SelectItem value="4.5">{t("directory_rating_4_5")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (academies ?? []).length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {t("directory_empty")}
          </p>
        ) : filteredAcademies.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {t("directory_no_results")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {sortedAcademies.map((a) => {
              const stat = statsByAcademy.get(a.id);
              const academySports = sportsByAcademy.get(a.id) ?? [];
              const km = myLoc ? distances.get(a.id) : undefined;
              const joined = myAcademyId != null && myAcademyId !== undefined;
              return (
                <Card key={a.id} className="flex flex-col overflow-hidden">
                  {a.cover_url ? (
                    <div className="relative aspect-video w-full overflow-hidden border-b">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.cover_url}
                        alt={a.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-600/15 to-sky-400/15">
                      <Volleyball className="h-10 w-10 text-primary/40" />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-2">
                      <Link
                        href={a.slug ? `/a/${a.slug}` : "#"}
                        className="hover:underline"
                      >
                        {a.name}
                      </Link>
                      {stat ? (
                        <span className="flex flex-col items-end gap-0.5 text-xs font-normal text-muted-foreground">
                          <Stars value={stat.avg} />
                          {stat.count > 0 &&
                            t("directory_reviews").replace(
                              "{n}",
                              String(stat.count)
                            )}
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">
                          {t("directory_no_rating")}
                        </span>
                      )}
                    </CardTitle>
                    {a.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    {academySports.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {academySports.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {locationLabel(a)}
                    </p>
                    {km != null && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        {t("geo_distance_km").replace("{d}", formatKm(km))}
                      </p>
                    )}

                    {/* Rate (registered members only) */}
                    {myId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t("directory_your_rating")}:
                        {[1, 2, 3, 4, 5].map((i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`${i}`}
                            disabled={rate.isPending}
                            onClick={() => onRate(a.id, i)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                i <= (stat?.mine ?? 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-2">
                      {joined ? (
                        <Button variant="outline" className="w-full" disabled>
                          {t("directory_already")}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={joining === a.id}
                          onClick={() => onJoin(a.id)}
                        >
                          {joining === a.id && <Loader2 className="animate-spin" />}
                          {myId ? t("directory_join") : t("directory_login_to_join")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("signup_have_account")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signup_login_link")}
          </Link>
        </p>
      </div>
    </main>
  );
}
