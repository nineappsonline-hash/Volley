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
  footer,
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  items: DiscoveryItem[];
  query: DiscoveryQuery;
  empty: string;
  /** Optional CTA rendered under the strip (e.g. "Discover more games"). */
  footer?: React.ReactNode;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
        {/* Dark graphic header with court markings behind the title */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden bg-[#0A1E3F] px-4 py-3 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-25">
            <svg
              aria-hidden="true"
              viewBox="0 0 240 60"
              preserveAspectRatio="xMidYMid slice"
              className="h-full w-full -scale-x-100 text-success-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M0 0h60v60H0M180 0h60v60h-60M60 30h120M120 0v60" />
              <circle cx="120" cy="30" r="10" />
            </svg>
          </div>
          <h2
            id={`${id}-title`}
            className="relative flex items-center gap-2 text-base font-semibold"
          >
            <Icon className="h-5 w-5 text-[#12C98A]" aria-hidden="true" />
            {title}
          </h2>
          <Link
            href={href}
            className="relative rounded text-xs font-semibold text-[#12C98A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ar ? "عرض الكل" : "View all"}
          </Link>
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
          {items.length > 0 && footer && <div className="px-4 pb-4">{footer}</div>}
        </div>
      </div>
    </section>
  );
}

export function MemberDiscoveryCards() {
  const { t, lang, locale } = useI18n();
  useRealtime(["friendly_games", "friendly_game_participants"]);
  const games = useFriendlyGames();
  const tournaments = useAllTournaments();
  const playgrounds = usePlaygrounds();
  const academies = usePublicAcademies();
  const ar = lang === "ar";
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
        title={ar ? "أكاديميات حولك" : "Academies around you"}
        href="/academies"
        icon={Building2}
        items={academyItems}
        query={academies}
        empty={ar ? "مفيش أكاديميات متاحة حالياً." : "No academies available yet."}
      />
      <DiscoveryCard
        title={ar ? "مباريات حولك" : "Games around you"}
        href="/dashboard/games"
        icon={LandPlot}
        items={gameItems}
        query={games}
        empty={ar ? "مفيش مباريات متاحة حالياً. تابعنا قريب." : "No active games right now. Check back soon."}
        footer={
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href="/dashboard/games">
              {ar ? "اكتشف المزيد من المباريات" : "Discover more games"}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <DiscoveryCard
        title={t("nav_tournaments")}
        href="/dashboard/tournaments"
        icon={Trophy}
        items={tournamentItems}
        query={tournaments}
        empty={ar ? "مفيش بطولات حالية أو قادمة." : "No active or upcoming tournaments right now."}
      />
      <DiscoveryCard
        title={t("nav_playgrounds")}
        href="/playgrounds"
        icon={LandPlot}
        items={playgroundItems}
        query={playgrounds}
        empty={ar ? "مفيش ملاعب متاحة حالياً." : "No playgrounds available yet."}
      />
    </div>
  );
}
