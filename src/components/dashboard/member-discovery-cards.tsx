"use client";

import { AcademyLogo } from "@/components/academies/academy-logo";
import { GameCardBackground } from "@/components/games/game-card-background";
import { useId } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  LandPlot,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { useI18n } from "@/lib/i18n";
import {
  useAllTournaments,
  useFriendlyGames,
  usePlaygrounds,
  usePublicAcademies,
  useMyAcademyFollows,
  useMyUpcomingGames,
  useMyTournaments,
} from "@/lib/queries";
import { formatTime12h } from "@/lib/constants";
import { venueCardPhoto } from "@/lib/venue-media";
import { sportToSlug, SPORT_SLUGS } from "@/lib/sport-slugs";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";

type DiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  academyLogo?: string | null;
  image?: string | null;
  href?: string;
  /** A recognised sport, for the graphic court-marking background. */
  sport?: string;
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
                    <Link
                      href={item.href ?? href}
                      style={{ "--i": index } as React.CSSProperties}
                      className="animate-suggest-stagger group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
                    >
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
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        {item.academyLogo !== undefined && (
                          <span className="absolute start-3 bottom-3 rounded-full bg-background/95 p-1 shadow-sm">
                            <AcademyLogo
                              academyId={item.id}
                              name={item.title}
                              logoUrl={item.academyLogo}
                            />
                          </span>
                        )}
                        {item.badge && (
                          <span className="absolute start-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-2 p-3">
                        <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">
                          {item.title}
                        </h3>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                    </Link>
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

export function MemberDiscoveryCards({ memberId, hasAcademy }: { memberId: string; hasAcademy: boolean }) {
  const { t, lang, locale } = useI18n();
  useRealtime(["friendly_games", "friendly_game_participants"]);
  const games = useFriendlyGames();
  const tournaments = useAllTournaments();
  const playgrounds = usePlaygrounds();
  const academies = usePublicAcademies();
  const myGames = useMyUpcomingGames(memberId);
  const myTournaments = useMyTournaments(memberId);
  const follows = useMyAcademyFollows();
  const ar = lang === "ar";
  const academyJoined = hasAcademy || !!follows.data?.length;
  const gameJoined = !!myGames.data?.length;
  const tournamentJoined = !!myTournaments.data?.length;
  const today = format(new Date(), "yyyy-MM-dd");
  const dateLabel = (date: string) =>
    format(new Date(`${date}T00:00:00`), "MMM d", { locale });

  const gameItems = (games.data ?? [])
    .filter(
      (game) =>
        (game.status === "open" || game.status === "full") &&
        game.game_date >= today
    )
    .sort(
      (a, b) =>
        `${a.game_date} ${a.start_time}`.localeCompare(
          `${b.game_date} ${b.start_time}`
        )
    )
    .slice(0, 12)
    .map((game) => ({
      id: game.id,
      title: game.title,
      badge: game.sport,
      sport: game.sport,
      subtitle: [
        dateLabel(game.game_date),
        formatTime12h(game.start_time, lang),
        game.playground?.name ?? game.location ?? game.area,
      ]
        .filter(Boolean)
        .join(" · "),
      image: venueCardPhoto(game.playground?.photos, game.playground?.cover_url),
    }));

  const tournamentItems = (tournaments.data ?? [])
    .filter(
      (tournament) =>
        tournament.status === "in_progress" ||
        (tournament.status === "upcoming" && tournament.start_date >= today)
    )
    .sort(
      (a, b) =>
        Number(b.status === "in_progress") -
        Number(a.status === "in_progress") ||
        a.start_date.localeCompare(b.start_date)
    )
    .slice(0, 12)
    .map((tournament) => ({
      id: tournament.id,
      title: tournament.name,
      badge: t(`tournament_status_${tournament.status}`),
      sport: tournament.sport?.name ?? undefined,
      subtitle: [
        tournament.sport?.name,
        dateLabel(tournament.start_date),
        tournament.academy?.name,
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  const playgroundItems = (playgrounds.data ?? [])
    .slice(0, 12)
    .map((playground) => ({
      id: playground.id,
      title: playground.name,
      badge: playground.sport?.name,
      sport: playground.sport?.name ?? undefined,
      subtitle: [
        playground.area,
        playground.governorate,
        playground.country,
      ]
        .filter(Boolean)
        .join(" · ") ||
      playground.address ||
      (ar ? "اكتشف الملعب" : "Explore this playground"),
      image: venueCardPhoto(playground.photos, playground.cover_url),
    }));

  const academyItems = (academies.data ?? [])
    .slice(0, 12)
    .map((academy) => ({
      id: academy.id,
      title: academy.name,
      image: academy.cover_url,
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
      <DiscoveryCard
        title={ar ? "الأكاديميات" : "Academies"}
        tone="academies"
        description={ar ? "طوّر مهاراتك واكتشف مكانك وسط فريق جديد." : "Build your skills. Find your team. Grow your game."}
        action={academyJoined ? (ar ? "اكتشف المزيد من الأكاديميات" : "Discover more academies") : (ar ? "ابحث عن أكاديمية" : "Find an academy")}
        href="/academies"
        icon={Building2}
        items={academyItems}
        query={academies}
        empty={ar ? "مفيش أكاديميات متاحة حالياً." : "No academies available yet."}
      />
      <DiscoveryCard
        title={ar ? "المباريات" : "Games"}
        tone="games"
        description={ar ? "انزل الملعب وقابل لاعبين وشارك في المباراة الجاية." : "Hit the court, meet new players, and make your next move."}
        action={gameJoined ? (ar ? "اكتشف المزيد من المباريات" : "Discover more games") : (ar ? "ابحث عن مباراة" : "Find games")}
        href="/dashboard/games"
        icon={LandPlot}
        items={gameItems}
        query={games}
        empty={ar ? "مفيش مباريات متاحة حالياً. تابعنا قريب." : "No active games right now. Check back soon."}

      />
      <DiscoveryCard
        title={t("nav_tournaments")}
        tone="tournaments"
        description={ar ? "تحدّى نفسك ونافس على الكأس مع فريقك." : "Bring your team spirit. Chase the trophy. Make it count."}
        action={tournamentJoined ? (ar ? "اكتشف المزيد من البطولات" : "Discover more tournaments") : (ar ? "ابحث عن بطولة" : "Find tournaments")}
        href="/dashboard/tournaments"
        icon={Trophy}
        items={tournamentItems}
        query={tournaments}
        empty={ar ? "مفيش بطولات حالية أو قادمة." : "No active or upcoming tournaments right now."}
      />
      <DiscoveryCard
        title={t("nav_playgrounds")}
        tone="playgrounds"
        description={ar ? "اكتشف ملاعب جديدة لمباراتك الجاية." : "Find a fresh court for your next great game."}
        action={ar ? "ابحث عن ملعب" : "Find playgrounds"}
        href="/playgrounds"
        icon={LandPlot}
        items={playgroundItems}
        query={playgrounds}
        empty={ar ? "مفيش ملاعب متاحة حالياً." : "No playgrounds available yet."}
      />
    </div>
  );
}
