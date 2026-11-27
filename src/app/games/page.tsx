import { GamesDiscoverPage } from "@/components/games/games-discover-page";
import { guestGameCard } from "@/lib/guest-games";
import { getSession } from "@/lib/session";
import { Topbar } from "@/components/layout/topbar";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { ACTIVE_SPORTS, isActiveSport } from "@/lib/active-sports";
import { notFound } from "next/navigation";
import { publicGamePath } from "@/lib/game-discovery";
import { LOCAL_GAME_GUIDES, localGamePath } from "@/lib/local-games";
import { guidePath, playerGuidesForSport } from "@/lib/guides";
import { PlayerJoiningGuide } from "@/components/games/player-joining-guide";
import { gameSharePrice } from "@/lib/game-share";
import { SignedInGameParticipantNames } from "@/components/games/game-participant-names";
import { SharedGamePage } from "@/components/games/shared-game-page";
import { PublicGameJoin } from "@/components/games/public-game-join";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Coins,
  MapPin,
  Users,
  Volleyball,
} from "lucide-react";
import { PublicListHero, SportFilterLinks } from "@/components/public/public-listing-ui";
import { Button } from "@/components/ui/button";
import {
  getGameByInviteCode,
  getPublicGameSports,
  getPublicGames,
} from "@/lib/public-games";
import { slugToSport, sportToSlug } from "@/lib/sport-slugs";
import { formatTime12h } from "@/lib/constants";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
} from "@/lib/seo";

const GAME_FAQ: [string, string][] = [
  ["How do I find a friendly game near me?", "Browse upcoming games on Playza and filter by sport. Check each game's date, venue, price and joining requirements, then create an account or sign in to join."],
  ["Can I join without a team or academy?", "You do not need an academy membership to join a public friendly game. Check the organizer's age, gender and skill requirements on the game before joining."],
  ["How much does it cost to play?", "The cost depends on the game. Review the per-player price and payment details before confirming. Some hosts cover the court cost; a free account does not mean every game is free."],
];

export const revalidate = 300; // refresh listing every 5 minutes

type SP = Promise<{ sport?: string; join?: string; focus?: string }>;

const GAME_OG_IMAGE = (code: string) => `${SITE_URL}/og/game?code=${encodeURIComponent(code)}&v=4`;

