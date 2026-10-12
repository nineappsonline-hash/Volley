"use client";

import { googleDirectionsUrl } from "@/lib/google-directions";
import { cairoNow } from "@/lib/member-training";
import { discoveryMatch, type DiscoveryPreferences } from "@/lib/member-discovery";
import { GameCardBackground } from "@/components/games/game-card-background";
import { useId } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Navigation,
  Clock,
  MapPin,
  Users,
  Building2,
  LandPlot,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
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
import { cn } from "@/lib/utils";
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
}: {
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

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
        <div className={cn("relative isolate overflow-hidden px-5 py-6 text-white sm:px-6", {
          "bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700": tone === "games",
          "bg-gradient-to-br from-fuchsia-800 via-purple-700 to-indigo-700": tone === "tournaments",
          "bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700": tone === "academies",
          "bg-gradient-to-br from-orange-800 via-orange-700 to-rose-700": tone === "playgrounds",
        })}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -end-10 -top-16 h-56 w-56 rounded-full border-[24px] border-white/10" />
            <div className="absolute bottom-4 end-5 h-24 w-24 rotate-12 rounded-3xl bg-white/10" />
            <Icon className="absolute bottom-5 end-6 h-20 w-20 -rotate-12 text-white/30 sm:h-28 sm:w-28" strokeWidth={1.25} />
            {tone === "games" && <GameCardBackground sport="volleyball" />}
            <svg viewBox="0 0 160 80" className="absolute end-0 top-0 h-20 w-40 text-amber-300/80" fill="currentColor">
              <path d="m30 12 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm90 30 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
              <circle cx="75" cy="15" r="3" /><circle cx="145" cy="20" r="2" />
            </svg>
          </div>
          <div className="max-w-[75%] space-y-3">
            <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-white/90">{description}</p>
            <Button asChild size="sm" className="h-auto min-h-9 max-w-full whitespace-normal bg-white text-slate-900 shadow-sm hover:bg-white/90">
              <Link href={href} className="gap-2">
                {action}
                <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Card body with horizontal scrollable items */}
        <div className="min-w-0">
          <QueryState queries={[query]}>
            {items.length === 0 ? (
              <div className="border-y border-border/40 p-6">
                <p className="text-sm text-muted-foreground">{empty}</p>
              </div>
            ) : (
              <ul
                id={id}
                role="list"
                aria-label={title}
                className="flex gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 pt-3"
              >
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex min-w-0 shrink-0 basis-[82%] sm:basis-4/9 lg:basis-3/10"
                  >
                    <article
                      style={{ "--i": index } as React.CSSProperties}
                      className="animate-suggest-stagger group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
                    >
                      <Link href={item.href ?? href} aria-label={item.title}>
                      {/* Graphic area: venue photo, else sport court graphics */}
                      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[#0A1E3F]">
                        {/* Court-marking / sport-illustration decorations */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#12C98A]/25 transition-transform duration-500 group-hover:scale-110 motion-reduce:group-hover:scale-100">
                          {item.sport && Object.hasOwn(SPORT_SLUGS, sportToSlug(item.sport)) ? (
                            <GameCardBackground sport={item.sport} />
                          ) : (
                            <Icon className="h-14 w-14" aria-hidden="true" />
                          )}
                        </div>
                        {item.image && (
                          // User-provided venue images may be hosted outside the Next image allowlist.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100 ${item.academyLogo !== undefined ? "bg-white object-contain p-5" : "object-cover"}`}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        {item.badge && (
                          <span className="absolute start-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      </Link>
                      {/* Content */}
                      <div className="space-y-2 p-3">
                        {item.reason && <p className="text-xs font-semibold text-primary">{item.reason}</p>}
                        <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">
                          <Link href={item.href ?? href} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.title}</Link>
                        </h3>
                        {item.details ? <div className="space-y-2 border-t border-border/60 pt-3 text-xs">
                          <p className="flex items-start gap-2 font-medium"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />{item.details.date}</p>
                          <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" />{item.details.time}</p>
                          {item.details.location && <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{item.details.location}</p>}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2"><span className="font-semibold text-primary">{item.details.price}</span><span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" />{item.details.places}</span></div>
                        </div> : <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>}
                        {item.directionsHref && <div className="border-t border-border/60 pt-3"><Button asChild variant="outline" size="sm" className="w-full gap-2"><a href={item.directionsHref} target="_blank" rel="noopener noreferrer"><Navigation className="h-3.5 w-3.5" />{t("directions")}</a></Button></div>}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>

        </div>
      </div>
    </section>
  );
}

export function MemberDiscoveryCards({ memberId, hasAcademy, preferences = {}, mode = "all" }: { memberId: string; hasAcademy: boolean; preferences?: DiscoveryPreferences; mode?: "all" | "games" | "academies" }) {
  const { t, lang, locale } = useI18n();
  useRealtime(["friendly_games", "friendly_game_participants"]);
  const games = useFriendlyGames();
  const academies = usePublicAcademies();
  const myGames = useMyUpcomingGames(memberId);
  const follows = useMyAcademyFollows();
  const ar = lang === "ar";
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
  const gameItems = (games.data ?? [])
    .filter(
      (game) =>
        (game.status === "open" || game.status === "full") &&
        game.game_date >= today
    )
    .sort(
      (a, b) =>
        gameMatch(b).score - gameMatch(a).score ||
        `${a.game_date} ${a.start_time}`.localeCompare(
          `${b.game_date} ${b.start_time}`
        )
    )
    .slice(0, 12)
    .map((game) => ({
      id: game.id,
      title: game.title,
      reason: reasonLabel(gameMatch(game)),
      href: game.invite_code ? `/dashboard/games?join=${encodeURIComponent(game.invite_code)}` : "/dashboard/games",
      badge: game.sport,
      sport: game.sport,
      directionsHref: game.playground?.location_link || game.playground?.name || game.location || game.area || (game.lat != null && game.lng != null)
        ? googleDirectionsUrl(game.playground?.lat ?? game.lat, game.playground?.lng ?? game.lng, [game.playground?.name || game.location, game.playground?.area || game.area].filter(Boolean).join(", "), game.playground?.location_link)
        : undefined,
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
    <div className="min-w-0 space-y-4">
      {mode !== "games" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <p>{ar ? "خصّص اقتراحاتك بالرياضات والمستوى وأيامك المتاحة." : "Make these suggestions yours with your sports, skill level, and available days."}</p>
        <Link href="/profile" className="font-semibold text-primary underline underline-offset-4">{ar ? "تعديل تفضيلاتي" : "Edit my preferences"}</Link>
      </div>}
      {mode !== "games" && <DiscoveryCard
        title={ar ? "الأكاديميات" : "Academies"}
        tone="academies"
        description={ar ? "طوّر مهاراتك واكتشف مكانك وسط فريق جديد." : "Build your skills. Find your team. Grow your game."}
        action={academyJoined ? (ar ? "اكتشف المزيد من الأكاديميات" : "Discover more academies") : (ar ? "ابحث عن أكاديمية" : "Find an academy")}
        href="/academies"
        icon={Building2}
        items={academyItems}
        query={academies}
        empty={ar ? "مفيش أكاديميات متاحة حالياً." : "No academies available yet."}
      />}
      {mode !== "academies" && <DiscoveryCard
        title={ar ? "المباريات" : "Games"}
        tone="games"
        description={ar ? "انزل الملعب وقابل لاعبين وشارك في المباراة الجاية." : "Hit the court, meet new players, and make your next move."}
        action={gameJoined ? (ar ? "اكتشف المزيد من المباريات" : "Discover more games") : (ar ? "ابحث عن مباراة" : "Find games")}
        href="/dashboard/games"
        icon={LandPlot}
        items={gameItems}
        query={games}
        empty={ar ? "مفيش مباريات متاحة حالياً. تابعنا قريب." : "No active games right now. Check back soon."}

      />}

    </div>
  );
}
