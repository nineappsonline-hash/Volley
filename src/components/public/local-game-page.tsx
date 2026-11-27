import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { VolleyballWhatsAppGroup } from "@/components/public/volleyball-whatsapp-group";
import { GameAlertFollow } from "@/components/games/game-alert-follow";
import { getPublicGames, getRecentPublicGames } from "@/lib/public-games";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { LOCAL_GAME_GUIDES, findLocalGuide, isNewCairo, localGamePath, matchesLocalGame, type LocalLanguage } from "@/lib/local-games";
import { publicGamePath } from "@/lib/game-discovery";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
import { LocalHeader, LocalHero, LocalSectionHeading, LocalGameCards, LocalArchive, LocalCourts, localStyles as styles } from "@/components/public/local-discovery-ui";

export async function LocalGamePage({ lang, slug }: { lang: LocalLanguage; slug: string }) {
  const guide = findLocalGuide(slug);
  if (!guide) notFound();
  const ar = lang === "ar";
  const copy = guide[lang];
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [games, courts, archive] = await Promise.all([
    getPublicGames(guide.sport),
    getPublicCourtDirectory(guide.sport),
    getRecentPublicGames(guide.sport, 60),
  ]);
  const localGames = games.filter(game => matchesLocalGame(game, guide));
  const historicGames = archive.filter(game => matchesLocalGame(game, guide)).slice(0, 8);
  const localCourts = courts.filter(court => isNewCairo(court.area));
  const path = localGamePath(lang,slug);
  const title = guide.sport === "Volleyball"
    ? text("Volleyball in New Cairo", "ماتشات طائرة في التجمع")
    : text("Beach Volleyball in New Cairo", "طائرة شاطئية في التجمع");
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className={styles.page}>
    <LocalHeader lang={lang} alternate={localGamePath(ar ? "en" : "ar", slug)} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: copy.title, description: copy.description, url: `${SITE_URL}${path}`, inLanguage: ar ? "ar-EG" : "en",
        mainEntity: { "@type": "ItemList", numberOfItems: localGames.length, itemListElement: localGames.map((game,i)=>({ "@type": "ListItem", position:i+1, name:game.title, url:`${SITE_URL}${publicGamePath(game.id)}` })) } },
      breadcrumbsJsonLd([{name:text("Home","الرئيسية"),url:SITE_URL},{name:text("Games","الماتشات"),url:`${SITE_URL}/games`},{name:copy.title,url:`${SITE_URL}${path}`}]),
    ] }) }} />
    <LocalHero lang={lang} title={title} badge={text("FIFTH SETTLEMENT", "التجمع الخامس")}
      description={text("Join real local games, meet new players and get your next session booked.", "لاقي مجموعة تلعب معاها، اختار الميعاد واحجز مكانك.")}
      gamesCount={localGames.length}/>
    <div className={styles.shell}>
      <section id="local-games" className={styles.section} aria-labelledby="local-games-title">
        <LocalSectionHeading id="local-games-title" kicker={text("UP NEXT","المواعيد القادمة")} title={text("Find your next match", "اختار ماتشك الجاي")}
          aside={<Link className={styles.textArrow} href="/games">{text("All games","كل الماتشات")} <ArrowUpRight size={17}/></Link>}/>
        <LocalGameCards lang={lang} games={localGames}/>
        {guide.sport==="Volleyball" && <div className={styles.waRow}><VolleyballWhatsAppGroup lang={lang} theme="dark"/></div>}
      </section>
      {localCourts.length>0 && <section className={styles.section} aria-labelledby="local-courts-title">
        <LocalSectionHeading id="local-courts-title" kicker={text("THE COURTS","أماكن اللعب")} title={text("Where we play", "بنلعب فين؟")}/>
        <LocalCourts lang={lang} courts={localCourts}/>
      </section>}
      {historicGames.length>0 && <section className={styles.section} aria-label={text("Past matches","ماتشات سابقة")}>
        <LocalArchive lang={lang} games={historicGames}/>
      </section>}
      <div className={styles.alertBox}><GameAlertFollow language={lang} sport={guide.sport} returnTo={path}/></div>
      <section className={styles.editorial} aria-label={text("Useful player tips","معلومات قبل اللعب")}>
        <details><summary>{text("Before you join — location, level and booking tips", "قبل ما تنضم: المكان والمستوى والحجز")}</summary>
          {copy.sections.map(([heading,body])=><div key={heading}><h3 className="mt-4 font-bold">{heading}</h3><p>{body}</p></div>)}
        </details>
      </section>
      <nav className={`${styles.footer} ${styles.bottomLinks}`} aria-label={text("Explore more","اكتشف أكتر")}>
        <Link href={`${ar?"/ar":""}/play/new-cairo`}>{text("All New Cairo games","كل ماتشات التجمع")}</Link>
        <Link href={`${ar?"/ar":""}/sports/${guide.sportSlug}`}>{text("Sport guide","دليل الرياضة")}</Link>
        {LOCAL_GAME_GUIDES.filter(g=>g.slug!==slug).map(g=><Link key={g.slug} href={localGamePath(lang,g.slug)}>{g.sport === "Volleyball" ? text("Volleyball games","ماتشات الطايرة") : text("Beach volleyball","الطايرة الشاطئية")}</Link>)}
      </nav>
    </div>
  </main>;
}
