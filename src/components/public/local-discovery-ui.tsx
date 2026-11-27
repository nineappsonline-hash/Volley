import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Volleyball, Trophy, ArrowDown, LandPlot, ChevronDown } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import type { PublicGame } from "@/lib/public-games";
import type { PublicCourt } from "@/lib/public-playgrounds";
import { publicGamePath, gamePlace } from "@/lib/game-discovery";
import { formatTime12h } from "@/lib/constants";
import type { LocalLanguage } from "@/lib/local-games";
import styles from "./local-discovery.module.css";

export { styles as localStyles };

export function LocalHeader({ lang, alternate }: { lang: LocalLanguage; alternate: string }) {
  const ar = lang === "ar";
  return <header className={`${styles.header} ${styles.shell}`}>
    <Link href="/" aria-label="Playza"><AppLogo className="w-28" /></Link>
    <nav className={styles.headerNav} aria-label={ar ? "القائمة" : "Navigation"}>
      <Link href="/games">{ar ? "الماتشات" : "Games"}</Link>
      <Link href="/academies">{ar ? "الأكاديميات" : "Academies"}</Link>
      <Link href={alternate} hrefLang={ar ? "en" : "ar-EG"}>{ar ? "English" : "العربية"}</Link>
    </nav>
  </header>;
}

export function LocalHero({lang, title, description, badge, gamesCount, ctaId = "local-games"}: {
  lang: LocalLanguage;title:string; description:string;badge:string;gamesCount:number;ctaId?:string;
}) {
  const ar=lang==="ar";
  return <><div className={styles.shell}>
    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}><span className={styles.dot} /> PLAYZA / {badge}</p>
        <h1 className={styles.heroTitle}>{title}</h1>
        <p className={styles.heroDescription}>{description}</p>
        <div className={styles.heroActions}>
          <a className={styles.mainButton} href={`#${ctaId}`}>{ar ? "شوف الماتشات" : "Explore games"} <ArrowDown size={18} /></a>
          <Link className={styles.outlineButton} href="/games">{ar ? "كل الألعاب" : "All games"} <ArrowUpRight size={17}/></Link>
        </div>
      </div>
      <div className={styles.heroVisual} aria-hidden="true">
        <div className={styles.heroOrb}><Volleyball className={styles.orbIcon}/></div>
        <div className={styles.floatBadge}><strong>{gamesCount}</strong>{ar ? "ماتش متاح دلوقتي" : "games available"}</div>
      </div>
    </section>
  </div>
  <div className={styles.band}><div className={`${styles.bandInner} ${styles.shell}`}>PLAY MORE <span>✳</span> MEET YOUR TEAM <span>✳</span> {ar ? "العب. اتعرف. انبسط." : "SERVE. SET. CONNECT."} <span>✳</span> PLAYZA</div></div>
  </>;
}

export function LocalSectionHeading({kicker,title,id,aside}:{kicker:string;title:string;id?:string;aside?:React.ReactNode}) {
  return <div className={styles.sectionHead}><div><p className={styles.sectionKicker}>{kicker}</p><h2 id={id} className={styles.sectionTitle}>{title}</h2></div>{aside}</div>;
}

export function LocalGameCards({lang,games}:{lang:LocalLanguage;games:PublicGame[]}) {
  const ar=lang==="ar";
  if (!games.length) return <div className={styles.empty}>{ar ? "مفيش ماتشات متاحة دلوقتي في المنطقة دي. تابع الجروب أو شوف الألعاب التانية." : "No open games in this area right now. Follow the community or browse other games."}</div>;
  return <div className={styles.cards}>{games.map(g=>{
    const free=Boolean(g.host_pays)||g.share_price===0;
    const cost=free ? (ar?"المنظم متكفل": "Host covered") : g.share_price != null ? `${g.share_price} ${ar?"جنيه":"EGP"}` : (ar?"راجع السعر":"Ask for price");
    const date=new Intl.DateTimeFormat(ar?"ar-EG":"en-US",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Cairo"}).format(new Date(`${g.game_date}T12:00:00Z`));
    return <article key={g.id} className={styles.gameCard}>
      <div className={styles.gameTop}><span className={styles.sportTag}>{g.sport}</span><time dateTime={g.game_date} className={styles.dateBadge}><CalendarDays size={16}/>{date}</time></div>
      <div className={styles.gameBody}><h3 className={styles.gameName}><Link href={publicGamePath(g.id)}>{g.title}</Link></h3>
        <div className={styles.facts}><span className={styles.fact}><Clock3 size={16}/>{formatTime12h(g.start_time,lang)}</span><span className={styles.fact}><MapPin size={16}/>{gamePlace(g) || (ar?"التجمع":"New Cairo")}</span></div>
        <div className={styles.cardBottom}><div><strong className={styles.price}>{cost}</strong><span className={styles.priceSmall}>{ar?"للفرد":"per player"}</span></div>
          <Link className={styles.cardButton} href={publicGamePath(g.id)}>{ar?"احجز مكانك":"View game"} <ArrowUpRight size={17}/></Link></div>
      </div>
    </article>;
  })}</div>;
}

export function LocalArchive({lang,games}:{lang:LocalLanguage;games:PublicGame[]}) {
  if(!games.length)return null;const ar=lang==="ar";
  return <details className={styles.archive}><summary><span><Trophy size={22}/>{ar?"ماتشات اتلعبت قبل كده":"Previous games"} <small className="text-xs font-medium opacity-60">({games.length})</small></span><ChevronDown size={18}/></summary>
    <ul className={styles.archiveList}>{games.map(g=><li key={g.id} className={styles.archiveItem}><Link href={publicGamePath(g.id)}>{g.title}</Link><span className={styles.archiveDate}><time dateTime={g.game_date}>{g.game_date}</time> · {g.sport}</span></li>)}</ul>
  </details>;
}

export function LocalCourts({lang,courts}:{lang:LocalLanguage;courts:PublicCourt[]}) {
  if(!courts.length)return null;
  return <div className={styles.courtList}>{courts.map(c=><article key={c.id} className={styles.courtCard}><div className={styles.courtIcon}><LandPlot size={23}/></div><div><h3 className={styles.courtName}><Link href={`/p/${encodeURIComponent(c.id)}`}>{c.name}</Link></h3><p className={styles.courtArea}>{[c.area,c.governorate].filter(Boolean).join(" · ")}</p></div></article>)}</div>;
}
