import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "./seo";
import { findDiscoverySport, type DiscoveryLanguage } from "./sport-discovery";

export const courtsPath = (lang: DiscoveryLanguage, sport?: string) => `${lang === "ar" ? "/ar" : ""}/courts${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`;
export function courtDirectoryMetadata(lang: DiscoveryLanguage, slug?: string): Metadata {
  const sport = slug ? findDiscoverySport(slug) : undefined;
  const ar = lang === "ar";
  const title = sport ? ar ? `ملاعب ${sport.arabic} في مصر | مناطق وأسعار وحجز` : `${sport.name} Courts in Egypt | Locations & Booking` : ar ? "ملاعب رياضية في مصر | قارن المناطق والأسعار" : "Sports Courts in Egypt | Locations, Prices & Booking";
  const description = ar ? `دور على ملاعب ${sport?.arabic ?? "رياضية"} في مصر. قارن الملاعب المنشورة حسب المنطقة والعنوان وتكلفة الحجز، وشوف تفاصيل الملعب والمواعيد على بلايزا.` : `Find published ${sport?.name.toLowerCase() ?? "sports"} courts in Egypt. Compare real courts by area, address and listed rental price, then check venue details and booking hours on Playza.`;
  const canonical = courtsPath(lang, sport?.slug);
  return { title, description,
    alternates: { canonical, languages: { en: courtsPath("en", sport?.slug), "ar-EG": courtsPath("ar", sport?.slug), "x-default": courtsPath("en", sport?.slug) } },
    openGraph: { title, description, url: `${SITE_URL}${canonical}`, type: "website", locale: ar ? "ar_EG" : "en_US", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
