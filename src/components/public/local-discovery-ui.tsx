import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Volleyball, Trophy, LandPlot, ChevronDown, Zap, CircleUserRound, Plus } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import type { PublicGame } from "@/lib/public-games";
import type { PublicCourt } from "@/lib/public-playgrounds";
import { publicGamePath } from "@/lib/game-discovery";
import { guestGameCard } from "@/lib/guest-games";
import { GameCardShell } from "@/components/games/game-card-shell";
import landingStyles from "@/components/marketing/volleyball-landing.module.css";
import type { LocalLanguage } from "@/lib/local-games";
import styles from "./local-discovery.module.css";

export { styles as localStyles };

export function LocalHeader({ lang, alternate }: { lang: LocalLanguage; alternate: string }) {
  const ar=lang==="ar";
  return <header className={styles.header}>
    <div className={styles.headerInner}>
      <Link href="/" aria-label="Playza" className={styles.brand}><AppLogo className="w-28" /></Link>
      <nav aria-label={ar?"القائمة الرئيسية":"Main navigation"} className={styles.headerNav}>
        <Link href="/">{ar?"الرئيسية":"Home"}</Link>
        <Link href="/games">{ar?"الماتشات":"Games"}</Link>
        <Link href="/courts">{ar?"الملاعب":"Courts"}</Link>
        <Link href="/academies">{ar?"الأكاديميات":"Academies"}</Link>
        <Link href="/tournaments">{ar?"البطولات":"Tournaments"}</Link>
      </nav>
      <div className={styles.headerActions}>
        <Link href={alternate} hrefLang={ar?"en":"ar-EG"} className={styles.languageLink}>{ar?"EN":"عربي"}</Link>
        <Link href="/games" className={styles.headerBook}><Plus size={19} aria-hidden="true"/>{ar?"حجز مباراة":"Book a game"}</Link>
        <Link href="/login" className={styles.loginLink} aria-label={ar?"تسجيل الدخول":"Log in"}><CircleUserRound size={25} aria-hidden="true" /><span className={styles.loginText}>{ar?"دخول":"Log in"}</span></Link>
      </div>
    </div>
  </header>;
}
export function LocalHero({lang,title,description,badge,gamesCount,ctaId="local-games"}:{
 lang:LocalLanguage;title:string;description:string;badge:string;gamesCount:number;ctaId?:string;
}) {
 const ar=lang==="ar";
 const isCityHub=(ar && title.includes("القاهرة الجديدة") && title.includes("التجمع")) || (!ar && title.includes("Tagamoa"));
 const mainTitle=isCityHub
   ? <>{ar?"ماتشات في التجمع":"Games in New Cairo"}<br/><span>{ar?"والقاهرة الجديدة":"& Tagamoa"}</span></>
   : ar && title.includes("في التجمع")
     ? <>{title.split("في التجمع")[0].trim()}<br/><span>في التجمع</span></>
     : !ar && title.includes("New Cairo")
       ? <>{title.split("in New Cairo")[0].trim()}<br/><span>in New Cairo</span></>
       : <>{title}</>;
 return <>
  <div className={styles.hero}>
    <div className={styles.heroInner}>
      <div className={styles.heroCopy}>
        <nav className={styles.breadcrumbs} aria-label={ar?"مسار الصفحة":"Breadcrumb"}><Link href="/">{ar?"الرئيسية":"Home"}</Link><span aria-hidden="true">‹</span><span>{badge}</span></nav>
        
        <h1 className={styles.heroTitle}>{mainTitle}</h1>
        <p className={styles.heroDescription}>{description}</p>
        <div className={styles.heroActions}>
          <a className={styles.mainButton} href={`#${ctaId}`}><Zap size={19} aria-hidden="true"/>{ar?"شوف الماتشات الآن":"See upcoming games"}</a>
          <Link className={styles.outlineButton} href="/games"><CalendarDays size={19} aria-hidden="true"/>{ar?"كل الماتشات":"All games"}</Link>
        </div>
      </div>
      <div className={styles.heroVisual} aria-label={ar?"ملعب طائرة وقت الغروب":"Volleyball court at sunset"} role="img">
        <div className={styles.heroImage} />
        <div className={styles.photoGlow} />

      </div>
    </div>
  </div>
 </>;
}

export function LocalSectionHeading({kicker,title,id,aside}:{kicker:string;title:string;id?:string;aside?:React.ReactNode}) {
 return <div className={styles.sectionHead}>
  <div className={styles.titleGroup}><span className={styles.titleIcon}><CalendarDays size={29} aria-hidden="true"/></span><div>{kicker&&<p className={styles.sectionKicker}>{kicker}</p>}<h2 id={id} className={styles.sectionTitle}>{title}</h2></div></div>
  {aside&&<div className={styles.sectionAside}>{aside}</div>}
 </div>;
}

export function LocalGameCards({lang,games}:{lang:LocalLanguage;games:PublicGame[]}) {
 const ar=lang==="ar";
 if(!games.length)return <div className={styles.empty}>{ar?"مفيش ماتشات متاحة دلوقتي في المنطقة دي. تابع جروب واتساب أو شوف باقي الماتشات.":"No available games at the moment. Follow our community group or browse other games."}</div>;
 // Exactly the same component and list layout used for upcoming games on the homepage.
 // Use the display-only guest adapter to avoid exposing private roster or payment data.
 return <div className="grid grid-cols-1 gap-4 text-start md:grid-cols-2 xl:grid-cols-4">
   {games.map(game => <GameCardShell
     key={game.id}
     layout="cinematic"
     deferPhotoLoading
     game={guestGameCard(game)}
     joined={false}
     detailsHref={publicGamePath(game.id)}
   />)}
 </div>;
}

export function LocalArchive({lang,games}:{lang:LocalLanguage;games:PublicGame[]}) {
 if(!games.length)return null;const ar=lang==="ar";
 return <details className={styles.archive}><summary><span><Trophy size={22}/>{ar?"ماتشات اتلعبت قبل كده":"Previous games"} <small>({games.length})</small></span><ChevronDown size={18}/></summary>
   <ul className={styles.archiveList}>{games.map(g=><li key={g.id} className={styles.archiveItem}><Link href={publicGamePath(g.id)}>{g.title}</Link><span className={styles.archiveDate}><time dateTime={g.game_date}>{g.game_date}</time> · {g.sport}</span></li>)}</ul>
  </details>;
}
export function LocalCourts({lang,courts}:{lang:LocalLanguage;courts:PublicCourt[]}) {
 if(!courts.length)return null;
 return <div className={styles.courtList}>{courts.map(c=><article key={c.id} className={styles.courtCard}><div className={styles.courtIcon}><LandPlot size={23}/></div><div><h3 className={styles.courtName}><Link href={`/p/${encodeURIComponent(c.id)}`}>{c.name}</Link></h3><p className={styles.courtArea}>{[c.area,c.governorate].filter(Boolean).join(" · ")}</p></div></article>)}</div>;
}
