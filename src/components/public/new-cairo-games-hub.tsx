import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import { GameAlertFollow } from "@/components/games/game-alert-follow";
import { getPublicGames, getRecentPublicGames } from "@/lib/public-games";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { gamePlace, publicGamePath } from "@/lib/game-discovery";
import { formatTime12h } from "@/lib/constants";
import { gameSharePrice } from "@/lib/game-share";
import { LOCAL_GAME_GUIDES, isNewCairo, localGamePath, type LocalLanguage } from "@/lib/local-games";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

export const newCairoGamesPath = (lang: LocalLanguage) =>
  `${lang === "ar" ? "/ar" : ""}/play/new-cairo`;

export const newCairoGamesMeta = (lang: LocalLanguage): Metadata => {
  const ar = lang === "ar";
  const title = ar ? "ماتشات في التجمع والقاهرة الجديدة | العب مع ناس جديدة" : "Find Sports Games in New Cairo & Tagamoa";
  const description = ar
    ? "دور على ناس تلعب معاها في التجمع والقاهرة الجديدة. شوف ماتشات الطائرة والطائرة الشاطئية المنشورة، والمواعيد والأسعار، وألعاب سابقة وروابط الملاعب."
    : "Find people to play with in New Cairo and Tagamoa. Browse real published volleyball and beach volleyball games, dates, prices, previous games and courts.";
  const path = newCairoGamesPath(lang);
  return { title, description, alternates: { canonical: path, languages: { en: newCairoGamesPath("en"), "ar-EG": newCairoGamesPath("ar"), "x-default": newCairoGamesPath("en") } },
    openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: "Playza", type: "website", locale: ar ? "ar_EG" : "en_US" } };
};

