"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, GraduationCap, Grid2X2, Heart, Map, MapPin, Navigation, Search, ShieldCheck, SlidersHorizontal, Sparkles, Store, Trophy, UsersRound, Volleyball, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SportIcon } from "@/components/marketing/sport-icons";
import type { PublicTeamDirectoryEntry } from "@/lib/types";
import styles from "./academies-premium-directory.module.css";

const sportInfo: Record<string, { ar: string; slug: string }> = {
  Volleyball: { ar: "كرة طائرة", slug: "volleyball" },
  Basketball: { ar: "كرة سلة", slug: "basketball" },
  Tennis: { ar: "تنس", slug: "tennis" },
  "Beach Volleyball": { ar: "كرة طائرة شاطئية", slug: "beach-volleyball" },
  Padel: { ar: "بادل", slug: "padel" },
};
const imageFor = (sport: string, kind: "court" | "filter" | "program" = "court") => {
  const slug = sportInfo[sport]?.slug ?? "volleyball";
  if (["volleyball", "basketball", "tennis"].includes(slug)) return `/images/academies/reference/${slug}-${kind}.webp`;
  return `/images/match-cards/${slug}.webp`;
};
type Academy = {
  id: string; name: string; slug: string; logo: string | null;
  teams: PublicTeamDirectoryEntry[]; sports: string[]; areas: string[];
  venues: NonNullable<PublicTeamDirectoryEntry["venue"]>[];
};
function academyLocation(team: PublicTeamDirectoryEntry) {
  return team.venue?.area || team.academy.area || team.venue?.governorate || team.academy.governorate || "";
}
function ageLabel(team: PublicTeamDirectoryEntry, ar: boolean) {
  if (team.min_age != null && team.max_age != null) return `${team.min_age}–${team.max_age}`;
  if (team.min_age != null) return `${team.min_age}+`;
  if (team.max_age != null) return `${ar ? "حتى " : "Up to "}${team.max_age}`;
  return ar ? "كل الأعمار" : "All ages";
}

