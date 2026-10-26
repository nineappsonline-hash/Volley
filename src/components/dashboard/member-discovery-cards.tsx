"use client";

import { DashboardCreateGameButton } from "./create-game-button";
import { GuestGameList } from "./guest-game-list";
import type { FriendlyGameWithDetails } from "@/lib/types";
import { DashboardGameList } from "./dashboard-game-list";
import type { Profile } from "@/lib/types";
import { GoogleMapsDirectionsButton } from "@/components/shared/google-maps-directions-button";
import { googleDirectionsUrl } from "@/lib/google-directions";
import { cairoNow } from "@/lib/member-training";
import { discoveryMatch, type DiscoveryPreferences } from "@/lib/member-discovery";
import { GameCardBackground } from "@/components/games/game-card-background";
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  SlidersHorizontal,
  Building2,
  LandPlot,
  type LucideIcon,
} from "lucide-react";
import { QueryState } from "@/components/shared/query-state";
import type { Dict } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n";
import {
  useFriendlyGames,
  usePublicAcademies,
  useMyAcademyFollows,
  useMyUpcomingGames,
} from "@/lib/queries";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { venueCardPhoto } from "@/lib/venue-media";
import { sportToSlug, SPORT_SLUGS } from "@/lib/sport-slugs";
import { useRealtime } from "@/lib/useRealtime";

type DiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  reason?: string;
  academyLogo?: string | null;
  image?: string | null;
  href?: string;
  directionsHref?: string;
  status?: string;
  /** A recognised sport, for the graphic court-marking background. */
  sport?: string;
  details?: { date: string; time: string; location?: string | null; price: string; places: string };
};

type DiscoveryQuery = {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
};

