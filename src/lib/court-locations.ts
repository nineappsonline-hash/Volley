import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "./seo";
import { findDiscoverySport, type DiscoveryLanguage } from "./sport-discovery";
import type { PublicCourt } from "./public-playgrounds";

/**
 * Location-based court landing pages (`/courts/<sport>/<location>`).
 *
 * These pages are demand-driven: a page only becomes indexable when real,
 * approved courts exist for that sport in that location. The canonical URL,
 * sitemap inclusion and robots directive all follow {@link locationHasInventory}
 * so we never create doorway pages for empty sport/location combinations.
 */

type LocationCopy = { slug: string; en: string; ar: string; aliases: string[] };

/**
 * Recognised Egypt locations. `aliases` covers common English/Arabic spellings
 * and the informal names players actually search with (e.g. Tagamoa).
 * Locations discovered in the database but missing here still get a page via
 * the generic slug fallback, so real inventory is never hidden.
 */
export const COURT_LOCATIONS: LocationCopy[] = [
  { slug: "new-cairo", en: "New Cairo", ar: "القاهرة الجديدة", aliases: ["new cairo", "tagamoa", "el tagamoa", "tagamo3", "fifth settlement", "التجمع", "التجمع الخامس", "التجمع الأول", "التجمع الاول", "القاهرة الجديدة"] },
  { slug: "nasr-city", en: "Nasr City", ar: "مدينة نصر", aliases: ["nasr city", "مدينة نصر", "nasr"] },
  { slug: "heliopolis", en: "Heliopolis", ar: "مصر الجديدة", aliases: ["heliopolis", "مصر الجديدة", "masr el gedida"] },
  { slug: "maadi", en: "Maadi", ar: "المعادي", aliases: ["maadi", "المعادي", "el maadi"] },
  { slug: "6th-of-october", en: "6th of October", ar: "6 أكتوبر", aliases: ["6th of october", "6 october", "october city", "6 أكتوبر", "السادس من أكتوبر", "مدينة 6 أكتوبر"] },
  { slug: "sheikh-zayed", en: "Sheikh Zayed", ar: "الشيخ زايد", aliases: ["sheikh zayed", "shiekh zayed", "الشيخ زايد", "الشيخ زايد"] },
  { slug: "mohandessin", en: "Mohandessin", ar: "المهندسين", aliases: ["mohandessin", "mohandseen", "المهندسين"] },
  { slug: "dokki", en: "Dokki", ar: "الدقي", aliases: ["dokki", "dokki", "الدقي"] },
  { slug: "el-shorouk", en: "El Shorouk", ar: "الشروق", aliases: ["el shorouk", "shorouk", "الشروق", "مدينة الشروق"] },
  { slug: "el-obour", en: "El Obour", ar: "العبور", aliases: ["el obour", "obour", "العبور", "مدينة العبور"] },
  { slug: "alexandria", en: "Alexandria", ar: "الإسكندرية", aliases: ["alexandria", "alex", "الإسكندرية", "اسكندرية", "الاسكندرية"] },
];

/** Slugify an arbitrary stored area value so unknown real locations still rank. */
export function slugifyLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, "") // drop Arabic script for the latin slug
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalise a stored area/governorate to a canonical location slug. */
export function locationSlugFor(area?: string | null): string {
  const raw = (area ?? "").trim().toLowerCase();
  if (!raw) return "";
  for (const loc of COURT_LOCATIONS) {
    if (loc.slug === raw || loc.aliases.includes(raw)) return loc.slug;
  }
  // Arabic-only areas still need a stable slug; fall back to the slugified
  // governorate/area, which is deterministic for a given stored value.
  return slugifyLocation(area ?? "");
}

export const findCourtLocation = (slug: string): LocationCopy | undefined =>
  COURT_LOCATIONS.find((loc) => loc.slug === slug);

export const courtsLocationPath = (lang: DiscoveryLanguage, sport: string, location: string) =>
  `${lang === "ar" ? "/ar" : ""}/courts/${sport}/${location}`;

/** Display the location name bilingually, falling back to a de-slugged value. */
export function locationLabel(lang: DiscoveryLanguage, slug: string): string {
  const known = findCourtLocation(slug);
  if (known) return known[lang];
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Approved courts matching a sport + location combination. */
export function courtsForLocation(courts: PublicCourt[], sportName: string, locationSlug: string): PublicCourt[] {
  return courts.filter(
    (court) =>
      court.sport?.name.toLowerCase() === sportName.toLowerCase() &&
      locationSlugFor(court.area) === locationSlug,
  );
}

/** Distinct location slugs that actually have inventory for a given sport. */
export function locationSlugsWithInventory(courts: PublicCourt[], sportName: string): string[] {
  const sports = courts.filter((court) => court.sport?.name.toLowerCase() === sportName.toLowerCase());
  return [...new Set(sports.map((court) => locationSlugFor(court.area)).filter(Boolean))].sort();
}

export function courtLocationMetadata(
  lang: DiscoveryLanguage,
  sportSlug: string,
  locationSlug: string,
): Metadata {
  const sport = findDiscoverySport(sportSlug);
  const ar = lang === "ar";
  const sportName = sport ? (ar ? sport.arabic : sport.name) : sportSlug;
  const sportNameEn = sport?.name ?? sportSlug;
  const place = locationLabel(lang, locationSlug);
  const title = ar
    ? `ملاعب ${sportName} في ${place} — احجز ملعبك`
    : `${sportNameEn} Courts in ${place} — Prices & Booking`;
  const description = ar
    ? `اكتشف ملاعب ${sportName} في ${place} على بلايزا. قارن العناوين والأسعار المعلنة للملعب بالكامل، وافتح صفحة الملعب لمراجعة تفاصيل الحجز.`
    : `Find ${sportNameEn.toLowerCase()} courts in ${place} on Playza. Compare addresses and listed full-court prices, then open a court for booking details.`;
  const canonical = courtsLocationPath(lang, sportSlug, locationSlug);
  return {
    title,
    description,
    keywords: ar
      ? [`ملاعب ${sportName}`, `ملاعب ${sportName} ${place}`, `حجز ملعب ${sportName} ${place}`]
      : [`${sportNameEn} courts ${place}`, `${sportNameEn} court booking ${place}`, `${sportNameEn} near me ${place}`],
    alternates: {
      canonical,
      languages: {
        en: courtsLocationPath("en", sportSlug, locationSlug),
        "ar-EG": courtsLocationPath("ar", sportSlug, locationSlug),
        "x-default": courtsLocationPath("en", sportSlug, locationSlug),
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "website",
      siteName: "Playza",
      locale: ar ? "ar_EG" : "en_US",
      alternateLocale: [ar ? "en_US" : "ar_EG"],
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