export async function NewCairoGamesHub({ lang }: { lang: LocalLanguage }) {
  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const sports = ["Volleyball", "Beach Volleyball"] as const;
  const [upcomingGroups, archiveGroups, courtGroups] = await Promise.all([
    Promise.all(sports.map(sport => getPublicGames(sport))),
    Promise.all(sports.map(sport => getRecentPublicGames(sport, 60))),
    Promise.all(sports.map(sport => getPublicCourtDirectory(sport))),
  ]);
  const upcoming = upcomingGroups.flat().filter(g => isNewCairo(g.playground?.area ?? g.area))
    .sort((a, b) => (a.game_date + a.start_time).localeCompare(b.game_date + b.start_time));
  const past = archiveGroups.flat().filter(g => isNewCairo(g.playground?.area ?? g.area))
    .sort((a, b) => (b.game_date + b.start_time).localeCompare(a.game_date + a.start_time)).slice(0, 16);
  const courts = [...new Map(courtGroups.flat().filter(c => isNewCairo(c.area)).map(c => [c.id, c])).values()];
  const pagePath = newCairoGamesPath(lang);
  const meta = newCairoGamesMeta(lang);
  const pageTitle = ar ? "ماتشات في التجمع والقاهرة الجديدة | العب مع ناس جديدة" : "Find Sports Games in New Cairo & Tagamoa";
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6"><Link href="/" aria-label="Playza"><AppLogo /></Link><Link href={newCairoGamesPath(ar ? "en" : "ar")} hrefLang={ar ? "en" : "ar-EG"} className="text-sm font-semibold underline">{ar ? "English" : "العربية"}</Link></header>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: pageTitle, description: meta.description, url: `${SITE_URL}${pagePath}`, inLanguage: ar ? "ar-EG" : "en", mainEntity: { "@type": "ItemList", numberOfItems: upcoming.length, itemListElement: upcoming.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}${publicGamePath(g.id)}` })) } },
      breadcrumbsJsonLd([{ name: copy("Home", "الرئيسية"), url: SITE_URL }, { name: copy("Games", "الماتشات"), url: `${SITE_URL}/games` }, { name: copy("New Cairo games", "ماتشات القاهرة الجديدة"), url: `${SITE_URL}${pagePath}` }]),
    ] }) }} />
    <div className="mx-auto max-w-5xl space-y-10 px-5">
      <section className="rounded-3xl bg-brand p-7 text-white sm:p-11">
        <p className="text-sm font-semibold text-highlight">Playza · {copy("New Cairo · Tagamoa", "القاهرة الجديدة · التجمع")}</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-5xl">{pageTitle}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/90">{meta.description}</p>
        <a href="#upcoming-local-games" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-brand">{copy("See available games", "شوف الماتشات الجاية")}</a>
      </section>
      <section className="space-y-4" aria-labelledby="choose-local-sport">
        <h2 id="choose-local-sport" className="text-2xl font-bold">{copy("Choose the game that suits you", "اختار نوع اللعب المناسب ليك")}</h2>
        <p className="leading-relaxed text-muted-foreground">{copy("Playza lists organized games with individual joining options; court rental is a different service. Check the exact venue, skill level, remaining spots and per-player fee before requesting a place.", "بلايزا بيعرض ماتشات منظمة تقدر تطلب مكان فيها كلاعب فردي حسب شروط المنظم. حجز الملعب بالكامل مختلف عن الانضمام لماتش. راجع عنوان الملعب والمستوى والأماكن والتكلفة قبل المشاركة.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">{LOCAL_GAME_GUIDES.map(g => <Link key={g.slug} href={localGamePath(lang,g.slug)} className="rounded-xl border bg-card p-5 font-semibold underline underline-offset-4 hover:bg-accent">{g[lang].title}</Link>)}</div>
      </section>
      <section id="upcoming-local-games" className="scroll-mt-8 space-y-4">
        <h2 className="text-2xl font-bold">{copy("Upcoming published games in New Cairo", "الماتشات المنشورة الجاية في التجمع")}</h2>
        {upcoming.length ? <div className="grid gap-4 sm:grid-cols-2">{upcoming.map(g => <article key={g.id} className="space-y-3 rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold text-primary">{g.sport}</p>
          <h3 className="text-lg font-bold"><Link href={publicGamePath(g.id)} className="underline underline-offset-4">{g.title}</Link></h3>
          <p><time dateTime={g.game_date}>{g.game_date}</time> · {formatTime12h(g.start_time,lang)}</p>
          <p className="text-sm text-muted-foreground">{gamePlace(g)}</p>
          <p className="text-sm font-semibold">{g.host_pays || g.share_price === 0 ? copy("Host covers the cost", "المنظم بيتكفل بالتكلفة") : g.share_price == null ? copy("Check the price with the organizer", "راجع السعر مع المنظم") : gameSharePrice(g)}</p>
          <Link href={publicGamePath(g.id)} className="font-semibold text-primary underline underline-offset-4">{copy("See game details and join", "تفاصيل الماتش والانضمام")}</Link>
        </article>)}</div> : <p className="rounded-xl border p-5">{copy("No upcoming public games in New Cairo are listed right now. Check the sport guides and previously played games below; publication changes with organizers.", "مفيش ماتشات عامة قادمة منشورة في القاهرة الجديدة حاليًا. راجع أدلة الرياضات والألعاب السابقة تحت؛ المواعيد بتتغير حسب المنظمين.")}</p>}
        <Link href="/games" className="inline-flex rounded-xl border px-4 py-3 font-semibold underline">{copy("Browse all upcoming games", "كل الماتشات الجاية")}</Link>
      </section>
      {past.length > 0 && <section className="space-y-4">
        <h2 className="text-2xl font-bold">{copy("Previously played games — not bookable", "ماتشات سابقة — غير متاحة للحجز")}</h2>
        <p className="leading-relaxed text-muted-foreground">{copy("These are real archived games, not available future sessions. Their pages remain useful to understand the venues and find new games.", "دي ماتشات اتنشرت واتلعبت قبل كده، ومش مواعيد متاحة للحجز حاليًا. تقدر تشوف تفاصيلها وتنتقل منها للماتشات الجديدة.")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">{past.map(g => <li key={g.id} className="rounded-xl border bg-card p-4"><Link href={publicGamePath(g.id)} className="font-semibold underline underline-offset-4">{g.title}</Link><p className="mt-2 text-sm text-muted-foreground"><time dateTime={g.game_date}>{g.game_date}</time> · {g.sport} · {gamePlace(g)}</p></li>)}</ul>
      </section>}
      {courts.length > 0 && <section className="space-y-4">
        <h2 className="text-2xl font-bold">{copy("Published courts in New Cairo", "ملاعب منشورة في القاهرة الجديدة")}</h2>
        <p className="text-muted-foreground">{copy("A court listing does not guarantee a game is scheduled or that a booking slot is available.", "ظهور ملعب في القائمة مش معناه إن فيه ماتش أو حجز متاح في ميعاد معين.")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">{courts.map(c => <li key={c.id} className="rounded-xl border bg-card p-4"><Link href={`/p/${encodeURIComponent(c.id)}`} className="font-semibold underline underline-offset-4">{c.name}</Link><p className="mt-2 text-sm text-muted-foreground">{[c.address,c.area,c.governorate].filter(Boolean).join(" · ")}</p></li>)}</ul>
      </section>}
      <GameAlertFollow language={lang} sport="Volleyball" returnTo={pagePath} />
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{copy("What to check before you play", "تراجع إيه قبل ما تنزل تلعب؟")}</h2>
        <p className="leading-relaxed text-muted-foreground">{copy("New Cairo, Tagamoa and Fifth Settlement can describe a broad area; confirm the venue's precise entrance and map link. Friendly games have different skill, age and payment rules. Never assume that a previous weekly event is scheduled again until a new public listing appears.", "التجمع والقاهرة الجديدة والتجمع الخامس أسماء لمناطق واسعة، فاتأكد من عنوان وبوابة الملعب ورابط الخريطة. كل ماتش ممكن يكون له شروط مختلفة للسن والمستوى والدفع. الماتش الأسبوعي السابق مش دليل على إنه متاح الأسبوع ده إلا لو فيه إعلان جديد.")}</p>
      </section>
      <nav className="flex flex-wrap gap-4 border-t pt-6 text-sm font-semibold" aria-label={copy("Related pages", "روابط مرتبطة")}>
        <Link href="/games" className="underline">{copy("Upcoming games", "الماتشات الجاية")}</Link>
        <Link href="/courts" className="underline">{copy("Find courts", "اكتشف الملاعب")}</Link>
        <Link href="/academies" className="underline">{copy("Academies", "الأكاديميات")}</Link>
      </nav>
    </div>
  </main>;
}
