/**
 * Central SEO helpers: canonical site URL, bilingual metadata builders and
 * JSON-LD structured-data generators used across public pages.
 *
 * The site is bilingual (default English), so every public page exposes an
 * English-primary title + description with the Arabic variants as
 * alternateLocale. Structured data follows schema.org so Google, Bing and
 * WhatsApp/Telegram link previews can render rich results.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://playza.nineapps.online";

export const OG_IMAGE = "/og-playza-players.png";

/** Brand name in both languages. */
export const BRAND = { en: "Playza", ar: "بلايزا Playza" } as const;

/** Market focus for geo-intent keywords. */
export const MARKETS = ["مصر", "السعودية", "الإمارات", "قطر"] as const;

type JsonLd = Record<string, unknown>;

/** Serialize JSON-LD safely (escapes `<` to block script injection). */
export function jsonLdStringify(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Organization node — used sitewide so Google connects the brand entity. */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Playza",
    alternateName: ["بلايزا", "Playza Egypt"],
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    image: `${SITE_URL}${OG_IMAGE}`,
    description:
      "Playza helps people play sports in Egypt: discover padel, volleyball and football games, explore playgrounds and join other players.",
    areaServed: [
      { "@type": "Country", name: "Egypt" },
      { "@type": "Country", name: "Saudi Arabia" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    knowsLanguage: ["ar", "en"],
  };
}

/** WebSite node with SearchAction (sitelinks search box in Google). */
export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Playza",
    alternateName: "بلايزا",
url: SITE_URL,
    inLanguage: ["en", "ar-EG"],
  };
}

/** SoftwareApplication node for the home page. */
export function softwareAppJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Playza",
    alternateName: "بلايزا",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    image: `${SITE_URL}${OG_IMAGE}`,
    description:
      "Find your next game in Egypt with Playza. Explore padel, volleyball and football games, check venues and participation costs, and play with others.",
    inLanguage: ["en", "ar-EG"],
    featureList: [
      "Member and subscription management",
      "QR check-in attendance",
      "Training schedules and court booking",
      "Payment and receipt tracking",
      "Automatic per-session profit & loss",
      "Financial reports and analytics",
      "Full Arabic and English support",
    ],
    offers: {
      "@type": "Offer",
      priceCurrency: "EGP",
      price: "500",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
    },
  };
}

/** Build the landing-page FAQ nodes from the i18n dictionary. */
export function landingFaqItems(faq: [string, string][]): JsonLd[] {
  return faq.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
}

/** FAQPage node — enables the FAQ rich result. */
export function faqPageJsonLd(questions: JsonLd[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions,
  };
}

/**
 * SportsClub node for a public academy page (/a/<slug>).
 * Covers "أكاديمية كرة قدم في القاهرة" style local queries.
 */
export function sportsClubJsonLd(academy: {
  name: string;
  description?: string | null;
  country?: string | null;
  governorate?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  slug: string;
  sports: string[];
  ratingValue?: number;
  ratingCount?: number;
}): JsonLd {
  const address: JsonLd = {
    "@type": "PostalAddress",
    addressCountry: academy.country || "Egypt",
  };
  if (academy.governorate) address.addressRegion = academy.governorate;
  if (academy.area) address.addressLocality = academy.area;

  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: academy.name,
    url: `${SITE_URL}/a/${academy.slug}`,
    sport: academy.sports.length ? academy.sports : undefined,
    address,
  };
  if (academy.description) node.description = academy.description;
  if (academy.lat != null && academy.lng != null) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: academy.lat,
      longitude: academy.lng,
    };
  }
  if (academy.ratingCount && academy.ratingCount > 0 && academy.ratingValue) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: academy.ratingValue.toFixed(1),
      ratingCount: academy.ratingCount,
      bestRating: "5",
      worstRating: "1",
    };
  }
  return node;
}

/** BreadcrumbList node — shown as breadcrumb rich result. */
export function breadcrumbsJsonLd(
  items: { name: string; url: string }[]
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
