"use client";

import { guestGameCard } from "@/lib/guest-games";
import { GameCardShell } from "@/components/games/game-card-shell";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Search, Trophy, Volleyball, LandPlot, GraduationCap, UsersRound, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppLogo } from "@/components/shared/app-logo";
import { publicGamePath } from "@/lib/game-discovery";
import { sportToSlug } from "@/lib/sport-slugs";
import { formatTime12h } from "@/lib/constants";
import type { PublicGame, PublicTournament } from "@/lib/public-games";
import type { PublicCourt } from "@/lib/public-playgrounds";
import type { PublicTeamDirectoryEntry } from "@/lib/types";
import styles from "./directory-experience.module.css";

type Kind = "games" | "courts" | "academies" | "tournaments";
type Props =
  | { kind: "games"; games: PublicGame[]; selectedSport?: string; availableSports?: string[] }
  | { kind: "courts"; courts: PublicCourt[]; selectedSport?: string; availableSports?: string[]; langOverride?: "ar" | "en" }
  | { kind: "academies"; teams: PublicTeamDirectoryEntry[] }
  | { kind: "tournaments"; tournaments: PublicTournament[]; selectedSport?: string; availableSports?: string[] };

const sportAr: Record<string,string> = {
  "Volleyball": "كرة طائرة", "Beach Volleyball": "طائرة شاطئية",
  "Basketball": "كرة سلة", "Padel": "بادل", "Tennis": "تنس",
  "Football": "كرة قدم", "Archery": "رماية بالقوس",
};
function sportLabel(name: string, ar: boolean) { return ar ? (sportAr[name] ?? name) : name; }
function dateLabel(date: string, ar: boolean) {
  return new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", timeZone: "Africa/Cairo" }).format(new Date(date + "T12:00:00Z"));
}
function shortenPlace(parts: (string|null|undefined)[]) { return [...new Set(parts.filter((x):x is string => !!x))].join(" · "); }

const kinds = {
  games: { en: ["Games", "Find your next game", "Choose a game and book your spot.", "Search games or locations", "Upcoming games"], ar: ["الماتشات", "لاقي ماتشك الجاي", "اختار ماتش واحجز مكانك.", "دور على ماتش أو منطقة", "الماتشات المتاحة"] },
  courts: { en: ["Courts", "Find your court", "Discover courts and book easily.", "Search courts or locations", "Available courts"], ar: ["الملاعب", "ملعبك في انتظارك", "اختار الملعب المناسب ليك.", "دور على ملعب أو منطقة", "الملاعب المتاحة"] },
  academies: { en: ["Academies", "Start your sports journey", "Find the academy for you.", "Search academies or sports", "Available academies"], ar: ["الأكاديميات", "ابدأ رحلتك الرياضية", "اختار الأكاديمية المناسبة ليك.", "دور على أكاديمية أو رياضة", "الأكاديميات المتاحة"] },
  tournaments: { en: ["Tournaments", "The competition starts here", "Discover tournaments and join in.", "Search tournaments or sports", "Available tournaments"], ar: ["البطولات", "المنافسة تبدأ هنا", "شوف البطولات وسجّل مع فريقك.", "دور على بطولة أو رياضة", "البطولات المتاحة"] },
} as const;

const nav = [
  { href: "/", en: "Home", ar: "الرئيسية" },
  { href: "/games", en: "Games", ar: "الماتشات" },
  { href: "/courts", en: "Courts", ar: "الملاعب" },
  { href: "/academies", en: "Academies", ar: "الأكاديميات" },
  { href: "/tournaments", en: "Tournaments", ar: "البطولات" },
] as const;

