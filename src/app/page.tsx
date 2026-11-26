import { LANDING_TITLE, LANDING_DESCRIPTION, LANDING_KEYWORDS, landingPageJsonLd } from "@/lib/landing-content";
import { getPublicGames } from "@/lib/public-games";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  jsonLdStringify,
  organizationJsonLd,
  softwareAppJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: LANDING_TITLE },
  description: LANDING_DESCRIPTION,
  keywords: LANDING_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    url: SITE_URL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default async function HomePage() {
  // The server auth client reads Supabase's session only from its cookies.
  // An anonymous visitor without an auth-token cookie cannot have a server
  // session; avoid a redundant Auth API request on every public landing hit.
  // A present cookie is NEVER trusted as authentication: Supabase getUser()
  // still validates it before any dashboard redirect.
  const hasSessionCookie = cookies().getAll().some(({ name }) =>
    /^sb-[a-z0-9_-]+-auth-token(?:\\.\\d+)?$/i.test(name)
  );
  const [user, publicGames] = await Promise.all([
    hasSessionCookie
      ? createClient().auth.getUser().then(({ data }) => data.user)
      : Promise.resolve(null),
    getPublicGames(),
  ]);

  if (user) redirect("/dashboard");

  // One bounded, ordered query also covers pages with fewer than three joinable
  // games. Avoid a second sequential Supabase round trip in the common case
  // where most of the next 20 games are full or already started.
  const upcomingGames = publicGames.slice(0, 3);

  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    landingPageJsonLd(SITE_URL),
    softwareAppJsonLd(),
    breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <LandingPage upcomingGames={upcomingGames} />
    </>
  );
}
