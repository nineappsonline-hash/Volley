import { LANDING_TITLE, LANDING_DESCRIPTION, LANDING_KEYWORDS, landingPageJsonLd } from "@/lib/landing-content";
import { getPublicGames } from "@/lib/public-games";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuestDashboard } from "@/components/dashboard/guest-dashboard";
import { guestGameCard } from "@/lib/guest-games";
import { Topbar } from "@/components/layout/topbar";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
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
  // Render the exact guest dashboard as our indexable homepage.
  // Authenticated players continue to their personalized dashboard. A cookie
  // only triggers a verified getUser() check; it is never treated as proof.
  const hasSessionCookie = cookies().getAll().some(({ name }) =>
    /^sb-[a-z0-9_-]+-auth-token(?:\.\d+)?$/i.test(name)
  );
  const [user, publicGames] = await Promise.all([
    hasSessionCookie
      ? createClient().auth.getUser().then(({ data }) => data.user)
      : Promise.resolve(null),
    getPublicGames(),
  ]);

  if (user) redirect("/dashboard");


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
      <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Topbar role="member" name="" username="" guest />
        <div className="mx-auto w-full max-w-[1600px] p-4 pb-0 sm:p-6 sm:pb-0 lg:p-8 lg:pb-0">
          <GuestDashboard games={publicGames.map(guestGameCard)} />
        </div>
        <MemberBottomNavigation guest />
      </div>
    </>
  );
}
