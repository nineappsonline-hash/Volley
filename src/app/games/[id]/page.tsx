import { SharedGamePage } from "@/components/games/shared-game-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGame, getPublicGames, getPublicGameParticipantNames } from "@/lib/public-games";
import { gamePlace, publicGamePath, publicGameMetadata, publicGameEvent, gameIsJoinable } from "@/lib/game-discovery";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
import { LOCAL_GAME_GUIDES, isNewCairo, localGamePath } from "@/lib/local-games";


type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

// Archived public games keep their canonical URL and remain indexable.
// Metadata must explicitly distinguish an ended game from an upcoming event.
export async function generateMetadata({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  const metadata = publicGameMetadata(game);
  const preview = `${SITE_URL}/og/game?code=${game.id}&v=4`;
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, siteName: "Playza", locale: "en_US", images: [{ url: preview, width: 1200, height: 630, alt: game.title }] },
    twitter: { ...metadata.twitter, images: [{ url: preview, alt: game.title }] },
  };
}

export default async function PublicGamePage({ params }: Props) {
  const game = await getPublicGame((await params).id);
  if (!game) notFound();
  const publicParticipants = await getPublicGameParticipantNames(game.id);
  const upcoming = (await getPublicGames(game.sport)).filter(g => g.id !== game.id);
  const sameArea = upcoming.filter(g => {
    const target = (game.playground?.area || game.area || "").trim().toLowerCase();
    const candidate = (g.playground?.area || g.area || "").trim().toLowerCase();
    return target && candidate === target;
  });
  const related = [...sameArea, ...upcoming.filter(g => !sameArea.some(a => a.id === g.id))].slice(0, 4);
  const isPast = !gameIsJoinable(game) && game.status !== "cancelled";
  const localGuide = isNewCairo(game.playground?.area ?? game.area)
    ? LOCAL_GAME_GUIDES.find(guide => guide.sport.toLowerCase() === game.sport.toLowerCase())
    : undefined;
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
    // The server passes approved names separately; no phone or other participant data leaks.
    participants: [],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      ...(event ? [event] : []), breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }, { name: "Games", url: `${SITE_URL}/games` }, { name: game.title, url: `${SITE_URL}${path}` }]),
    ] }) }} />
    <SharedGamePage game={sharedGame} publicParticipants={publicParticipants} />
    {isPast && <section className="mx-auto max-w-3xl px-5 pt-7" aria-labelledby="past-game-alternatives">
      <h2 id="past-game-alternatives" className="text-xl font-semibold">This game has finished — find your next game</h2>
      <p className="mt-2 text-muted-foreground">The {game.sport} game on {game.game_date} in {gamePlace(game)} is in the past, so registration for this date is closed. You can still find a new game, meet other players, or create a game on Playza.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/games" className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Browse upcoming games</Link>
        <Link href={`/games?sport=${encodeURIComponent(game.sport.toLowerCase().replaceAll(" ", "-"))}`} className="rounded-lg border px-4 py-2 font-semibold text-foreground">More {game.sport} games</Link>
        {localGuide && <Link href={localGamePath("ar", localGuide.slug)} className="rounded-lg border px-4 py-2 font-semibold text-foreground">ماتشات {game.sport} في التجمع</Link>}
      </div>
    </section>}
    {related.length > 0 && <nav aria-label="Related upcoming games" className="mx-auto max-w-3xl px-5 py-8">
      <h2 className="text-lg font-semibold">More {game.sport} games on Playza</h2>
      <ul className="mt-3 space-y-2">
        {related.map(g => <li key={g.id}><Link className="text-primary underline underline-offset-4" href={`/games/${g.id}`}>{g.title}</Link> <span className="text-muted-foreground">— {g.game_date} · {g.start_time.slice(0, 5)}</span></li>)}
      </ul>
    </nav>}
  </>;
}
