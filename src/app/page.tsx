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
  title: "Volleyball Courts & Academies in Egypt | Padel & Tennis",
  description:
    "Find volleyball playgrounds, academies and games in Egypt with Playza. Explore padel and tennis too. اكتشف ملاعب وأكاديميات الكرة الطائرة في مصر، وكمان البادل والتنس.",
  keywords: [
    "volleyball courts Egypt", "volleyball playgrounds Cairo", "volleyball academy",
    "volleyball games Egypt", "padel courts", "tennis academies Egypt",
    "ملاعب كرة طائرة", "أكاديميات كرة طائرة في مصر", "مباريات كرة طائرة",
    "ملاعب بادل", "أكاديميات تنس", "ملاعب في القاهرة",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Playza — ملاعب وأكاديميات كرة طائرة، بادل وتنس",
    description:
      "لاقي ملعب كرة طائرة واكتشف أكاديمية في مصر. العب مع ناس شبهك، واكتشف البادل والتنس كمان.",
    url: SITE_URL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playza — ملاعب وأكاديميات كرة طائرة، بادل وتنس",
    description:
      "اختار لعبتك وانزل العب. اكتشف مباريات وملاعب في مصر، وتابع تفاصيل مشاركتك مع Playza.",
    images: [OG_IMAGE],
  },
};

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareAppJsonLd(),
    breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <LandingPage />
    </>
  );
}
