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

  const [games, sports] = await Promise.all([
    getPublicGames(sport),
    getPublicGameSports(),
  ]);

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
      name: "Upcoming friendly games in Egypt",
      numberOfItems: games.length,
      itemListElement: games.slice(0, 20).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${publicGamePath(g.id)}`,
        name: g.title,
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />

      <PublicListHero
        emoji="🎮"
        title={sport ? `Find ${sport} Players & Games` : "Find Volleyball & Basketball Games"}
        subtitle="Looking for a volleyball or basketball game in Egypt? Join upcoming friendly matches, or explore padel, tennis and beach volleyball. See who’s playing and join."
        note="Sign up free and join any open game. No team needed for most games."
        ctaHref={`/signup?redirectedFrom=${encodeURIComponent(sport ? `/games?sport=${sportToSlug(sport)}` : "/games")}`}
        ctaLabel="Find a Game"
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        {focus && !games.some(g => g.id === focus) && <p role="status" className="mx-auto max-w-6xl rounded-lg border bg-card p-4 text-muted-foreground">The selected game is no longer in the upcoming public list. Review available games below; your account has not reserved a place.</p>}
      <SportFilterLinks
          sports={[...new Set([...ACTIVE_SPORTS, ...sports])]}
          to={(s) => (s ? `/games?sport=${sportToSlug(s)}` : "/games")}
          current={sport}
          allLabel="All sports"
        />

        {games.length === 0 ? (
          <EmptyState sport={sport} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...games].sort((a, b) => Number(b.id === focus) - Number(a.id === focus)).map((g) => {
              const place = [
                g.playground?.name,
                g.playground?.area ?? g.area,
                g.playground?.governorate,
              ]
                .filter(Boolean)
                .join(", ");
              const full = g.joined >= g.max_players;
              return (
                <article
                  key={g.id}
                  id={`game-${g.id}`}
                  className="flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold"><Link href={publicGamePath(g.id)} className="hover:underline underline-offset-4">{g.title}</Link></h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.sport}
                        {g.skill_level ? ` · ${SKILL_EN[g.skill_level] ?? g.skill_level}` : ""}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                        full ? "bg-muted text-muted-foreground" : "bg-success-ink/10 text-success-ink"
                      }`}
                    >
                      {full ? "Full" : `${g.max_players - g.joined} spots left`}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">Date</dt>
                      <dd>{fmtDate(g.game_date)}</dd>
                      <Clock className="ms-2 h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">Time</dt>
                      <dd>{fmtTime(g.start_time)}</dd>
                    </div>
                    {place && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">Location</dt>
                        <dd>{place}</dd>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">Players</dt>
                      <dd>
                        {g.joined}/{g.max_players} players
                        {g.gender !== "mixed" ? ` · ${GENDER_EN[g.gender] ?? ""}` : ` · ${GENDER_EN.mixed}`}
                      </dd>
                    </div>
                    {g.share_price != null && (
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">Share</dt>
                        <dd className="font-semibold text-foreground">
                          EGP {g.share_price} share
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-4"><SignedInGameParticipantNames gameId={g.id} /></div>
                  <div className="mt-auto pt-4">
                    <Link href={publicGamePath(g.id)} className="mb-3 inline-block text-sm font-semibold underline underline-offset-4">View full game details</Link>
                    <PlayerJoiningGuide skillLevel={g.skill_level} />
                    <PublicGameJoin game={g} returnTo={publicGamePath(g.id)} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <nav aria-label="Games in New Cairo" className="mt-10 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Find players and games in New Cairo · دور على ماتشات في التجمع</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explore upcoming games and real previous matches by sport and area.</p>
          <div className="mt-4 flex flex-wrap gap-3">{LOCAL_GAME_GUIDES.map(guide => <div key={guide.slug} className="flex flex-wrap gap-2">
            <Link href={localGamePath("en", guide.slug)} className="rounded-lg border px-3 py-2 font-semibold underline underline-offset-4">{guide.en.title}</Link>
            <Link href={localGamePath("ar", guide.slug)} lang="ar" dir="rtl" className="rounded-lg border px-3 py-2 font-semibold underline underline-offset-4">{guide.ar.title}</Link>
          </div>)}</div>
        </nav>

        {sport && playerGuidesForSport(sportToSlug(sport)).length > 0 && (
          <nav aria-label={`${sport} guides`} className="mt-6 flex flex-wrap gap-4">
            {playerGuidesForSport(sportToSlug(sport)).map(guide => (
              <Link key={guide.slug} href={guidePath("en", guide.slug)} className="text-brand font-semibold underline underline-offset-4">{guide.en.title}</Link>
            ))}
          </nav>
        )}

        <section aria-labelledby="joining-questions" className="mt-12 rounded-xl border bg-card p-6">
          <h2 id="joining-questions" className="text-xl font-bold">Joining a game: common questions</h2>
          <dl className="mt-6 space-y-6">
            {GAME_FAQ.map(([question, answer]) => <div key={question}>
              <dt className="font-semibold">{question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
            </div>)}
          </dl>
        </section>

        {/* Cross-links keep crawlers (and users) moving between listings. */}
        <nav className="mt-12 border-t pt-6 text-center text-sm">
          <p className="mb-3 font-semibold text-muted-foreground">Keep exploring</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/academies" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              Sports academies
            </Link>
            <Link href="/tournaments" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              Tournaments
            </Link>
            <Link href="/solutions" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              Academy solutions
            </Link>
            <Link href="/faq" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              FAQ
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
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
    </div>
  );
}
