import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGame } from "@/lib/public-games";
import { gamePlace, publicGamePath, publicGameMetadata, publicGameEvent, gameIsJoinable, cairoGameStart } from "@/lib/game-discovery";
import { gameSharePrice } from "@/lib/game-share";
import { formatTime12h } from "@/lib/constants";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
import { PublicGameJoin } from "@/components/games/public-game-join";
import { PlayerJoiningGuide } from "@/components/games/player-joining-guide";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { AppLogo } from "@/components/shared/app-logo";
import { LOCAL_GAME_GUIDES, localGamePath, matchesLocalGame } from "@/lib/local-games";

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
  const joinable = gameIsJoinable(game);
  const full = game.status === "full" || game.joined >= game.max_players;
  const status = game.status === "cancelled" ? "Cancelled" : game.status === "completed" ? "Completed" : !joinable ? "This game has ended or already started" : full ? "Full — check waitlist options" : "Open for joining";
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`));
  const gender = { male: "Men's", female: "Women's", mixed: "Mixed" }[game.gender] || game.gender;
  const localGuides = LOCAL_GAME_GUIDES.filter(guide => matchesLocalGame(game, guide));
  return <main className="min-h-screen bg-background px-5 py-8">
    <header className="mx-auto mb-8 flex max-w-3xl items-center justify-between gap-5"><Link href="/" aria-label="Playza"><AppLogo /></Link><Link href="/games" className="font-semibold underline underline-offset-4">All upcoming games</Link></header>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      ...(event ? [event] : []), breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }, { name: "Games", url: `${SITE_URL}/games` }, { name: game.title, url: `${SITE_URL}${path}` }]),
    ] }) }} />
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-card p-6 sm:p-10">
      <p className="font-semibold text-muted-foreground">{game.sport} · {status}</p>
      <h1 className="text-3xl font-bold sm:text-4xl">{game.title}</h1>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="font-semibold">Date and time</dt><dd><time dateTime={cairoGameStart(game.game_date, game.start_time).toISOString()}>{date} · {formatTime12h(game.start_time)}</time><p className="text-sm text-muted-foreground">Cairo time · {game.duration_hours} hours</p></dd></div>
        <div><dt className="font-semibold">Location</dt><dd>{gamePlace(game) || "Confirm the location with the organizer"}{game.playground?.address && <p>{game.playground.address}</p>}{game.playground?.country && <p>{game.playground.country}</p>}</dd></div>
        <div><dt className="font-semibold">Cost per player</dt><dd>{gameSharePrice(game)}</dd></div>
        <div><dt className="font-semibold">Players</dt><dd>{game.joined}/{game.max_players} confirmed · {gender}</dd></div>
        <div><dt className="font-semibold">Playing level</dt><dd>{game.skill_level || "Not specified — check with the organizer"}</dd></div>
        <div><dt className="font-semibold">Age requirements</dt><dd>{game.min_age != null || game.max_age != null ? `${game.min_age ?? "Any"}–${game.max_age ?? "no upper limit"} years` : "Not specified — check with the organizer"}</dd></div>
      </dl>
      {game.creator_name && <p>Organized by {game.creator_name}</p>}
      {game.description && <section><h2 className="text-xl font-bold">About this game</h2><p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{game.description}</p></section>}
      <DirectionsLinks query={gamePlace(game)} locationLink={game.playground?.location_link} />
      <PlayerJoiningGuide skillLevel={game.skill_level} />
      {joinable ? <section aria-label="Join this game"><PublicGameJoin game={game} returnTo={path} /><p className="mt-3 text-sm text-muted-foreground">Sign in or create an account, then complete joining and review your payment or waitlist status. Creating an account alone does not reserve a place.</p></section> : <p role="status" className="rounded-xl bg-muted p-4">{status}. <Link href="/games" className="underline">Find another upcoming game</Link>.</p>}
      {localGuides.length > 0 && <nav aria-label="Local playing guides" className="space-y-2 border-t pt-5">{localGuides.map(guide => <Link key={guide.slug} href={localGamePath("en", guide.slug)} className="block underline underline-offset-4">{guide.en.title}</Link>)}</nav>}
    </article>
  </main>;
}
