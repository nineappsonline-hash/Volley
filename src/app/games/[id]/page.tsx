import { SharedGamePage } from "@/components/games/shared-game-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGame, getPublicGames } from "@/lib/public-games";
import { gamePlace, publicGamePath, publicGameMetadata, publicGameEvent } from "@/lib/game-discovery";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
import { gameSharingTarget } from "@/lib/game-share";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  const path = publicGamePath(game.id);
  const sharedGame = {
    ...game,
    is_public: true,
    place: game.playground?.name || game.area || (game as any)?.governorate || "",
  } as const;
  const shared = gameSharingTarget(sharedGame, SITE_URL, "en");
  return {
    title: shared?.title || game.title,
    description: shared?.text?.split("\\n")[0] || `${game.sport} game on Playza`,
    openGraph: {
      title: shared?.title || `${game.title} — ${game.sport} game`,
      description: shared?.text?.split("\\n")[0] || `
      Join a ${game.sport.toLowerCase()} game in ${location}. View schedule, fee and registration on Playza.`,
      url: path,
      images: [{ url: `${SITE_URL}/og/game?code=${game.id}`, width: 1200, height: 630, alt: shared?.title || game.title }],
      type: "website",
      siteName: "Playza",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: shared?.title || `${game.title} — ${game.sport} game`,
      description: shared?.text?.split("\\n")[0] || `
      Join a ${game.sport.toLowerCase()} game in ${location}. View schedule, fee and registration on Playza.`,
      images: [{ url: `${SITE_URL}/og/game?code=${game.id}`, alt: shared?.title || game.title }],
    },
  };
}

export default async function PublicGamePage({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  const related = (await getPublicGames(game.sport)).filter(g => g.id !== game.id).slice(0, 4);
  const path = publicGamePath(game.id);
  const event = publicGameEvent(game);
  const sharedGame = {
    ...game,
    gender: game.gender as "male" | "female" | "mixed",
    governorate: game.playground?.governorate ?? null,
    map_label: gamePlace(game),
    location_link: game.playground?.location_link ?? null,
    cover_url: game.playground?.cover_url ?? null,
    photos: game.playground?.photos ?? null,
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
    {related.length > 0 && <nav aria-label="Related upcoming games" className="mx-auto max-w-3xl px-5 py-8">
      <h2 className="text-lg font-semibold">More {game.sport} games on Playza</h2>
      <ul className="mt-3 space-y-2">
        {related.map(g => <li key={g.id}><Link className="text-primary underline underline-offset-4" href={`/games/${g.id}`}>{g.title}</Link> <span className="text-muted-foreground">— {g.game_date} · {g.start_time.slice(0, 5)}</span></li>)}
      </ul>
    </nav>}
  </>;
}