function DiscoveryCard({
  title,
  href,
  icon: Icon,
  items,
  query,
  empty,
  tone,
  description,
  action,
  live = false,
  controls,
  filters,
  content,
}: {
  content?: ReactNode;
  controls?: ReactNode;
  filters?: ReactNode;
  live?: boolean;
  title: string;
  href: string;
  icon: LucideIcon;
  items: DiscoveryItem[];
  query: DiscoveryQuery;
  empty: string;
  tone: "games" | "tournaments" | "academies" | "playgrounds";
  description: string;
  action: string;
}) {
  const { t } = useI18n();
  const id = useId();

  return <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-4">
    <header className={live ? "flex flex-wrap items-center justify-between gap-3" : "flex flex-wrap items-end justify-between gap-3"}>
      <div className="min-w-0">{!live && <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{tone === "games" ? (t("games_page_title")) : description}</p>}<h2 id={`${id}-title`} className="text-2xl font-extrabold tracking-tight">{title}</h2></div>
      {controls}
      {!live && <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{action}<ArrowRight size={14} className="rtl:rotate-180" aria-hidden="true" /></Link>}
    </header>
    {filters}
    <QueryState queries={[query]}>
      {items.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{empty}</p> : content ?? <ul id={id} aria-label={title} className={live ? "flex flex-col gap-3" : "flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"}>
        {items.map(item => <li key={item.id} className={live ? "min-w-0" : "w-[48%] min-w-0 max-w-80 shrink-0 snap-start sm:w-[44%] lg:w-[31%]"}>
          <article className={live ? "flex overflow-hidden rounded-xl border bg-card" : "h-full overflow-hidden rounded-xl border bg-card"}>
            <Link href={item.href ?? href} className={`${live ? "w-28 shrink-0 sm:w-44" : ""} group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}>
              <div className="relative isolate aspect-[4/3] overflow-hidden bg-brand">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 text-highlight/30">{item.sport && Object.hasOwn(SPORT_SLUGS, sportToSlug(item.sport)) ? <GameCardBackground sport={item.sport} /> : <Icon className="absolute start-1/3 top-1/3 h-16 w-16" />}</div>
                {/* Venue image hosts are supplied by academy and court owners. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.image && <img src={item.image} alt="" loading="lazy" className={`absolute inset-0 h-full w-full ${item.academyLogo !== undefined ? "bg-white object-contain p-5" : "object-cover"}`} onError={event => { event.currentTarget.style.display = "none"; }} />}
                {item.badge && <span className="absolute start-3 top-3 rounded-full bg-brand/90 px-2.5 py-1 text-[10px] font-bold text-highlight">{item.badge}</span>}
                {item.status && <span className={`absolute end-3 ${live ? "bottom-2" : "top-3"} rounded-full bg-background/95 px-2 py-1 text-[10px] font-semibold text-foreground`}>{t(`community_status_${item.status}` as keyof Dict)}</span>}
              </div>
              <div className="bg-brand px-3 py-2.5 text-white"><h3 className="line-clamp-2 text-sm font-bold leading-5 text-white">{item.title}</h3></div>
            </Link>
            <div className="min-w-0 flex-1 space-y-2.5 p-3">
              {item.reason && <p className="text-[11px] font-semibold text-muted-foreground">{item.reason}</p>}
              {item.details ? <div className="space-y-2 text-xs">
                <p className="flex items-start gap-2 font-medium"><CalendarDays size={13} className="shrink-0" aria-hidden="true" />{item.details.date}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Clock size={13} aria-hidden="true" />{item.details.time}</p>
                {item.details.location && <p className="flex items-start gap-2 text-muted-foreground"><MapPin size={13} className="shrink-0" aria-hidden="true" />{item.details.location}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"><strong>{item.details.price}</strong><span className="text-muted-foreground">{item.details.places}</span></div>
              </div> : <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>}
              {item.directionsHref && <div className="border-t pt-2"><GoogleMapsDirectionsButton href={item.directionsHref} className="w-full" /></div>}
            </div>
          </article>
        </li>)}
      </ul>}
    </QueryState>
  </section>;
}

export function MemberDiscoveryCards({ memberId, hasAcademy, preferences = {}, profile, guestQuery, focusGameId, mode = "all", interactive = false, sportFilter = "all" }: { focusGameId?: string; guestQuery?: DiscoveryQuery & { data: FriendlyGameWithDetails[] }; profile?: Profile; interactive?: boolean; sportFilter?: string; memberId: string; hasAcademy: boolean; preferences?: DiscoveryPreferences; mode?: "all" | "games" | "academies" }) {
  const { t, lang, locale } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [court, setCourt] = useState("");
  const [level, setLevel] = useState("all");
  const [date, setDate] = useState("");
  useRealtime(["friendly_games", "friendly_game_participants"], !guestQuery);
  const memberGames = useFriendlyGames(!guestQuery);
  const games = guestQuery ?? memberGames;
  const academies = usePublicAcademies();
  const myGames = useMyUpcomingGames(memberId);
  const follows = useMyAcademyFollows(!guestQuery);
  const ar = lang === "ar";
  const selectedSportLabel = ar ? ({ Tennis: "تنس", Padel: "بادل", Basketball: "كرة سلة", Volleyball: "كرة طائرة", "Beach Volleyball": "طائرة شاطئية", Archery: "رماية بالقوس" } as Record<string, string>)[sportFilter] ?? sportFilter : sportFilter;
  const academyJoined = hasAcademy || !!follows.data?.length;
  const gameJoined = !!myGames.data?.length;
  const today = cairoNow().slice(0, 10);
  const dateLabel = (date: string) => {
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    const relative = days === 0 ? (ar ? "اليوم" : "Today") : days === 1 ? (ar ? "غداً" : "Tomorrow") : days === 2 ? (ar ? "بعد غد" : "Day after tomorrow") : null;
    const fullDate = format(new Date(`${date}T00:00:00`), "EEEE, MMM d", { locale });
    return relative ? `${relative} · ${fullDate}` : fullDate;
  };

  const reasonLabel = (match: ReturnType<typeof discoveryMatch>) => {
    const labels = {
      sport: ar ? "رياضتك المفضلة" : "Matches your sport",
      day: ar ? "يناسب أيامك المتاحة" : "Fits your available days",
      skill: ar ? "يناسب مستواك" : "Matches your skill level",
      nearby: ar ? "قريب منك" : "Within 20 km of you",
    };
    return match.reasons.map(reason => labels[reason]).join(" · ");
  };
  const gameMatch = (game: NonNullable<typeof games.data>[number]) => discoveryMatch({
    sport: game.sport, date: game.game_date, skill_level: game.skill_level,
    lat: game.playground?.lat ?? game.lat, lng: game.playground?.lng ?? game.lng,
  }, preferences);
  const governorates = [...new Set((games.data ?? []).map(game => game.playground?.governorate).filter((value): value is string => !!value))].sort();
  const cities = [...new Set((games.data ?? []).filter(game => !governorate || game.playground?.governorate === governorate).map(game => game.playground?.area ?? game.area).filter((value): value is string => !!value))].sort();
  const activeFilters = [governorate, city, age, gender !== "all", maxPrice, court, level !== "all", date].filter(Boolean).length;
  const gameItems = (games.data ?? [])
    .filter(
      (game) =>
        (game.status === "open" || game.status === "full") &&
        game.game_date >= today &&
        (!interactive || ((sportFilter === "all" || game.sport?.trim().toLowerCase() === sportFilter.toLowerCase()) &&
          (level === "all" || game.skill_level === level) && (!date || game.game_date === date) &&
          (!governorate || game.playground?.governorate === governorate) &&
          (!city || (game.playground?.area ?? game.area) === city) &&
          (!age || ((game.min_age == null || Number(age) >= game.min_age) && (game.max_age == null || Number(age) <= game.max_age))) &&
          (gender === "all" || game.gender === gender) &&
          (maxPrice === "" || (game.host_pays ? 0 : game.share_price) != null && (game.host_pays ? 0 : game.share_price!) <= Number(maxPrice)) &&
          (!court.trim() || [game.title, game.location, game.playground?.name].some(value => value?.toLowerCase().includes(court.trim().toLowerCase())))))
    )
    .sort(
      (a, b) =>
        gameMatch(b).score - gameMatch(a).score ||
        `${a.game_date} ${a.start_time}`.localeCompare(
          `${b.game_date} ${b.start_time}`
        )
    )
    .slice(0, interactive ? Infinity : 12)
    .map((game) => ({
      game,
      id: game.id,
      title: game.title,
      reason: reasonLabel(gameMatch(game)),
      href: game.invite_code ? `/dashboard/games?join=${encodeURIComponent(game.invite_code)}` : "/dashboard/games",
      badge: game.sport,
      status: game.status,
      sport: game.sport,
      directionsHref: googleDirectionsUrl(game.playground?.location_link),
      details: {
        date: dateLabel(game.game_date),
        time: formatTime12h(game.start_time, lang),
        location: game.playground?.name ?? game.location ?? game.area,
        price: game.host_pays ? (ar ? "المضيف يغطي التكلفة" : "Host pays") : game.share_price == null ? (ar ? "السعر غير محدد" : "Price not set") : formatMoney(game.share_price, lang),
        places: `${Math.max(0, game.max_players - game.participants_count)} ${ar ? "مكان متاح" : "spots available"}`,
      },
      subtitle: [
        dateLabel(game.game_date),
        formatTime12h(game.start_time, lang),
        game.playground?.name ?? game.location ?? game.area,
        game.host_pays ? (ar ? "المضيف يغطي التكلفة" : "Host pays") : game.share_price == null ? (ar ? "السعر غير محدد" : "Price not set") : formatMoney(game.share_price, lang),
        `${Math.max(0, game.max_players - game.participants_count)} ${ar ? "مكان متاح" : "spots available"}`,
      ]
        .filter(Boolean)
        .join(" · "),
      image: venueCardPhoto(game.playground?.photos, game.playground?.cover_url),
    }));

  const academyItems = (academies.data ?? [])
    .slice(0, 12)
    .map((academy) => ({
      id: academy.id,
      title: academy.name,
      image: academy.logo_url,
      academyLogo: academy.logo_url,
      subtitle: [
        academy.area,
        academy.governorate,
        academy.country,
      ]
        .filter(Boolean)
        .join(" · ") ||
      academy.description ||
      (ar ? "اكتشف الأكاديمية" : "Explore this academy"),
      href: academy.slug ? `/a/${encodeURIComponent(academy.slug)}` : "/academies",
    }));

  return (
    <div id={interactive ? "member-live-games" : undefined} className="min-w-0 space-y-4">


      {mode !== "games" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <p>{ar ? "خصّص اقتراحاتك بالرياضات والمستوى وأيامك المتاحة." : "Make these suggestions yours with your sports, skill level, and available days."}</p>
        <Link href="/profile" className="font-semibold text-primary underline underline-offset-4">{ar ? "تعديل تفضيلاتي" : "Edit my preferences"}</Link>
      </div>}
      {mode !== "games" && <DiscoveryCard
        title={ar ? "الأكاديميات" : "Academies"}
        tone="academies"
        description={ar ? "طوّر مهاراتك واكتشف مكانك وسط فريق جديد." : "Build your skills. Find your team. Grow your game."}
        action={academyJoined ? (ar ? "اكتشف المزيد من الأكاديميات" : "Discover more academies") : (ar ? "دور على أكاديمية" : "Find an academy")}
        href="/academies"
        icon={Building2}
        items={academyItems}
        query={academies}
        empty={ar ? "مفيش أكاديميات متاحة حالياً." : "No academies available yet."}
      />}
      {mode !== "academies" && <DiscoveryCard
        controls={interactive && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><DashboardCreateGameButton sport={sportFilter} profile={profile} /><button type="button" aria-label={ar ? "فلاتر الماتشات" : "Game filters"} title={ar ? "فلاتر الماتشات" : "Game filters"} aria-expanded={filtersOpen} aria-controls="member-game-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><SlidersHorizontal size={19} aria-hidden="true" />{activeFilters > 0 && <span className="absolute -end-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-foreground">{activeFilters}</span>}</button></div>}
        filters={interactive && filtersOpen && <div id="member-game-filters" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">{ar ? "المحافظة" : "Governorate"}<select className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" value={governorate} onChange={e => { setGovernorate(e.target.value); setCity(""); }}><option value="">{ar ? "الكل" : "All"}</option>{governorates.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm">{ar ? "المدينة / المنطقة" : "City / area"}<select className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" value={city} onChange={e => { setCity(e.target.value); }}><option value="">{ar ? "الكل" : "All"}</option>{cities.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm">{ar ? "مستوى اللاعبين" : "Player level"}<select className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" value={level} onChange={e => setLevel(e.target.value)}><option value="all">{ar ? "كل المستويات" : "All levels"}</option>{["beginner", "intermediate", "advanced"].map(value => <option key={value} value={value}>{t(`skill_${value}` as keyof Dict)}</option>)}</select></label>
          <label className="text-sm">{ar ? "نوع الماتش" : "Gender"}<select className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" value={gender} onChange={e => setGender(e.target.value)}><option value="all">{ar ? "الكل" : "All"}</option><option value="male">{ar ? "رجال" : "Men"}</option><option value="female">{ar ? "سيدات" : "Women"}</option><option value="mixed">{ar ? "مختلط" : "Mixed"}</option></select></label>
          <label className="text-sm">{ar ? "عمر اللاعب" : "Player age"}<input className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" type="number" min="0" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} /></label>
          <label className="text-sm">{ar ? "أقصى سعر (جنيه)" : "Maximum price (EGP)"}<input className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
          <label className="text-sm">{ar ? "التاريخ" : "Date"}<input className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="text-sm">{ar ? "اسم الملعب أو الماتش" : "Court or game name"}<input className="mt-1 min-h-10 w-full rounded-lg border bg-background px-3" type="search"  value={court} onChange={e => setCourt(e.target.value)} /></label>
          <button type="button" className="w-fit self-end rounded-lg border px-3 py-2 text-sm" onClick={() => { setGovernorate(""); setCity(""); setAge(""); setGender("all"); setMaxPrice(""); setCourt(""); setDate(""); setLevel("all"); }}>{ar ? "مسح الفلاتر" : "Clear filters"}</button>
        </div>}
        content={interactive && guestQuery ? <GuestGameList games={gameItems.map(item => item.game)} /> : interactive && profile ? <DashboardGameList games={gameItems.map(item => item.game)} profile={profile} /> : undefined}
        live={interactive}
        title={interactive ? (sportFilter === "all" ? (ar ? "الماتشات الحالية" : "Current games") : `${selectedSportLabel} · ${ar ? "الماتشات الحالية" : "Current games"}`) : (ar ? "مقترح ليك" : "Recommended for you")}
        tone="games"
        description={ar ? "انزل الملعب وقابل لاعبين وشارك في الماتش الجاي." : "Hit the court, meet new players, and make your next move."}
        action={gameJoined ? (ar ? "اكتشف المزيد من الماتشات" : "Discover more games") : (ar ? "دور على ماتش" : "Find games")}
        href="/dashboard/games"
        icon={LandPlot}
        items={gameItems}
        query={games}
        empty={interactive ? (ar ? "مفيش ماتشات مفتوحة مطابقة للاختيار ده حالياً." : "No open games match this selection.") : (ar ? "مفيش ماتشات متاحة حالياً. تابعنا قريب." : "No active games right now. Check back soon.")}

      />}

    </div>
  );
}
