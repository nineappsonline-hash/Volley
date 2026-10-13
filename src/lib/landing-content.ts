/** Public copy shared by visible content and homepage search metadata. */
export const LANDING_TITLE = "Volleyball & Beach Volleyball in Egypt | Playza";
export const LANDING_DESCRIPTION = "Discover volleyball and beach volleyball in Egypt. Explore sand-court games, courts and academies with Playza, plus padel and tennis.";
export const BEACH_DESCRIPTION = {
  en: "Discover beach volleyball in Egypt with Playza. Explore sand-court games, find people to play with, and discover academies that match your next move.",
  ar: "اكتشف الكرة الطائرة الشاطئية في مصر مع بلايزا. دور على مباريات على الملاعب الرملية، واتعرّف على لاعبين، واكتشف أكاديميات تناسب خطوتك الجاية.",
} as const;

/** Describes visible landing content without inventing local events or inventory. */
export function landingPageJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/#webpage`,
    url: siteUrl,
    name: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    inLanguage: ["en", "ar-EG"],
    about: [
      { "@type": "Thing", name: "Volleyball" },
      { "@type": "Thing", name: "Beach Volleyball", alternateName: "الكرة الطائرة الشاطئية" },
      { "@type": "Thing", name: "Padel" },
      { "@type": "Thing", name: "Tennis" },
    ],
    hasPart: {
      "@type": "WebPageElement",
      "@id": `${siteUrl}/#beach-volleyball`,
      name: "Beach volleyball. Same rally. New rhythm.",
      description: BEACH_DESCRIPTION.en,
      url: `${siteUrl}/#beach-volleyball`,
    },
  };
}
