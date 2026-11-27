import { DirectoryExperience } from "@/components/public/directory-experience";
import { ACTIVE_SPORTS, isActiveSport } from "@/lib/active-sports";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { PublicListHero, SportFilterLinks } from "@/components/public/public-listing-ui";
import { OrganizeTournamentButton } from "@/components/public/organize-tournament-button";
import {
  getPublicTournaments,
  getPublicTournamentSports,
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

export const revalidate = 300;

type SP = Promise<{ sport?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;
  if (sportParam && (!sport || !isActiveSport(sport))) notFound();

  const title = sport
    ? `${sport} Tournaments in Egypt — Dates & Registration`
    : "Sports Tournaments in Egypt — Tennis, Volleyball & Beach Volleyball";
  const description = sport
    ? `Upcoming ${sport} tournaments in Egypt from verified academies: dates, locations and registration links.`
    : "All upcoming tournaments in Egypt from Playza academies: tennis, volleyball, beach volleyball. Dates, locations and details — enter with your team or join an academy and start competing.";

  return {
    title,
    description,
    keywords: sport
      ? [`${sport} tournaments`, `${sport} tournament Egypt`, "tournament registration"]
      : [
          "tennis tournaments",
          "tennis tournaments Egypt",
          "corporate tournaments",
          "7x7 tournaments",
          "5x5 tournaments",
          "beach volleyball tournaments Egypt",
          "volleyball tournaments",
          "volleyball tournaments",
          "organize a tennis tournament",
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
  if (sportParam && (!sport || !isActiveSport(sport))) notFound();

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
          "Both. There are team volleyball tournaments and singles or doubles tennis events. Each tournament's details are listed on its page along with the entry rules.",
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

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }} />
    <DirectoryExperience kind="tournaments" tournaments={tournaments} selectedSport={sport} availableSports={[...new Set([...ACTIVE_SPORTS, ...sports])]} />
  </>;
}