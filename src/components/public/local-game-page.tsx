import { GameAlertFollow } from "@/components/games/game-alert-follow";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicGames } from "@/lib/public-games";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { LOCAL_GAME_GUIDES, findLocalGuide, isNewCairo, localGamePath, matchesLocalGame, type LocalLanguage } from "@/lib/local-games";
import { publicGamePath, gamePlace } from "@/lib/game-discovery";
import { gameSharePrice } from "@/lib/game-share";
import { formatTime12h } from "@/lib/constants";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

const linkStyle = "inline-flex rounded-xl border px-4 py-3 font-semibold underline-offset-4 hover:underline";
export async function LocalGamePage({ lang, slug }: { lang: LocalLanguage; slug: string }) {
  const guide = findLocalGuide(slug);
  if (!guide) notFound();
  const ar = lang === "ar";
  const copy = guide[lang];
  const [games, courts] = await Promise.all([getPublicGames(guide.sport), getPublicCourtDirectory(guide.sport)]);
  const localGames = games.filter(game => matchesLocalGame(game, guide));
  const localCourts = courts.filter(court => isNewCairo(court.area));
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6"><Link href="/" aria-label="Playza"><AppLogo /></Link><Link href={localGamePath(ar ? "en" : "ar", slug)} hrefLang={ar ? "en" : "ar-EG"} lang={ar ? "en" : "ar"} className="underline underline-offset-4">{ar ? "English" : "العربية"}</Link></header>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: copy.title, description: copy.description, url: `${SITE_URL}${localGamePath(lang, slug)}`, inLanguage: ar ? "ar-EG" : "en", mainEntity: { "@type": "ItemList", numberOfItems: localGames.length, itemListElement: localGames.map((game, i) => ({ "@type": "ListItem", position: i + 1, name: game.title, url: `${SITE_URL}${publicGamePath(game.id)}` })) } },
      breadcrumbsJsonLd([{ name: ar ? "الرئيسية" : "Home", url: SITE_URL }, { name: ar ? "الماتشات" : "Games", url: `${SITE_URL}/games` }, { name: copy.title, url: `${SITE_URL}${localGamePath(lang, slug)}` }]),
    ] }) }} />
    <div className="mx-auto max-w-5xl space-y-10 px-5">
      <section className="rounded-3xl bg-brand p-8 text-white sm:p-12"><p className="mb-3 font-semibold text-highlight">Playza · {ar ? "التجمع، القاهرة، مصر" : "New Cairo, Cairo, Egypt"}</p><h1 className="text-3xl font-bold text-white sm:text-5xl">{copy.title}</h1><p className="mt-5 max-w-3xl text-lg leading-relaxed">{copy.description}</p><a href="#local-upcoming-games" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-brand">{ar ? "شوف الماتشات المتاحة" : "See upcoming games"}</a></section>
      <section id="local-upcoming-games" aria-labelledby="local-games-title" className="scroll-mt-8"><h2 id="local-games-title" className="text-2xl font-bold">{ar ? "الماتشات الجاية في القاهرة الجديدة" : "Upcoming games in New Cairo"}</h2>
        {localGames.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{localGames.map(game => <article key={game.id} className="space-y-3 rounded-2xl border bg-card p-5"><h3 className="text-xl font-bold"><Link href={publicGamePath(game.id)}>{game.title}</Link></h3><p><time dateTime={game.game_date}>{game.game_date}</time> · {formatTime12h(game.start_time, lang)} · {ar ? "بتوقيت القاهرة" : "Cairo time"}</p><p>{gamePlace(game)}</p><p>{ar ? game.host_pays || game.share_price === 0 ? "مجاني" : game.share_price == null ? "التكلفة لم تتحدد بعد" : `${game.share_price} جنيه لكل لاعب` : gameSharePrice(game)}</p><Link className={linkStyle} href={publicGamePath(game.id)}>{ar ? "تفاصيل الماتش والانضمام" : "Game details & joining"}</Link></article>)}</div> : <p className="mt-5 rounded-xl border p-5 leading-relaxed">{ar ? "مفيش ماتشات منشورة جاية لهذه الرياضة في القاهرة الجديدة حاليًا. راجع الملاعب والدليل هنا، أو شوف كل الماتشات لمواعيد وأماكن تانية. التوفر بيتغير حسب المنظم." : "No upcoming public games for this sport in New Cairo are listed right now. Use the court and preparation information below, or browse all games for other dates and locations. Availability changes with organizers' schedules."}</p>}
      </section>
      {localCourts.length > 0 && <section><h2 className="text-2xl font-bold">{ar ? "ملاعب منشورة في القاهرة الجديدة" : "Published courts in New Cairo"}</h2><p className="mt-3 text-muted-foreground">{ar ? "صفحة الملعب للتعرف على المكان؛ وجود ملعب لا يعني توفر ماتش أو حجز في ميعاد معين." : "Court profiles describe the venue; a listed court does not guarantee an organized game or an available booking."}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{localCourts.map(court => <article key={court.id} className="rounded-xl border p-5"><h3 className="font-bold"><Link href={`/p/${court.id}`} className="underline underline-offset-4">{court.name}</Link></h3><p className="mt-2 text-sm">{[court.address, court.area, court.governorate].filter(Boolean).join(", ")}</p></article>)}</div></section>}
      <GameAlertFollow language={lang} sport={guide.sport} returnTo={localGamePath(lang, slug)} />
      {copy.sections.map(([heading, body]) => <section key={heading}><h2 className="text-2xl font-bold">{heading}</h2><p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">{body}</p></section>)}
      <nav aria-label={ar ? "اكتشف المزيد" : "Explore more"} className="flex flex-wrap gap-3 border-t pt-6"><Link className={linkStyle} href="/games">{ar ? "كل الماتشات" : "All games"}</Link><Link className={linkStyle} href={`${ar ? "/ar" : ""}/sports/${guide.sportSlug}`}>{ar ? "دليل الرياضة في القاهرة" : "Sport guide for Cairo"}</Link>{LOCAL_GAME_GUIDES.filter(g => g.slug !== slug).map(g => <Link key={g.slug} className={linkStyle} href={localGamePath(lang, g.slug)}>{g[lang].title}</Link>)}</nav>
    </div>
  </main>;
}