function gameMeta(game: Awaited<ReturnType<typeof getGameByInviteCode>>) {
  if (!game) return null;
  const shareText = gameSharePrice(game);
  const where = game.map_label;
  const title = `${game.title} · ${game.sport} game on Playza`;
  const description = [
    `${game.sport} game · ${fmtDate(game.game_date)}, ${fmtTime(game.start_time)}`,
    where,
    `${game.joined}/${game.max_players} players joined · ${shareText}`,
  ]
    .filter(Boolean)
    .join(" | ");
  return { title, description };
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const params = await searchParams;
  const { sport: sportParam, join } = params;

  // When the URL is a shared game link (?join=CODE), show that game's details
  // in the link preview instead of the generic listing card.
  if (join) {
    const game = await getGameByInviteCode(join);
    const meta = gameMeta(game);
    if (game && meta) {
      const joinUrl = `${SITE_URL}/games?join=${encodeURIComponent(join)}`;
      return {
        title: meta.title,
        description: meta.description,
        alternates: { canonical: game.is_public ? publicGamePath(game.id) : joinUrl },
        // Shared invite URLs are alternate views of a game; never index them as duplicate pages.
        // Public games use /games/[id] as the sole indexable canonical.
        robots: { index: false, follow: true },
        openGraph: {
          title: meta.title,
          description: meta.description,
          url: joinUrl,
          siteName: "Playza",
          images: [{ url: GAME_OG_IMAGE(join), secureUrl: GAME_OG_IMAGE(join), width: 1200, height: 630, type: "image/png", alt: meta.title }],
          locale: "en_US",
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title: meta.title,
          description: meta.description,
          images: [GAME_OG_IMAGE(join)],
        },
      };
    }
  }

  const sport = sportParam ? slugToSport(sportParam) : undefined;
  if (sportParam && (!sport || !isActiveSport(sport))) notFound();

  const title = sport
    ? `Find ${sport} Players & Games in Egypt`
    : "Volleyball & Basketball Games in Egypt";
  const description = sport
    ? `Find ${sport.toLowerCase()} players and games in Egypt. Join friendly ${sport.toLowerCase()} matches — no team needed. Check dates, locations, spots and price on Playza.`
    : "Browse upcoming volleyball and basketball games in Egypt. Compare dates, locations, spots left and price, then join other players on Playza.";
  const canonical = sport ? `/games?sport=${sportToSlug(sport)}` : "/games";

  return {
    title,
    description,
    keywords: sport
      ? [`find ${sport.toLowerCase()} players`, `${sport.toLowerCase()} games egypt`, "join sports games", "find sports partners"]
      : [
          "volleyball games egypt",
          "basketball games egypt",
          "volleyball games cairo",
          "basketball games cairo",
          "find volleyball players cairo",
          "find basketball players cairo",
          "join volleyball game egypt",
          "join basketball game egypt",
          "pickup basketball games cairo",
          "ماتشات كرة طائرة مصر",
          "ماتشات كرة سلة مصر",
          "ماتشات طائرة القاهرة",
          "ماتشات باسكت القاهرة",
        ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      siteName: "Playza",
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
      locale: "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

const SKILL_EN: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const GENDER_EN: Record<string, string> = {
  male: "Men's",
  female: "Women's",
  mixed: "Mixed",
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
}

function fmtTime(t: string): string {
  return formatTime12h(t);
}

export default async function GamesPage({ searchParams }: { searchParams: SP }) {
  const { sport: sportParam, join, focus } = await searchParams;
  if (join) return <SharedGamePage game={await getGameByInviteCode(join)} inviteCode={join} />;
  const sport = sportParam ? slugToSport(sportParam) : undefined;
  if (sportParam && (!sport || !isActiveSport(sport))) notFound();

  const [allGames, session] = await Promise.all([getPublicGames(), getSession()]);
  const games = sport ? allGames.filter(game => game.sport === sport) : allGames;
  const profile = session?.profile;

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Friendly Games", url: `${SITE_URL}/games` },
    ]),
    faqPageJsonLd(
      landingFaqItems(GAME_FAQ)
    ),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: sport ? `Upcoming ${sport} games in Egypt` : "Upcoming friendly games in Egypt",
      numberOfItems: games.length,
      itemListElement: games.slice(0, 20).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${publicGamePath(g.id)}`,
        name: g.title,
      })),
    },
  ];

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }} />
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      {profile ? <Topbar role={profile.role} name={profile.name} username={profile.username} avatarUrl={profile.avatar_url} avatarId={profile.avatar_id} memberPlan={profile.member_plan} /> : <Topbar role="member" name="" username="" guest />}
      <main className="mx-auto w-full max-w-[1600px] p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0">
        <GamesDiscoverPage games={allGames.map(guestGameCard)} selectedSport={sport ?? "all"} profile={profile?.role === "member" ? profile : undefined} />
      </main>
      <MemberBottomNavigation guest={!profile} />
    </div>
  </>;
}

function EmptyState({ sport }: { sport?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-10 text-center">
      <Volleyball className="mx-auto h-10 w-10 text-primary/40" />
      <p className="mt-4 font-semibold">
        {sport ? `No open ${sport} games right now` : "No open games right now"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Games appear here as soon as players publish them. Be the first to post a game in
        your area — sign up and start.
      </p>
      {sport && <nav className="mt-5 flex flex-wrap justify-center gap-3" aria-label={`Other ways to find ${sport} activities`}>
        <Link href={`/sports/${sportToSlug(sport)}`} className="rounded-lg border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-accent">Explore {sport} activities and past games</Link>
        <Link href={`/courts?sport=${sportToSlug(sport)}`} className="rounded-lg border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-accent">Find {sport} courts</Link>
      </nav>}
    </div>
  );
}
