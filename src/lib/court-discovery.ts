import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "./seo";
import { findDiscoverySport, type DiscoveryLanguage } from "./sport-discovery";

export const courtsPath = (lang: DiscoveryLanguage, sport?: string) => `${lang === "ar" ? "/ar" : ""}/courts${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`;
export function courtDirectoryMetadata(lang: DiscoveryLanguage, slug?: string): Metadata {
  const sport = slug ? findDiscoverySport(slug) : undefined;
  const ar = lang === "ar";
  const title = sport ? ar ? `ملاعب ${sport.arabic} في مصر` : `${sport.name} Courts in Egypt` : ar ? "اكتشف الملاعب الرياضية في مصر" : "Sports Courts in Egypt — Locations & Published Prices";
  const description = ar ? `اكتشف ملاعب ${sport?.arabic ?? "الرياضة"} في مصر على Playza. قارن المنطقة والعنوان والأسعار المعلنة، وافتح صفحة الملعب لمراجعة تفاصيل الحجز.` : `Discover ${sport?.name.toLowerCase() ?? "sports"} courts in Egypt on Playza. Compare locations, addresses and listed rental prices, then open a court for booking details.`;
  const canonical = courtsPath(lang, sport?.slug);
  return { title, description,
    alternates: { canonical, languages: { en: courtsPath("en", sport?.slug), "ar-EG": courtsPath("ar", sport?.slug), "x-default": courtsPath("en", sport?.slug) } },
    openGraph: { title, description, url: `${SITE_URL}${canonical}`, type: "website", locale: ar ? "ar_EG" : "en_US", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
