"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search, MapPin, Star, CalendarDays, UsersRound, GraduationCap, Trophy, ChartNoAxesColumnIncreasing, LayoutGrid, BadgeCheck, CalendarCheck, Zap, Store, Heart, Volleyball } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SportIcon } from "@/components/marketing/sport-icons";
import type { PublicTeamDirectoryEntry } from "@/lib/types";
import styles from "./academies-premium-directory.module.css";

const sportLabels: Record<string,{ar:string;slug:string}> = {
  Volleyball:{ar:"كرة طائرة",slug:"volleyball"},
  Basketball:{ar:"كرة سلة",slug:"basketball"},
  Tennis:{ar:"تنس",slug:"tennis"},
  "Beach Volleyball":{ar:"كرة طائرة شاطئية",slug:"beach-volleyball"},
  Padel:{ar:"بادل",slug:"padel"},
};
function imageForSport(sport: string){
 const slug=sportLabels[sport]?.slug ?? "volleyball";
 return `/images/match-cards/${slug}.webp`;
}

export function AcademiesPremiumDirectory({teams, embedded=false}:{teams:PublicTeamDirectoryEntry[];embedded?:boolean}) {
 const {lang}=useI18n();
 const ar=lang==="ar";
 const [query,setQuery]=useState("");
 const [sport,setSport]=useState("all");
 const [area,setArea]=useState("all");
 const [showAll,setShowAll]=useState(false);
 const [favorites,setFavorites]=useState<string[]>([]);
 const academies=useMemo(()=>{
   const m=new Map<string,{id:string;name:string;slug:string;area:string;governorate:string;sports:string[];teams:PublicTeamDirectoryEntry[];minAge:number|null;maxAge:number|null}>();
   for(const team of teams){
      if(!team.academy?.slug)continue;
      const key=team.academy.slug;
      let item=m.get(key);
      if(!item){
        item={id:team.academy.id,name:team.academy.name,slug:team.academy.slug,
          area:team.academy.area??"",governorate:team.academy.governorate??"",
          sports:[],teams:[],minAge:null,maxAge:null};
        m.set(key,item);
      }
      item.teams.push(team);
      const sportName=team.sport?.name;
      if(sportName&&!item.sports.includes(sportName))item.sports.push(sportName);
      if(team.min_age!=null)item.minAge=item.minAge===null?team.min_age:Math.min(item.minAge,team.min_age);
      if(team.max_age!=null)item.maxAge=item.maxAge===null?team.max_age:Math.max(item.maxAge,team.max_age);
   }
   return [...m.values()];
 },[teams]);
 const sports=useMemo(()=>[...new Set(academies.flatMap(a=>a.sports))].sort((a,b)=>
   ["Volleyball","Basketball","Tennis"].indexOf(a)-["Volleyball","Basketball","Tennis"].indexOf(b)),[academies]);
 const areas=useMemo(()=>[...new Set(academies.map(a=>a.area||a.governorate).filter(Boolean))].sort(),[academies]);
 const shown=academies.filter(a=>(sport==="all"||a.sports.includes(sport))&&(area==="all"||a.area===area||a.governorate===area)&&
 (!query.trim()||[a.name,a.area,a.governorate,...a.sports,...a.teams.map(t=>t.name)].join(" ").toLowerCase().includes(query.toLowerCase().trim())));
 const visible=showAll?shown:shown.slice(0,6);
 const title=(name:string)=>ar?(sportLabels[name]?.ar??name):name;
 const location=(a:typeof academies[number])=>[a.area,a.governorate].filter(Boolean).join(" · ") || (ar?"مصر":"Egypt");
 const selectedOptions=["Volleyball","Basketball","Tennis"].filter(s=>sports.includes(s));
 const age=(a:typeof academies[number])=>a.minAge!=null&&a.maxAge!=null?`${a.minAge}–${a.maxAge}`:a.minAge!=null?`${a.minAge}+`:a.maxAge!=null?`${ar?"حتى ":"Up to "}${a.maxAge}`:ar?"كل الأعمار":"All ages";

 return <main className={styles.page} dir={ar?"rtl":"ltr"} lang={lang}>
   <div className={styles.wrap}>
     <section className={styles.hero}>
       <div className={styles.heroText}>
         <p className={styles.eyebrow}>{ar?"الأكاديميات":"Academies"}</p>
         <h1>{ar?<>اتدرّب. اتطور.<br/><em>والعب أحسن.</em></>:<>Train. Improve.<br/><em>Play Better.</em></>}</h1>
         <p className={styles.intro}>{ar?"اكتشف الأكاديميات الرياضية وبرامج التدريب المناسبة لسنك ومستواك.":"Discover sports academies and training programs that fit your sport and level."}</p>
         <div className={styles.heroActions}>
           <a href="#academies-list" className={styles.mainCta}>{ar?"اكتشف الأكاديميات":"Explore Academies"} <ArrowUpRight size={19}/></a>
           <Link href="/academy-management" className={styles.outlineCta}>{ar?"سجّل أكاديميتك":"List Your Academy"}</Link>
         </div>
       </div>
       <div className={styles.heroVisual} aria-hidden="true">
         <div className={styles.heroPhotoVolleyball}/>
         <div className={styles.heroPhotoBasketball}/>
         <div className={styles.heroPhotoTennis}/>
       </div>
     </section>
     <div className={styles.benefits} aria-label={ar?"مميزات التدريب":"Training benefits"}>
       {([
         [GraduationCap,ar?"مدربين متخصصين":"Professional Coaches"],
         [ChartNoAxesColumnIncreasing,ar?"كل المستويات":"All Skill Levels"],
         [CalendarCheck,ar?"برامج مرنة":"Flexible Programs"],
         [UsersRound,ar?"أطفال وكبار":"Kids & Adults"],
         [Trophy,ar?"تدريب للمنافسة":"Competitive Training"]
       ] as const).map(([Icon,text],i)=><span key={i}><Icon size={24}/>{text}</span>)}
     </div>
     <div className={styles.searchRow}>
       <label className={styles.search}><Search size={22}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false)}} placeholder={ar?"ابحث عن أكاديمية أو رياضة أو منطقة...":"Search academies, sports, or locations..."} aria-label={ar?"بحث الأكاديميات":"Search academies"}/></label>
       <label className={styles.area}><MapPin size={21}/><select value={area} onChange={e=>{setArea(e.target.value);setShowAll(false)}} aria-label={ar?"اختار المنطقة":"Choose location"}>
         <option value="all">{ar?"كل المناطق":"All Locations"}</option>
         {areas.map(x=><option key={x} value={x}>{x}</option>)}
       </select></label>
     </div>
     <nav className={styles.sports} aria-label={ar?"اختار الرياضة":"Choose sport"}>
       <button type="button" className={styles.sport} data-active={sport==="all"} onClick={()=>{setSport("all");setShowAll(false)}}><LayoutGrid size={28}/><b>{ar?"كل الرياضات":"All Sports"}</b></button>
       {selectedOptions.map(s=><button type="button" className={styles.sport} key={s} data-active={sport===s} onClick={()=>{setSport(s);setShowAll(false)}} style={{backgroundImage:`linear-gradient(0deg,rgba(23,8,41,.88),rgba(36,12,60,.28)),url("${imageForSport(s)}")`}}><span>{SportIcon({id:sportLabels[s]?.slug??"volleyball",size:31})}</span><b>{title(s)}</b></button>)}
       {sports.filter(s=>!selectedOptions.includes(s)).map(s=><button key={s} type="button" className={styles.sport} data-active={sport===s} onClick={()=>{setSport(s);setShowAll(false)}} style={{backgroundImage:`linear-gradient(0deg,rgba(23,8,41,.88),rgba(36,12,60,.28)),url("${imageForSport(s)}")`}}><Volleyball size={28}/><b>{title(s)}</b></button>)}
     </nav>
     <section id="academies-list" className={styles.results} aria-labelledby="academy-results-title">
       <div className={styles.heading}><h2 id="academy-results-title"><Star size={29}/>{ar?"الأكاديميات المتاحة":"Featured Academies"} <small>({shown.length})</small></h2>{shown.length>6&&<button type="button" onClick={()=>setShowAll(v=>!v)}>{showAll?(ar?"عرض أقل":"Show Less"):(ar?"عرض الكل":"View All")} <ArrowUpRight size={19}/></button>}</div>
       {shown.length===0?<p className={styles.empty}>{ar?"مفيش أكاديميات مطابقة للبحث حاليًا. جرّب رياضة أو منطقة تانية.":"No academies match your filters. Try another sport or location."}</p>:
       <div className={styles.cards}>{visible.map(a=>{
         const mainSport=a.sports[0]??"Volleyball";
         const favorite=favorites.includes(a.id);
         return <article key={a.id} className={styles.card}>
           <div className={styles.cardImage} style={{backgroundImage:`linear-gradient(180deg,rgba(17,7,31,.07),#1c092ce6),url("${imageForSport(mainSport)}")`}}>
             <span className={styles.sportBadge}>{title(mainSport)}</span>
             <button type="button" aria-label={favorite?(ar?"إزالة من المفضلة":"Remove favorite"):(ar?"إضافة للمفضلة":"Save favorite")} aria-pressed={favorite} className={styles.heart} onClick={()=>setFavorites(v=>favorite?v.filter(id=>id!==a.id):[...v,a.id])}><Heart size={21} fill={favorite?"#caff00":"none"}/></button>
           </div>
           <div className={styles.cardBody}>
             <div className={styles.logoInitial} aria-hidden="true">{a.name.slice(0,1).toUpperCase()}</div>
             <h3>{a.name}</h3>
             <p className={styles.program}>{a.teams[0]?.name ?? (ar?"تدريب رياضي":"Sports training")}</p>
             <p className={styles.place}><MapPin size={15}/>{location(a)}</p>
             <div className={styles.stats}><span><CalendarDays size={16}/>{a.teams.length} {ar?"برامج":"Programs"}</span><span><UsersRound size={16}/>{age(a)}</span></div>
             <Link href={`/a/${encodeURIComponent(a.slug)}`} className={styles.cardCta}>{ar?"تفاصيل الأكاديمية":"View Academy"} <ArrowUpRight size={19}/></Link>
           </div>
         </article>;
       })}</div>}
     </section>
     <section className={styles.ownerCta} aria-labelledby="academy-owner-heading">
       <Store size={49}/>
       <div><h2 id="academy-owner-heading">{ar?"عندك أكاديمية رياضية؟":"Own a Sports Academy?"}</h2><p>{ar?"سجّل أكاديميتك على بلايزا وعرّف اللاعبين ببرامج التدريب.":"List your academy on Playza and help players discover your training programs."}</p></div>
       <div className={styles.ownerDetails}><span><UsersRound size={23}/>{ar?"وصل للاعبين":"Reach Players"}</span><span><CalendarDays size={23}/>{ar?"نظّم برامجك":"Manage Programs"}</span></div>
       <Link href="/academy-management">{ar?"سجّل أكاديميتك":"List Your Academy"} <ArrowUpRight size={18}/></Link>
     </section>
     <section className={styles.programs} aria-labelledby="programs-heading">
       <h2 id="programs-heading"><CalendarDays size={27}/>{ar?"البرامج والتدريبات":"Programs & Training"}</h2>
       <p>{ar?"تصفح برامج التدريب حسب الرياضة والمستوى.":"Explore training programs across different sports and skill levels."}</p>
       <div className={styles.programGrid}>{selectedOptions.map(s=><button key={s} type="button" onClick={()=>{setSport(s);setShowAll(true);document.getElementById("academies-list")?.scrollIntoView({behavior:"smooth"})}} style={{backgroundImage:`linear-gradient(0deg,#220b38ee,transparent 68%),url("${imageForSport(s)}")`}}><strong>{title(s)}</strong><span>{ar?"برامج التدريب":"Training Programs"}</span><ArrowUpRight size={21}/></button>)}</div>
     </section>
   </div>
 </main>;
}
