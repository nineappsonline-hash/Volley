"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, ChevronLeft, ChevronRight, LandPlot, Trophy, Volleyball, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { useI18n } from "@/lib/i18n";
import { useAllTournaments, useFriendlyGames, usePlaygrounds, usePublicAcademies } from "@/lib/queries";
import { formatTime12h } from "@/lib/constants";
import { venueCardPhoto } from "@/lib/venue-media";

type DiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  image?: string | null;
  href?: string;
};

type DiscoveryQuery = { isPending: boolean; isError: boolean; refetch: () => unknown };

function DiscoveryCarousel({ title, href, icon: Icon, items, query, empty }: {
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
  const track = useRef<HTMLUListElement>(null);
  const scroll = (direction: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * (ar ? -1 : 1) * element.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-primary" aria-hidden="true" />{title}</h2>
        <div className="flex items-center gap-1">
          <Link href={href} className="me-2 rounded text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ar ? "عرض الكل" : "View all"}</Link>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={items.length < 2 || query.isPending || query.isError} aria-label={`${ar ? "السابق" : "Previous"}: ${title}`} aria-controls={id} onClick={() => scroll(-1)}>{ar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={items.length < 2 || query.isPending || query.isError} aria-label={`${ar ? "التالي" : "Next"}: ${title}`} aria-controls={id} onClick={() => scroll(1)}>{ar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
        </div>
      </header>
      <QueryState queries={[query]}>
        {items.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{empty}</p> : (
          <ul id={id} ref={track} tabIndex={0} aria-label={title} className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain rounded-2xl p-1 pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {items.map(item => <li key={item.id} className="w-[82%] max-w-80 shrink-0 snap-start sm:w-[45%] lg:w-[31%]">
              <Link href={item.href ?? href} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-muted to-primary/5">
                  <Icon className="h-12 w-12 text-primary/40" aria-hidden="true" />
                  {item.image && (
                    // User-provided venue images may be hosted outside the Next image allowlist.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />
                  )}
                  {item.badge && <span className="absolute start-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground">{item.badge}</span>}
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="line-clamp-2 font-semibold group-hover:text-primary">{item.title}</h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>
                </div>
              </Link>
            </li>)}
          </ul>
        )}
      </QueryState>
    </section>
  );
}

export function MemberDiscoveryCarousels() {
  const { t, lang, locale } = useI18n();
  const games = useFriendlyGames();
  const tournaments = useAllTournaments();
  const playgrounds = usePlaygrounds();
  const academies = usePublicAcademies();
  const ar = lang === "ar";
  const today = format(new Date(), "yyyy-MM-dd");
  const dateLabel = (date: string) => format(new Date(`${date}T00:00:00`), "MMM d", { locale });

  const gameItems = (games.data ?? [])
    .filter(game => (game.status === "open" || game.status === "full") && game.game_date >= today)
    .sort((a, b) => `${a.game_date} ${a.start_time}`.localeCompare(`${b.game_date} ${b.start_time}`))
    .slice(0, 12)
    .map(game => ({
      id: game.id, title: game.title, badge: game.sport,
      subtitle: [dateLabel(game.game_date), formatTime12h(game.start_time, lang), game.playground?.name ?? game.location ?? game.area].filter(Boolean).join(" · "),
      image: venueCardPhoto(game.playground?.photos, game.playground?.cover_url),
    }));
  const tournamentItems = (tournaments.data ?? [])
    .filter(tournament => tournament.status === "in_progress" || (tournament.status === "upcoming" && tournament.start_date >= today))
    .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress") || a.start_date.localeCompare(b.start_date))
    .slice(0, 12)
    .map(tournament => ({
      id: tournament.id, title: tournament.name,
      badge: t(`tournament_status_${tournament.status}`),
      subtitle: [tournament.sport?.name, dateLabel(tournament.start_date), tournament.academy?.name].filter(Boolean).join(" · "),
    }));
  const playgroundItems = (playgrounds.data ?? []).slice(0, 12).map(playground => ({
    id: playground.id, title: playground.name, badge: playground.sport?.name,
    subtitle: [playground.area, playground.governorate, playground.country].filter(Boolean).join(" · ") || playground.address || (ar ? "اكتشف الملعب" : "Explore this playground"),
    image: venueCardPhoto(playground.photos, playground.cover_url),
  }));
  const academyItems = (academies.data ?? []).slice(0, 12).map(academy => ({
    id: academy.id, title: academy.name, image: academy.cover_url,
    subtitle: [academy.area, academy.governorate, academy.country].filter(Boolean).join(" · ") || academy.description || (ar ? "اكتشف الأكاديمية" : "Explore this academy"),
    href: academy.slug ? `/a/${encodeURIComponent(academy.slug)}` : "/academies",
  }));

  return <div className="min-w-0 space-y-7">
    <DiscoveryCarousel title={ar ? "مباريات حالية وقادمة" : "Active & upcoming games"} href="/dashboard/games" icon={Volleyball} items={gameItems} query={games} empty={ar ? "مفيش مباريات متاحة حالياً. تابعنا قريب." : "No active games right now. Check back soon."} />
    <DiscoveryCarousel title={t("nav_tournaments")} href="/dashboard/tournaments" icon={Trophy} items={tournamentItems} query={tournaments} empty={ar ? "مفيش بطولات حالية أو قادمة." : "No active or upcoming tournaments right now."} />
    <DiscoveryCarousel title={t("nav_playgrounds")} href="/playgrounds" icon={LandPlot} items={playgroundItems} query={playgrounds} empty={ar ? "مفيش ملاعب متاحة حالياً." : "No playgrounds available yet."} />
    <DiscoveryCarousel title={t("nav_academies")} href="/academies" icon={Building2} items={academyItems} query={academies} empty={ar ? "مفيش أكاديميات متاحة حالياً." : "No academies available yet."} />
  </div>;
}
