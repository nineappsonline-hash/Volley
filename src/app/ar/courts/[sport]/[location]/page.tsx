import { notFound } from "next/navigation";
import { CourtLocationPage } from "@/components/public/court-location-page";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { DISCOVERY_SPORTS, findDiscoverySport } from "@/lib/sport-discovery";
import { courtLocationMetadata, courtsForLocation, locationSlugsWithInventory } from "@/lib/court-locations";

export const revalidate = 300;
export const dynamicParams = false;

/** Pre-build only sport + location combinations that have real inventory. */
export async function generateStaticParams() {
  const courts = await getPublicCourtDirectory();
  const params: { sport: string; location: string }[] = [];
  for (const sport of DISCOVERY_SPORTS) {
    for (const location of locationSlugsWithInventory(courts, sport.name)) {
      if (courtsForLocation(courts, sport.name, location).length) params.push({ sport: sport.slug, location });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ sport: string; location: string }> }) {
  const { sport, location } = await params;
  if (!findDiscoverySport(sport)) return {};
  return courtLocationMetadata("ar", sport, location);
}

export default async function Page({ params }: { params: Promise<{ sport: string; location: string }> }) {
  const { sport, location } = await params;
  if (!findDiscoverySport(sport)) notFound();
  return <CourtLocationPage lang="ar" sport={sport} location={location} />;
}
