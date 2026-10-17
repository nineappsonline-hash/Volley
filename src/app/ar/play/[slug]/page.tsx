import { notFound } from "next/navigation";
import { LocalGamePage } from "@/components/public/local-game-page";
import { LOCAL_GAME_GUIDES, findLocalGuide, localGameMetadata } from "@/lib/local-games";
export const revalidate = 300;
export const dynamicParams = false;
export function generateStaticParams() { return LOCAL_GAME_GUIDES.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findLocalGuide((await params).slug);
  if (!guide) notFound();
  return localGameMetadata("ar", guide);
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LocalGamePage lang="ar" slug={(await params).slug} />;
}
