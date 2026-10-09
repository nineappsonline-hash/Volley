"use client";

import { AcademyLogo } from "@/components/academies/academy-logo";
import { useId } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Building2,
  LandPlot,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { QueryState } from "@/components/shared/query-state";
import { useI18n } from "@/lib/i18n";
import {
  useAllTournaments,
  useFriendlyGames,
  useMyGames,
  usePlaygrounds,
  usePublicAcademies,
} from "@/lib/queries";
import { formatTime12h } from "@/lib/constants";
import { venueCardPhoto } from "@/lib/venue-media";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";
import {
  ActiveUpcomingGamesCard,
} from "./active-upcoming-games-card";

type DiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  academyLogo?: string | null;
  image?: string | null;
  href?: string;
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
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  items: DiscoveryItem[];
  query: DiscoveryQuery;
  empty: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="group relative overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/50">
        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/30 px-4 py-3">
          <h2
            id={`${id}-title`}
            className="flex items-center gap-2 text-base font-semibold"
          >
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            {title}
          </h2>
          <Link
            href={href}
            className="rounded text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="flex gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 pt-2"
              >
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-w-0 shrink-0 basis-[82%] sm:basis-4/9 lg:basis-3/10"
                  >
                    <Link
                      href={item.href ?? href}
                      className={cn(
                        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      {/* Image / icon area */}
                      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-muted to-primary/5">
                        <Icon className="h-12 w-12 text-primary/40" aria-hidden="true" />
                        {item.image && (
                          // User-provided venue images may be hosted outside the Next image allowlist.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        {item.badge && (
                          <span className="absolute start-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-2 p-3">
                        {item.academyLogo !== undefined && (
                          <AcademyLogo
                            academyId={item.id}
                            name={item.title}
                            logoUrl={item.academyLogo}
                          />
                        )}
                        <h3 className="line-clamp-2 font-semibold group-hover:text-primary">
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

export function MemberDiscoveryCards() {
  const { t, lang, locale } = useI18n();
  useRealtime(["friendly_games", "friendly_game_participants"]);
  const games = useFriendlyGames();
  const myGames = useMyGames();
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
      <ActiveUpcomingGamesCard
        myGames={myGames}
        allGames={games}
        today={today}
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
