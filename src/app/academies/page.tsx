import { AcademiesPremiumDirectory } from "@/components/academies/academies-premium-directory";
import type { Metadata } from "next";
import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { ACADEMY_GUIDES, guidePath } from "@/lib/guides";
import { getSession } from "@/lib/session";
import { getPublicTeams } from "@/lib/public-sport-academies";
import { AcademyTeamsSection } from "@/components/academies/academy-teams-section";
import {
  SITE_URL,
  OG_IMAGE,
  breadcrumbsJsonLd,
  jsonLdStringify,
} from "@/lib/seo";
import { Topbar } from "@/components/layout/topbar";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { PlayzaFooter } from "@/components/shared/playza-footer";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export const metadata: Metadata = {
  // The root layout template appends the Playza brand once.
  title: "Find Sports Teams & Academies in Egypt",
  description: "Find sports teams and academies in Egypt. Explore volleyball, basketball, tennis and padel training by sport, age and location on Playza.",
  keywords: [
    "sports teams egypt", "sports academies egypt", "volleyball teams cairo", "basketball teams cairo", "tennis academy cairo",
    "padel academy cairo", "sports training for kids and adults",
    "فرق رياضية مصر", "أكاديميات رياضية مصر", "فرق كرة طائرة", "فرق كرة سلة للأطفال"
  ],
  alternates: { canonical: "/academies" },
  openGraph: {
    title: "Find Sports Teams & Academies in Egypt | Playza",
    description: "Discover sports teams and academies in Egypt for kids and adults. Find training near you by sport, gender, age, and location.",
    url: `${SITE_URL}/academies`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Find Sports Teams & Academies in Egypt | Playza", description: "Discover sports teams and academies in Egypt for kids and adults.", images: [OG_IMAGE] },
};

export default async function AcademiesPage() {
  // Public team discovery and session lookup are independent network requests.
  // Running them together avoids adding their wait times on public visits.
  const [teams, session] = await Promise.all([getPublicTeams(), getSession()]);
  const t = dictionary.ar;

  const topbar = session ? (
    <Topbar
      role={session.profile.role}
      name={session.profile.name}
      username={session.profile.username}
      avatarUrl={session.profile.avatar_url}
      avatarId={session.profile.avatar_id}
      memberPlan={session.profile.member_plan}
      isCoach={false}
      hasAcademyWorkspace={false}
    />
  ) : (
    <Topbar role="member" name="" username="" guest />
  );

  const publicAcademies = [
    ...new Map(
      teams.map((team) => [team.academy.slug, team.academy])
    ).values(),
  ];
  const title = "Sports Teams & Academies in Egypt";
  const jsonLd = [
    {
      "@type": "CollectionPage",
      name: title,
      description:
        "Discover sports teams and academies in Egypt for kids and adults, filtered by sport, gender, age and location.",
      url: `${SITE_URL}/academies`,
      inLanguage: "en",
    },
    breadcrumbsJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Academies", url: `${SITE_URL}/academies` },
    ]),
    {
      "@type": "ItemList",
      name: "Public sports academies in Egypt",
      numberOfItems: publicAcademies.length,
      itemListElement: publicAcademies.map((academy, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: academy.name,
        url: `${SITE_URL}/a/${encodeURIComponent(academy.slug)}`,
      })),
    },
  ];

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": jsonLd }) }} />
    {topbar}
    <AcademiesPremiumDirectory teams={teams} />
    <PlayzaFooter />
    <MemberBottomNavigation guest={!session} />
  </>;
}
