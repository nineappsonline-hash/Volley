import { notFound } from "next/navigation";
import { OwnerSportPage } from "@/components/marketing/owner-sport-page";
import { OWNER_SPORTS, ownerSportMetadata, type OwnerSportSlug } from "@/lib/owner-sport-pages";

export const revalidate = 86400;
export const dynamicParams = false;
export function generateStaticParams() {
  return (Object.keys(OWNER_SPORTS) as OwnerSportSlug[]).map(sport => ({ sport }));
}
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!(sport in OWNER_SPORTS)) notFound();
  return ownerSportMetadata("ar", sport as OwnerSportSlug);
}
export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!(sport in OWNER_SPORTS)) notFound();
  return <OwnerSportPage lang="ar" slug={sport as OwnerSportSlug} />;
}