export function DirectoryExperience(props: Props) {
  const { lang: storedLang } = useI18n();
  const lang = props.kind === "courts" && props.langOverride === "ar" ? "ar" : storedLang;
  const ar = lang === "ar";
  const kind = props.kind;
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const [query, setQuery] = useState("");
  const [academySport, setAcademySport] = useState("");
  const words = kinds[kind][lang];
  const q = query.trim().toLocaleLowerCase();
  const matches = (value: string) => !q || value.toLocaleLowerCase().includes(q);
  const allSports = kind === "academies"
    ? [...new Set(props.teams.map(t => t.sport?.name).filter((x):x is string => !!x))]
    : [...new Set(props.availableSports ?? (kind === "games" ? props.games.map(g => g.sport) : kind === "tournaments" ? props.tournaments.map(t => t.sport).filter((x):x is string => !!x) : props.courts.map(c => c.sport?.name).filter((x):x is string => !!x)))];
  const chosen = kind === "academies" ? academySport : props.selectedSport ?? "";
  const filterHref = (sport: string) => sport ? `/${kind}?sport=${encodeURIComponent(sportToSlug(sport))}` : `/${kind}`;

  const games = props.kind !== "games" ? [] : props.games.filter(g => matches([g.title,g.sport,g.location,g.area,g.playground?.name,g.playground?.area].join(" ")));
  const courts = props.kind !== "courts" ? [] : props.courts.filter(c => matches([c.name,c.address,c.area,c.governorate,c.sport?.name].join(" ")));
  const teams = props.kind !== "academies" ? [] : props.teams.filter(t => (!chosen || t.sport?.name === chosen) && matches([t.name,t.academy.name,t.sport?.name,t.venue?.name,t.academy.area].join(" ")));
  const tournaments = props.kind !== "tournaments" ? [] : props.tournaments.filter(t => matches([t.name,t.sport,t.venue?.name,t.academy?.name,t.academy?.area].join(" ")));
  const count = kind === "games" ? games.length : kind === "courts" ? courts.length : kind === "academies" ? teams.length : tournaments.length;

  return <main className={styles.page} lang={lang} dir={ar ? "rtl" : "ltr"}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.logo} aria-label="Playza"><AppLogo className="w-28" /></Link>
      <nav className={styles.navigation} aria-label={copy("Main navigation", "القائمة الرئيسية")}>
        {nav.map(item => <Link href={item.href} key={item.href} aria-current={item.href === `/${kind}` ? "page" : undefined}>{item[lang]}</Link>)}
      </nav>
      <Link href="/games" className={styles.book}><Plus size={17}/>{copy("Book a game", "حجز مباراة")}</Link>
    </div></header>
    <div className={styles.shell}>
      <section className={styles.hero} aria-labelledby="directory-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{words[0]}</p>
          <h1 className={styles.title} id="directory-title">{words[1]}</h1>
          <p className={styles.subtitle}>{words[2]}</p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">{kind === "games" ? <Volleyball/> : kind === "courts" ? <LandPlot/> : kind === "academies" ? <GraduationCap/> : <Trophy/>}</div>
      </section>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <h2 className={styles.sectionTitle}>{copy("Explore", "دور على المناسب ليك")}</h2>
          <label className={styles.search}>
            <Search size={20} aria-hidden="true"/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={words[3]} aria-label={words[3]} type="search" />
          </label>
        </div>
        <nav className={styles.filters} aria-label={copy("Filter by sport", "اختار الرياضة")}>
          {kind === "academies" ? <>
            <button className={styles.chip} data-selected={!chosen} onClick={() => setAcademySport("")}>{copy("All", "الكل")}</button>
            {allSports.map(s => <button key={s} className={styles.chip} data-selected={chosen === s} onClick={() => setAcademySport(s)}>{sportLabel(s, ar)}</button>)}
          </> : <>
            <Link className={styles.chip} href={filterHref("")} aria-current={!chosen ? "page" : undefined}>{copy("All", "الكل")}</Link>
            {allSports.map(s => <Link key={s} className={styles.chip} href={filterHref(s)} aria-current={chosen === s ? "page" : undefined}>{sportLabel(s, ar)}</Link>)}
          </>}
        </nav>
      </div>
      <section aria-labelledby="directory-results">
        <h2 className={styles.sectionTitle} id="directory-results" style={{marginBottom:20}}>{words[4]} <span style={{fontSize:13,color:"#c3b3d4"}}>({count})</span></h2>
        {count === 0 ? <div className={styles.empty}>{copy("No results right now. Try a different filter.", "مفيش نتائج حاليًا. جرّب بحث تاني.")}</div> :
        <div className={kind === "games" ? styles.gameGrid : styles.grid}>
          {props.kind === "games" && games.map(g => <GameCardShell key={g.id} game={guestGameCard(g)} joined={false} layout="cinematic" detailsHref={publicGamePath(g.id)} deferPhotoLoading />)}
          {props.kind === "courts" && courts.map(c => <article key={c.id} className={styles.card}>
            <div className={styles.cardTop}><span className={styles.badge}>{sportLabel(c.sport?.name ?? "Sports",ar)}</span><span className={styles.status}>{copy("Court", "ملعب")}</span></div>
            <h2>{c.name}</h2><p className={styles.meta}><MapPin size={14} style={{display:"inline",verticalAlign:"middle"}}/> {shortenPlace([c.area,c.governorate])}</p>
            {c.address && <p className={styles.meta}>{c.address}</p>}
            <div className={styles.cardBottom}><strong className={styles.price}>{c.booking_price?.full_court != null ? copy(`EGP ${c.booking_price.full_court} / hour`,`${c.booking_price.full_court} جنيه / ساعة`) : copy("See prices", "شوف الأسعار")}</strong><Link href={`/p/${encodeURIComponent(c.id)}`} className={styles.action}>{copy("Court details", "تفاصيل الملعب")}<ArrowUpRight size={16}/></Link></div>
          </article>)}
          {props.kind === "academies" && teams.map(t => <article key={t.id} className={styles.card}>
            <div className={styles.cardTop}><span className={styles.badge}>{sportLabel(t.sport?.name ?? "Sports",ar)}</span><span className={styles.status}>{copy("Academy", "أكاديمية")}</span></div>
            <h2>{t.academy.name}</h2><p className={styles.meta}>{t.name}</p><p className={styles.meta}><MapPin size={14} style={{display:"inline",verticalAlign:"middle"}}/> {shortenPlace([t.venue?.name, t.academy.area,t.academy.governorate])}</p>
            <div className={styles.cardBottom}><strong className={styles.price}>{copy("Training", "تدريبات")}</strong><Link href={`/a/${t.academy.slug}`} className={styles.action}>{copy("Academy details", "تفاصيل الأكاديمية")}<ArrowUpRight size={16}/></Link></div>
          </article>)}
          {props.kind === "tournaments" && tournaments.map(t => <article key={t.id} className={styles.card}>
            <div className={styles.cardTop}><span className={styles.badge}>{sportLabel(t.sport ?? "Sports",ar)}</span><span className={styles.status}>{t.status === "upcoming" ? copy("Upcoming", "قادمة") : t.status === "in_progress" ? copy("In progress", "جارية") : t.status === "completed" ? copy("Completed", "انتهت") : copy("Canceled", "ملغاة")}</span></div>
            <h2>{t.name}</h2><p className={styles.meta}><MapPin size={14} style={{display:"inline",verticalAlign:"middle"}}/> {shortenPlace([t.venue?.name,t.academy?.area,t.academy?.governorate])}</p>
            <div className={styles.details}><span><CalendarDays size={14}/>{dateLabel(t.start_date,ar)}</span>{t.max_participants != null && <span><UsersRound size={14}/>{t.participant_count}/{t.max_participants}</span>}</div>
            <div className={styles.cardBottom}><strong className={styles.price}>{Number(t.participant_fee ?? 0) > 0 ? copy(`EGP ${t.participant_fee}`,`${t.participant_fee} جنيه`) : copy("Free entry", "دخول مجاني")}</strong><Link href={t.academy?.slug ? `/a/${t.academy.slug}` : "/academies"} className={styles.action}>{copy("Details", "التفاصيل")}<ArrowUpRight size={16}/></Link></div>
          </article>)}
        </div>}
      </section>
      <nav className={styles.footer} aria-label={copy("Explore Playza", "اكتشف بلايزا")}>
        {nav.filter(item => item.href !== `/${kind}` && item.href !== "/").map(item => <Link key={item.href} href={item.href}>{item[lang]}</Link>)}
      </nav>
    </div>
  </main>;
}
