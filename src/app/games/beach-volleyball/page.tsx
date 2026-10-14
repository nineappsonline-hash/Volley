import type { Metadata } from "next";
import { BeachVolleyballPage } from "@/components/game/beach-volleyball-page";
import { OG_IMAGE, SITE_URL, jsonLdStringify } from "@/lib/seo";

const CANONICAL = `${SITE_URL}/games/beach-volleyball`;
const TITLE = "Playza Beach Challenge — Free 90-Second Beach Volleyball Game";
const DESCRIPTION =
  "Play Playza Beach Challenge: a free 90-second arcade beach volleyball game you can play in your browser on mobile or desktop. Beat the computer, score Perfect Hits and share your result.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "beach volleyball game",
    "play volleyball online",
    "arcade volleyball game",
    "free browser game",
    "لعبة كرة طائرة",
    "الكرة الطائرة الشاطئية",
    "لعبة أونلاين مجانية",
  ],
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function BeachVolleyballRoute() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Playza Beach Challenge",
    url: CANONICAL,
    description: DESCRIPTION,
    genre: ["Sports", "Arcade"],
    gamePlatform: ["Web browser", "Mobile browser"],
    playMode: "SinglePlayer",
    applicationCategory: "Game",
    operatingSystem: "Any",
    inLanguage: ["en", "ar"],
    publisher: { "@type": "Organization", name: "Playza", url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify(jsonLd) }}
      />
      <BeachVolleyballPage />
    </>
  );
}
