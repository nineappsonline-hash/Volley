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

export const revalidate = 300; // refresh listing every 5 minutes

type SP = Promise<{ sport?: string; join?: string }>;

const GAME_OG_IMAGE = (code: string) => `${SITE_URL}/og/game?code=${encodeURIComponent(code)}&v=3`;

function gameMeta(game: Awaited<ReturnType<typeof getGameByInviteCode>>) {
  if (!game) return null;
  const shareText = gameSharePrice(game);
  const where = [game.map_label, game.governorate, game.area].filter(Boolean).join(", ");
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
        alternates: { canonical: joinUrl },
        robots: { index: true, follow: true },
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

  const title = sport
    ? `Upcoming ${sport} Friendly Games in Egypt`
    : "Friendly & Casual Games in Egypt — Football, Volleyball, Basketball, Padel";
  const description = sport
    ? `Browse upcoming ${sport} friendly games in Egypt: dates, location, player count and share price. Jump into a game near you with Playza.`
    : "Find a friendly game near you: football, volleyball, basketball, padel and swimming. Dates, location, player count and share price are clear from the start. Sign up free and join the nearest game.";

  return {
    title,
    description,
    keywords: sport
      ? [`${sport} friendly games`, "friendly matches", "casual games"]
      : [
          "friendly games Egypt",
          "friendly football matches",
          "casual games",
          "football games near me",
          "volleyball games",
          "padel matches Egypt",
          "basketball games",
          "playground near me",
          "ماتشات ودية",
          "حجز ماتش كرة قدم",
          "جيمز ودية",
          "لعب كرة قدم",
          "ماتشات بادل مصر",
        ],
    alternates: { canonical: sport ? `/games?sport=${sportToSlug(sport)}` : "/games" },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/games`,
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
  const { sport: sportParam, join } = await searchParams;
  if (join) return <SharedGamePage game={await getGameByInviteCode(join)} inviteCode={join} />;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

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
      landingFaqItems([
        [
          "How do I find a friendly game near me?",
          "Open the games page on Playza, choose your sport and area, and browse upcoming games with dates, location and share price. Sign up free and join the game that suits you.",
        ],
        [
          "Do I need to be in an academy to play?",
          "No. Games on Playza are open to everyone — create a free account, pick a game near you and book your spot. Some games have age or skill requirements, which are stated on the game page.",
        ],
        [
          "How much is the share per player?",
          "Each game shows the players' share of the court rental based on the hourly rate, duration and minimum players. The price is shown before you join and won't change after you sign up.",
        ],
      ])
    ),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Upcoming friendly games in Egypt",
      numberOfItems: games.length,
      itemListElement: games.slice(0, 20).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/games`,
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
        title={sport ? `Upcoming ${sport} Friendly Games` : "Friendly & Casual Games in Egypt"}
        subtitle="The players are out there — you just need to gather. Pick a game near you, with dates, location and price clear from the start."
        note="Sign up free and join any open game. Some games have age or skill requirements — shown before you join."
        ctaLabel="Sign up free and get playing"
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SportFilterLinks
          sports={sports}
          to={(s) => (s ? `/games?sport=${sportToSlug(s)}` : "/games")}
          current={sport}
          allLabel="All sports"
        />

        {games.length === 0 ? (
          <EmptyState sport={sport} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {games.map((g) => {
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
                  className="flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{g.title}</h2>
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
                    <PublicGameJoin game={g} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

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
