import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { VolleyballWhatsAppGroup } from "@/components/public/volleyball-whatsapp-group";
import { getPublicGames, getRecentPublicGames } from "@/lib/public-games";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { isNewCairo, type LocalLanguage } from "@/lib/local-games";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
import { publicGamePath } from "@/lib/game-discovery";
import { LocalHeader, LocalHero, LocalSectionHeading, LocalGameCards, LocalArchive, LocalCourts, localStyles as styles } from "@/components/public/local-discovery-ui";

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
  const pageTitle = ar ? "ماتشات في التجمع والقاهرة الجديدة" : "New Cairo & Tagamoa Sports Games";
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className={styles.page}>
    <LocalHeader lang={lang} alternate={newCairoGamesPath(ar ? "en" : "ar")} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: pageTitle, description: meta.description, url: `${SITE_URL}${pagePath}`, inLanguage: ar ? "ar-EG" : "en",
        mainEntity: { "@type": "ItemList", numberOfItems: upcoming.length, itemListElement: upcoming.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}${publicGamePath(g.id)}` })) } },
      breadcrumbsJsonLd([{ name: copy("Home", "الرئيسية"), url: SITE_URL }, { name: copy("Games", "الماتشات"), url: `${SITE_URL}/games` }, { name: pageTitle, url: `${SITE_URL}${pagePath}` }]),
    ] }) }} />
    <LocalHero lang={lang} badge={copy("Fifth Settlement", "التجمع الخامس")} title={pageTitle}
      description={copy("Find a game. Book your spot. Let’s play.", "اختار ماتشك واحجز مكانك في ثواني.")}
      gamesCount={upcoming.length} />
    <div className={styles.shell}>
      <section id="local-games" className={styles.section} aria-labelledby="local-games-heading">
        <LocalSectionHeading id="local-games-heading" kicker="" title={copy("Upcoming games", "الماتشات القادمة")}
          aside={<Link className={styles.textArrow} href="/games">{copy("All games", "كل الماتشات")} <ArrowUpRight size={17}/></Link>} />
        <LocalGameCards lang={lang} games={upcoming}/>
        <div className={styles.waRow}><VolleyballWhatsAppGroup lang={lang} theme="dark" compact/></div>
      </section>
      {(courts.length > 0) && <section className={styles.section} aria-labelledby="local-courts-heading">
        <LocalSectionHeading id="local-courts-heading" kicker="" title={copy("Courts in New Cairo", "ملاعب في التجمع")}/>
        <LocalCourts lang={lang} courts={courts} />
      </section>}
      {past.length>0 && <section className={styles.section} aria-label={copy("Previous games", "الماتشات السابقة")}><LocalArchive lang={lang} games={past}/></section>}

    </div>
  </main>;
}
