import { LANDING_TITLE, LANDING_DESCRIPTION, LANDING_KEYWORDS, landingPageJsonLd } from "@/lib/landing-content";
import { getPublicGames } from "@/lib/public-games";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const upcomingGames = (await getPublicGames()).slice(0, 3);

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
