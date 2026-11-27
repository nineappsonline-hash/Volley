import { DirectoryExperience } from "@/components/public/directory-experience";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, LandPlot, ArrowUpRight } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { courtsPath, courtDirectoryMetadata } from "@/lib/court-discovery";
import { findDiscoverySport, discoveryPath, type DiscoveryLanguage } from "@/lib/sport-discovery";
import { sportToSlug } from "@/lib/sport-slugs";
import { formatMoney } from "@/lib/constants";
import { SITE_URL, jsonLdStringify, breadcrumbsJsonLd } from "@/lib/seo";
import { courtsLocationPath, locationLabel, locationSlugsWithInventory } from "@/lib/court-locations";
import { listYourCourtPath } from "@/lib/list-your-court";

export async function CourtDirectory({ lang, slug }: { lang: DiscoveryLanguage; slug?: string }) {
  const selected = slug ? findDiscoverySport(slug) : undefined;
  if (slug && !selected) notFound();
  const all = await getPublicCourtDirectory();
  const courts = selected ? all.filter(c => c.sport?.name.toLowerCase() === selected.name.toLowerCase()) : all;
  const sports = [...new Set(all.flatMap(c => c.sport ? [c.sport.name] : []))];
  const regions = selected ? locationSlugsWithInventory(courts, selected.name) : [];
  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const metadata = courtDirectoryMetadata(lang, slug);
  const title = metadata.title as string;
  const href = courtsPath(lang, slug);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: title, description: metadata.description, url: `${SITE_URL}${href}`, inLanguage: ar ? "ar-EG" : "en" },
      breadcrumbsJsonLd([{ name: copy("Home", "الرئيسية"), url: SITE_URL }, { name: title, url: `${SITE_URL}${href}` }]),
      { "@type": "ItemList", name: title, numberOfItems: courts.length, itemListElement: courts.map((c,i) => ({ "@type": "ListItem", position:i+1, name:c.name, url:`${SITE_URL}/p/${encodeURIComponent(c.id)}` })) }
    ] }) }} />
    <DirectoryExperience kind="courts" courts={courts} selectedSport={selected?.name} availableSports={sports} />
  </>;
}
