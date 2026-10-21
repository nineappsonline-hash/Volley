import { SharedGamePage } from "@/components/games/shared-game-page";
import { notFound } from "next/navigation";
import { getPublicGame } from "@/lib/public-games";
import { gamePlace, publicGamePath, publicGameMetadata, publicGameEvent } from "@/lib/game-discovery";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  return publicGameMetadata(game);
}

export default async function PublicGamePage({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  const path = publicGamePath(game.id);
  const event = publicGameEvent(game);
  const sharedGame = {
    ...game,
    gender: game.gender as "male" | "female" | "mixed",
    governorate: game.playground?.governorate ?? null,
    map_label: gamePlace(game),
    location_link: game.playground?.location_link ?? null,
    lat: null, lng: null,
    host_pays: game.host_pays ?? false,
    host_total: game.host_total ?? null,
    is_public: true,
    // Public IDs expose counts only; names retain their existing sign-in checks.
    participants: [],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      ...(event ? [event] : []), breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }, { name: "Games", url: `${SITE_URL}/games` }, { name: game.title, url: `${SITE_URL}${path}` }]),
    ] }) }} />
    <SharedGamePage game={sharedGame} />
  </>;
}
