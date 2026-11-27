import Link from "next/link";
import { ArrowUpRight, ArrowLeft, CalendarDays, Clock3, MapPin, Volleyball, Trophy, LandPlot, ChevronDown, Zap, UsersRound, CalendarCheck2, ShieldCheck, LogIn } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import type { PublicGame } from "@/lib/public-games";
import type { PublicCourt } from "@/lib/public-playgrounds";
import { publicGamePath, gamePlace } from "@/lib/game-discovery";
import { formatTime12h } from "@/lib/constants";
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
        <Link href="/login" className={styles.loginLink}><LogIn size={17} aria-hidden="true" />{ar?"دخول":"Log in"}</Link>
      </div>
    </div>
  </header>;
}
function AirborneVolleyball() {
  return <svg className={styles.photoBall} viewBox="0 0 180 180" role="presentation" aria-hidden="true">
    <defs>
      <radialGradient id="playza-volley-hero-ball" cx=".3" cy=".19" r=".85">
        <stop stopColor="#ffdf73"/><stop offset=".4" stopColor="#f9a720"/><stop offset=".72" stopColor="#ed7d13"/><stop offset="1" stopColor="#a84e11"/>
      </radialGradient>
      <filter id="playza-ball-shadow"><feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#110924" floodOpacity=".45"/></filter>
    </defs>
    <g filter="url(#playza-ball-shadow)">
      <circle cx="90" cy="90" r="82" fill="url(#playza-volley-hero-ball)" stroke="#fff3c2" strokeWidth="3"/>
      <path d="M20 46C58 34 88 57 105 83C126 115 134 143 121 165C148 155 165 130 171 100C151 78 135 53 121 15C83 5 40 19 20 46Z" fill="#f8f3dc" stroke="#12234e" strokeWidth="7"/>
      <path d="M13 77C45 70 57 85 69 112C78 135 80 155 66 171C31 163 9 126 8 96Z" fill="#183c9a" stroke="#fff7de" strokeWidth="4"/>
      <path d="M49 16C54 47 70 51 90 54C117 60 141 44 141 30" fill="none" stroke="#12307a" strokeWidth="11"/>
      <path d="M85 172C104 141 101 118 89 96" fill="none" stroke="#fff8da" strokeWidth="6"/>
      <ellipse cx="61" cy="36" rx="38" ry="13" fill="#fff" opacity=".18" transform="rotate(-28 61 36)"/>
    </g>
  </svg>;
}
export function LocalHero({lang,title,description,badge,gamesCount,ctaId="local-games"}:{
 lang:LocalLanguage;title:string;description:string;badge:string;gamesCount:number;ctaId?:string;
}) {
 const ar=lang==="ar";
 const isBeach=title.toLowerCase().includes("beach")||title.includes("شاطئية");
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
        <p className={styles.eyebrow}>{ar?"PLAYZA / العب في التجمع":"PLAYZA / NEW CAIRO"}</p>
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
        <div className={styles.limeSlash} aria-hidden="true"/>
        <div className={styles.purpleCurve} aria-hidden="true"/>
        <AirborneVolleyball/>
        <div className={styles.floatBadge}>
          <Volleyball size={36} aria-hidden="true"/>
          <span className={styles.floatBadgeDivider}/>
          <span><strong>{gamesCount}</strong><small>{ar?"ماتشات متاحة الآن":"games available"}</small></span>
        </div>
      </div>
    </div>
  </div>
  <div className={styles.band}><div className={styles.bandInner}>
    <span><Zap size={25}/>{ar?"حجز سريع وآمن":"Quick booking"}</span>
    <span><CalendarCheck2 size={25}/>{ar?"تابع المواعيد الجديدة":"New game updates"}</span>
    <span><MapPin size={25}/>{ar?"ملاعب في التجمع":"New Cairo courts"}</span>
    <span><UsersRound size={25}/>{ar?"العب مع ناس جديدة":"Meet new players"}</span>
  </div></div>
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
 return <div className={styles.cards}>{games.map(g=>{
  const free=Boolean(g.host_pays)||g.share_price===0;
  const cost=free?(ar?"مجاني":"Free"):g.share_price!=null?`${g.share_price} ${ar?"جنيه":"EGP"}`:(ar?"اسأل عن السعر":"Ask price");
  const date=new Intl.DateTimeFormat(ar?"ar-EG":"en-GB",{day:"numeric",month:"long",timeZone:"Africa/Cairo"}).format(new Date(`${g.game_date}T12:00:00Z`));
  return <article key={g.id} className={styles.gameCard}>
   <div className={styles.cardDecor} aria-hidden="true"><div className={styles.cardNet}/></div>
   <div className={styles.cardContent}>
     <div className={styles.cardBadge}><Volleyball size={16} aria-hidden="true"/>{g.sport}</div>
     <h3 className={styles.gameName}><Link href={publicGamePath(g.id)}>{g.title}</Link></h3>
     <p className={styles.gameVenue}><MapPin size={17} aria-hidden="true"/>{gamePlace(g)||(ar?"التجمع الخامس":"New Cairo")}</p>
     <div className={styles.cardBottom}>
       <span className={styles.detail}><CalendarDays size={18} aria-hidden="true"/><time dateTime={g.game_date}>{date}</time></span>
       <span className={styles.detail}><Clock3 size={18} aria-hidden="true"/>{formatTime12h(g.start_time,lang)}</span>
       <strong className={styles.price}>{cost}<span>{ar?" / فرد":" / player"}</span></strong>
       <Link className={styles.cardButton} href={publicGamePath(g.id)}>{g.status==="full"?(ar?"تفاصيل الماتش":"Game details"):(ar?"احجز مكانك":"Book your place")}<ArrowUpRight size={17} aria-hidden="true"/></Link>
     </div>
   </div>
  </article>;
 })}</div>;
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