export function AcademiesPremiumDirectory({ teams }: { teams: PublicTeamDirectoryEntry[]; embedded?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const [sport, setSport] = useState("all");
  const [area, setArea] = useState("all");
  const [query, setQuery] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState("all");
  const [gender, setGender] = useState("all");
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState<"grid" | "locations">("grid");
  const [sort, setSort] = useState<"name" | "programs">("name");
  const [showAll, setShowAll] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string[]>([]);

  const academies = useMemo(() => {
    const map = new Map<string, Academy>();
    for (const team of teams) {
      if (!team.academy?.slug) continue;
      let academy = map.get(team.academy.id);
      if (!academy) {
        academy = { id: team.academy.id, name: team.academy.name, slug: team.academy.slug,
          logo: team.academy.logo_url, teams: [], sports: [], areas: [], venues: [] };
        map.set(team.academy.id, academy);
      }
      academy.teams.push(team);
      if (team.sport?.name && !academy.sports.includes(team.sport.name)) academy.sports.push(team.sport.name);
      const location = academyLocation(team);
      if (location && !academy.areas.includes(location)) academy.areas.push(location);
      if (team.venue && !academy.venues.some(v => v.id === team.venue?.id)) academy.venues.push(team.venue);
    }
    return Array.from(map.values());
  }, [teams]);

  const sports = useMemo(() => [...new Set(academies.flatMap(a => a.sports))].sort((a,b) => {
    const priority = (name:string) => ["Volleyball", "Basketball", "Tennis"].indexOf(name);
    return (priority(a) < 0 ? 100 : priority(a)) - (priority(b) < 0 ? 100 : priority(b));
  }), [academies]);
  const areas = useMemo(() => [...new Set(academies.flatMap(a => a.areas))].sort((a,b) => a.localeCompare(b)), [academies]);
  const sportTitle = (name: string) => ar ? sportInfo[name]?.ar ?? name : name;
  // Match criteria against the *same training team* to avoid false matches between branches.
  const matches = (a: Academy) => {
    const q = query.trim().toLocaleLowerCase();
    if (q && ![a.name, ...a.areas, ...a.sports, ...a.teams.flatMap(t => [t.name,t.venue?.name??"",t.venue?.address??""])].join(" ").toLocaleLowerCase().includes(q)) return false;
    return a.teams.some(team => {
      if (sport !== "all" && team.sport?.name !== sport) return false;
      if (area !== "all" && academyLocation(team) !== area && team.venue?.governorate !== area && team.academy.governorate !== area) return false;
      const ageNum = age.trim() ? Number(age.trim()) : null;
      if (ageNum !== null && Number.isFinite(ageNum) && (ageNum < 1 || ageNum > 100 || (team.min_age !== null && ageNum < team.min_age) || (team.max_age !== null && ageNum > team.max_age))) return false;
      if (level !== "all" && team.skill_level !== level) return false;
      if (gender !== "all" && team.gender !== gender) return false;
      return true;
    });
  };
  const filtered = academies.filter(matches).sort((a,b) => sort === "programs" ? b.teams.length - a.teams.length : a.name.localeCompare(b.name));
  const visible = showAll ? filtered : filtered.slice(0, 6);
  const matchingTeams = (a: Academy) => a.teams.filter(t => (sport === "all" || t.sport?.name === sport) && (area === "all" || academyLocation(t) === area || t.venue?.governorate === area || t.academy.governorate === area) && (level === "all" || t.skill_level === level) && (gender === "all" || t.gender === gender) && (!age.trim() || !Number.isFinite(Number(age)) || ((t.min_age === null || Number(age) >= t.min_age) && (t.max_age === null || Number(age) <= t.max_age))));
  const programs = filtered.flatMap(a => matchingTeams(a).map(t => ({ team:t,academy:a }))).slice(0,6);
  const label = (key: string) => `${key} academy photo`;
  const reset = () => { setSport("all");setArea("all");setAge("");setLevel("all");setGender("all");setQuery("");setShowAll(false); };
  const ageSummary = (teamList: PublicTeamDirectoryEntry[]) => {
    const min = teamList.map(t=>t.min_age).filter((n):n is number=>n!==null);
    const max = teamList.map(t=>t.max_age).filter((n):n is number=>n!==null);
    if (!min.length && !max.length) return tr("All ages","كل الأعمار");
    return `${min.length ? Math.min(...min) : "?"}–${max.length ? Math.max(...max) : "+"}`;
  };
  return <main className={styles.page} data-academy-directory="" dir={ar?"rtl":"ltr"} lang={lang}>
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>{tr("SPORTS ACADEMIES","الأكاديميات الرياضية")}</span>
          <h1>{tr("Find Your Perfect","اختار الأكاديمية")}<br/><em>{tr("Academy.","المناسبة ليك.")}</em></h1>
          <p className={styles.intro}>{tr("Train better. Closer to home. Find the right program for your sport and level.","اتدرب أحسن، في مكان قريب منك. واختار برنامج يناسب سنك ومستواك.")}</p>
          <div className={styles.heroActions}>
            <a className={styles.mainCta} href="#academies-list">{tr("Explore Academies","اكتشف الأكاديميات")} <ArrowUpRight size={18}/></a>
            <Link className={styles.outlineCta} href="/academy-management">{tr("List Your Academy","سجل أكاديميتك")}</Link>
          </div>
        </div>
        <div className={styles.heroVisual} role="img" aria-label={tr("Volleyball, basketball and tennis sports photography","صور للكرة الطائرة والسلة والتنس")}>
          <span className={styles.heroLocation}><MapPin size={15}/>{tr("Find training near you","تدريب قريب منك")}</span>
        </div>
      </section>
      <section className={styles.sportSection} aria-label={tr("Choose your sport","اختار رياضتك")}>
        <div className={styles.sectionHeading}><h2>{tr("Choose Your Sport","اختار رياضتك")}</h2><span>{tr("One place. Every passion.","كل الرياضات في مكان واحد")}</span></div>
        <div className={styles.sports}>
          <button className={styles.sport} type="button" data-active={sport==="all"} onClick={()=>{setSport("all");setShowAll(false)}} aria-pressed={sport==="all"}><Grid2X2 size={29}/><b>{tr("All Sports","كل الرياضات")}</b></button>
          {sports.map(s=><button key={s} className={styles.sport} type="button" data-active={sport===s} aria-pressed={sport===s} onClick={()=>{setSport(s);setShowAll(false)}} style={{backgroundImage:`linear-gradient(0deg,rgba(19,8,31,.88),rgba(19,8,31,.12)),url("${imageFor(s,"filter")}")`}}>
            <SportIcon id={sportInfo[s]?.slug??"volleyball"} size={29}/><b>{sportTitle(s)}</b>
          </button>)}
        </div>
      </section>
      <section className={styles.searchSection} aria-label={tr("Search academies","بحث الأكاديميات")}>
        <label className={styles.searchBox}><Search size={21}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false)}} placeholder={tr("Search academies, sports or training...","ابحث عن أكاديمية أو رياضة أو تدريب...")}/>{query&&<button type="button" onClick={()=>setQuery("")} aria-label={tr("Clear search","امسح البحث")}><X size={17}/></button>}</label>
        <label className={styles.selectBox}><MapPin size={21}/><select value={area} onChange={e=>{setArea(e.target.value);setShowAll(false)}} aria-label={tr("Choose location","اختار المنطقة")}><option value="all">{tr("All Locations","كل المناطق")}</option>{areas.map(a=><option value={a} key={a}>{a}</option>)}</select><ChevronDown size={17}/></label>
        <button type="button" className={styles.filterButton} aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={20}/>{tr("Filters","الفلاتر")}</button>
      </section>
      {advanced&&<section className={styles.advanced} aria-label={tr("Advanced filters","فلاتر متقدمة")}>
        <div className={styles.advancedHeader}><strong>{tr("Fine-tune your search","خصص البحث")}</strong><button type="button" onClick={reset}>{tr("Clear filters","مسح الفلاتر")}</button></div>
        <div className={styles.filterGrid}>
          <label>{tr("Player age","سن اللاعب")}<input type="number" min="1" max="100" inputMode="numeric" value={age} onChange={e=>{setAge(e.target.value);setShowAll(false)}} placeholder={tr("Age","السن")}/></label>
          <label>{tr("Skill level","المستوى")}<select value={level} onChange={e=>{setLevel(e.target.value);setShowAll(false)}}><option value="all">{tr("All levels","كل المستويات")}</option>{[...new Set(teams.map(t=>t.skill_level).filter(Boolean))].map(v=><option key={v!} value={v!}>{v}</option>)}</select></label>
          <label>{tr("Training group","نوع المجموعة")}<select value={gender} onChange={e=>{setGender(e.target.value);setShowAll(false)}}><option value="all">{tr("All groups","كل المجموعات")}</option><option value="mixed">{tr("Mixed","مختلط")}</option><option value="boys">{tr("Boys","أولاد")}</option><option value="girls">{tr("Girls","بنات")}</option></select></label>
        </div>
      </section>}
      <section id="academies-list" className={styles.results} aria-labelledby="academy-results-title">
        <div className={styles.resultHeading}>
          <div><span className={styles.caption}>{tr("DISCOVER YOUR PLACE","اكتشف مكانك")}</span><h2 id="academy-results-title">{tr("Academies Near You","الأكاديميات المتاحة")} <small>({filtered.length})</small></h2><p>{tr("Explore by sport, location and age.","ابحث حسب الرياضة والمنطقة والسن.")}</p></div>
          <div className={styles.viewSwitch} role="group" aria-label={tr("View type","طريقة العرض")}><button type="button" aria-pressed={view==="grid"} className={view==="grid"?styles.activeView:""} onClick={()=>setView("grid")}><Grid2X2 size={17}/>{tr("Grid","كروت")}</button><button type="button" aria-pressed={view==="locations"} className={view==="locations"?styles.activeView:""} onClick={()=>setView("locations")}><Map size={17}/>{tr("Locations","الأماكن")}</button></div>
        </div>
        <div className={styles.sortRow}><span>{tr("Showing","عرض")} {filtered.length} {tr("academies","أكاديميات")}</span><label>{tr("Sort:","ترتيب:")} <select value={sort} onChange={e=>setSort(e.target.value as "name"|"programs")}><option value="name">{tr("Name","الاسم")}</option><option value="programs">{tr("Most programs","الأكثر برامج")}</option></select></label></div>
        {!filtered.length?<div className={styles.empty}><Search size={32}/><h3>{tr("No academies match your search","مفيش أكاديميات مطابقة للبحث")}</h3><button type="button" onClick={reset}>{tr("Reset search","امسح الفلاتر")}</button></div> : view==="grid" ?
          <div className={styles.cards}>{visible.map(a=>{
            const selectedTeams = matchingTeams(a);
            const first = selectedTeams[0] ?? a.teams[0];
            const sportName = first.sport?.name ?? a.sports[0] ?? "Volleyball";
            const location = academyLocation(first) || tr("Egypt","مصر");
            const favored = favorites.includes(a.id);
            return <article key={a.id} className={styles.card}>
              <div className={styles.cardImage} style={{backgroundImage:`linear-gradient(0deg,rgba(17,7,30,.52),transparent 55%),url("${imageFor(sportName)}")`}}>
                <span className={styles.sportBadge}>{sportTitle(sportName)}</span>
                <button type="button" className={styles.heart} aria-label={favored?tr("Remove favorite","إزالة من المفضلة"):tr("Save favorite","إضافة للمفضلة")} aria-pressed={favored} onClick={()=>setFavorites(v=>favored?v.filter(id=>id!==a.id):[...v,a.id])}><Heart size={19} fill={favored?"#caff00":"none"}/></button>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.logoInitial}>{a.logo&&!imageError.includes(a.id)?<img src={a.logo} alt="" onError={()=>setImageError(v=>[...v,a.id])}/>:a.name.charAt(0).toUpperCase()}</div>
                <h3>{a.name}</h3>
                <p className={styles.program}>{first.name}</p>
                <p className={styles.place}><MapPin size={15}/>{location}{a.venues.length>1&&<span className={styles.branchCount}>{a.venues.length} {tr("venues","أماكن تدريب")}</span>}</p>
                <div className={styles.stats}><span><CalendarDays size={16}/>{selectedTeams.length} {tr("programs","برامج")}</span><span><UsersRound size={16}/>{ageSummary(selectedTeams)}</span></div>
                <Link className={styles.cardCta} href={`/a/${encodeURIComponent(a.slug)}`}>{tr("View Academy","عرض الأكاديمية")} <ArrowUpRight size={19}/></Link>
              </div>
            </article>;
          })}</div>:
          <div className={styles.locationsGrid}>{filtered.flatMap(a=>a.venues.length?a.venues.map(v=>({academy:a,venue:v})):[{academy:a,venue:null}]).map(({academy:a,venue:v},i)=><article className={styles.locationCard} key={`${a.id}-${v?.id??i}`}><MapPin size={22}/><div><h3>{v?.name||a.name}</h3><p>{[v?.area||a.areas[0],v?.governorate,v?.address].filter(Boolean).join(" · ")}</p><small>{a.name}</small></div><div className={styles.locationActions}>{v?.location_link&&/^https:\/\//i.test(v.location_link)&&<a href={v.location_link} target="_blank" rel="noopener noreferrer"><Navigation size={15}/>{tr("Directions","الاتجاهات")}</a>}<Link href={`/a/${encodeURIComponent(a.slug)}`}>{tr("Academy","الأكاديمية")} <ArrowUpRight size={15}/></Link></div></article>)}</div>}
        {view==="grid"&&filtered.length>6&&<button className={styles.more} type="button" onClick={()=>setShowAll(v=>!v)}>{showAll?tr("Show less","عرض أقل"):tr("View all academies","عرض كل الأكاديميات")} <ArrowRight size={18}/></button>}
      </section>
      {programs.length>0&&<section className={styles.programs} id="training-programs">
        <div className={styles.sectionHeading}><div><span className={styles.caption}>{tr("START TRAINING","ابدأ التمرين")}</span><h2><CalendarDays size={26}/>{tr("Training Programs","برامج التدريب")}</h2><p>{tr("Browse real programs from the academies above.","استكشف البرامج الفعلية للأكاديميات المتاحة.")}</p></div></div>
        <div className={styles.programGrid}>{programs.map(({team,academy:a})=><Link href={`/a/${encodeURIComponent(a.slug)}`} className={styles.programCard} key={team.id}><div className={styles.programPhoto} style={{backgroundImage:`url("${imageFor(team.sport?.name??"Volleyball","program")}")`}}/><div className={styles.programDetails}><span>{sportTitle(team.sport?.name??"")}</span><h3>{team.name}</h3><p>{a.name}</p><div className={styles.programFacts}><span><UsersRound size={15}/>{ageLabel(team,ar)}</span><span><Sparkles size={15}/>{team.skill_level||tr("All levels","كل المستويات")}</span>{team.venue?.area&&<span><MapPin size={15}/>{team.venue.area}</span>}</div><ArrowUpRight className={styles.programArrow} size={20}/></div></Link>)}</div>
      </section>}
      <section className={styles.benefits} aria-label={tr("Why Playza","مميزات بلايزا")}><h2>{tr("Why Train on Playza?","ليه تتدرب مع بلايزا؟")}</h2><div className={styles.benefitCards}><div><MapPin/><span><b>{tr("Training locations","أماكن التدريب")}</b><small>{tr("See where each team trains.","اعرف مكان تدريب كل فريق.")}</small></span></div><div><CalendarDays/><span><b>{tr("Training programs","برامج التدريب")}</b><small>{tr("Compare available teams.","قارن بين البرامج المتاحة.")}</small></span></div><div><Trophy/><span><b>{tr("Multiple sports","رياضات متنوعة")}</b><small>{tr("Explore your favorite sport.","اكتشف رياضتك المفضلة.")}</small></span></div><div><ShieldCheck/><span><b>{tr("Clear details","تفاصيل واضحة")}</b><small>{tr("Sport, age and location together.","الرياضة والسن والمكان في كارت واحد.")}</small></span></div></div></section>
      <section className={styles.ownerCta}><Store size={46}/><div><h2>{tr("Own a Sports Academy?","عندك أكاديمية رياضية؟")}</h2><p>{tr("Manage training teams, programs and bookings with Playza.","نظّم فرقك وبرامج التدريب والحجوزات على بلايزا.")}</p></div><Link href="/academy-management">{tr("List Your Academy","سجل أكاديميتك")} <ArrowUpRight size={19}/></Link></section>
    </div>
  </main>;
}
