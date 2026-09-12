import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { PublicListHero, SportFilterLinks } from "@/components/public/public-listing-ui";
import {
  getPublicTournaments,
  getPublicTournamentSports,
} from "@/lib/public-games";
import { slugToSport, sportToSlug } from "@/lib/sport-slugs";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
} from "@/lib/seo";

export const revalidate = 300;

type SP = Promise<{ sport?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  const title = sport
    ? `${sport} Tournaments in Egypt — Dates & Registration`
    : "Sports Tournaments in Egypt — Football, Padel, Volleyball & Basketball";
  const description = sport
    ? `Upcoming ${sport} tournaments in Egypt from verified academies: dates, locations and registration links.`
    : "All upcoming tournaments in Egypt from Playza academies: football, padel, volleyball, basketball. Dates, locations and details — enter with your team or join an academy and start competing.";

  return {
    title,
    description,
    keywords: sport
      ? [`${sport} tournaments`, `${sport} tournament Egypt`, "tournament registration"]
      : [
          "football tournaments",
          "football tournaments Egypt",
          "corporate tournaments",
          "7x7 tournaments",
          "5x5 tournaments",
          "padel tournaments Egypt",
          "volleyball tournaments",
          "basketball tournaments",
          "organize a football tournament",
          "tournament registration",
          "tournaments Egypt",
          "بطولات كرة قدم",
          "بطولات بادل مصر",
          "تسجيل بطولة",
        ],
    alternates: { canonical: sport ? `/tournaments?sport=${sportToSlug(sport)}` : "/tournaments" },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tournaments`,
      siteName: "Playza",
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
      locale: "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

const STATUS_EN: Record<string, { label: string; cls: string }> = {
  upcoming: { label: "Upcoming", cls: "bg-attention-100 text-warning-ink" },
  in_progress: { label: "In progress", cls: "bg-success-ink/10 text-success-ink" },
  completed: { label: "Completed", cls: "bg-muted text-muted-foreground" },
  canceled: { label: "Canceled", cls: "bg-muted text-muted-foreground" },
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
}

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  const [tournaments, sports] = await Promise.all([
    getPublicTournaments(sport),
    getPublicTournamentSports(),
  ]);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Tournaments", url: `${SITE_URL}/tournaments` },
    ]),
    faqPageJsonLd(
      landingFaqItems([
        [
          "How do I enter a tournament?",
          "Tournaments on Playza are run by verified academies. Open the tournament page, review the dates and rules, create a free account and join the organizing academy or contact them to participate.",
        ],
        [
          "Are these tournaments for teams or individual players?",
          "Both. There are team tournaments (5x5, 7x7 and 11-a-side) and individual ones like padel and tennis. Each tournament's details are listed on its page along with the entry rules.",
        ],
        [
          "Are you organizing your own tournament?",
          "Playza helps you run the tournament end to end: scheduling, teams, courts and results. Register your academy and start your first tournament.",
        ],
      ])
    ),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Sports tournaments in Egypt",
      numberOfItems: tournaments.length,
      itemListElement: tournaments.slice(0, 20).map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/tournaments`,
        name: t.name,
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
        emoji="🏆"
        title={sport ? `${sport} Tournaments in Egypt` : "Sports Tournaments in Egypt"}
        subtitle="Enter with your team or join as an individual player — tournaments from Playza academies across Egypt, with dates, locations and details clearly listed."
        note="Organizing a tournament? Register your academy on Playza and use the tournament tools free during your trial."
        ctaLabel="See tournaments and register"
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SportFilterLinks
          sports={sports}
          to={(s) => (s ? `/tournaments?sport=${sportToSlug(s)}` : "/tournaments")}
          current={sport}
          allLabel="All sports"
        />

        {tournaments.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-primary/40" />
            <p className="mt-4 font-semibold">
              {sport
                ? `No ${sport} tournaments listed right now`
                : "No tournaments listed right now"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Tournaments appear here as soon as academies publish them. Run an academy?
              Sign up and publish your first tournament.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tournaments.map((t) => {
              const place = [t.academy?.area, t.academy?.governorate]
                .filter(Boolean)
                .join(", ");
              const status = STATUS_EN[t.status] ?? STATUS_EN.completed;
              return (
                <article
                  key={t.id}
                  className="flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{t.name}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.sport ? t.sport : "Multi-sport"}
                        {t.academy?.name ? ` · ${t.academy.name}` : ""}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">Date</dt>
                      <dd>
                        {fmtDate(t.start_date)}
                        {t.end_date ? ` — ${fmtDate(t.end_date)}` : ""}
                      </dd>
                    </div>
                    {place && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">Location</dt>
                        <dd>{place}</dd>
                      </div>
                    )}
                  </dl>

                  {t.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}

                  {t.prize && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-amber-600">
                      <Trophy className="h-4 w-4 shrink-0" />
                      Prize: {t.prize}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <Link
                      href={t.academy?.slug ? `/a/${t.academy.slug}` : "/academies"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Trophy className="h-4 w-4" />
                      Details & registration
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <nav className="mt-12 border-t pt-6 text-center text-sm">
          <p className="mb-3 font-semibold text-muted-foreground">Keep exploring</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/games" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              Friendly games
            </Link>
            <Link href="/academies" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              Sports academies
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