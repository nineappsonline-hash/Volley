import { notFound } from "next/navigation";
import { SportDiscoveryPage } from "@/components/public/sport-discovery-page";
import { DISCOVERY_SPORTS, discoveryMetadata, findDiscoverySport } from "@/lib/sport-discovery";

export const revalidate = 300;
export const dynamicParams = false;
export function generateStaticParams() { return DISCOVERY_SPORTS.map(s => ({ sport: s.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const sport = findDiscoverySport((await params).sport);
  if (!sport) notFound();
  return discoveryMetadata("ar", sport);
}
export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  return <SportDiscoveryPage lang="ar" slug={(await params).sport} />;
}
