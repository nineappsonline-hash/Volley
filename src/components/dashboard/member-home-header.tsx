"use client";


import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, MapPin, Share2, Search, LayoutGrid, GraduationCap, Trophy, TrendingUp, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { SportIcon } from "@/components/marketing/sport-icons";
import { DashboardCreateGameButton } from "./create-game-button";
import type { Profile } from "@/lib/types";
import styles from "./member-home.module.css";

const categories = [
  { href: "/academies", en: "Academies & training", ar: "أكاديميات وتدريب", descriptionEn: "Discover academies and improve your skills", descriptionAr: "اكتشف الأكاديميات وطوّر مهاراتك", image: "academies", photo: "0% 100%", wide: true, icon: GraduationCap },
  { href: "/dashboard/tournaments", en: "Tournaments", ar: "البطولات", descriptionEn: "Join and compete in tournaments", descriptionAr: "شارك في البطولات ونافس غيرك", image: "tournaments", photo: "100% 0%", icon: Trophy },
  { href: "/academy-bookings", en: "My training bookings", ar: "حجوزات تدريبي", descriptionEn: "Manage your training reservations", descriptionAr: "تابع ونظّم حجوزات تدريبك", image: "training-bookings", photo: "100% 100%", icon: CalendarDays },
  { href: "/profile#evaluations", en: "My progress", ar: "تطوري وتقييمي", descriptionEn: "Track your performance and growth", descriptionAr: "تابع مستواك وتطور أدائك", image: "progress", photo: "0% 0%", icon: TrendingUp },
];
const guestCategories = [
  { href: "/games", en: "Games", ar: "الماتشات", photo: "0% 0%", wide: true },
  { href: "/courts", en: "Courts", ar: "الملاعب", photo: "100% 100%" },
  { href: "/academies", en: "Academies", ar: "الأكاديميات", photo: "0% 100%" },
  { href: "/tournaments", en: "Tournaments", ar: "البطولات", photo: "100% 0%" },
];
const sports = [
  { name: "Tennis", ar: "تنس", slug: "tennis" },
  { name: "Padel", ar: "بادل", slug: "padel" },
  { name: "Basketball", ar: "كرة سلة", slug: "basketball" },
  { name: "Volleyball", ar: "كرة طائرة", slug: "volleyball" },
  { name: "Beach Volleyball", ar: "طائرة شاطئية", slug: "beach-volleyball" },
  { name: "Archery", ar: "رماية بالقوس", slug: "archery" },
];

export function MemberHomeHeader({ guest = false, showExplore = true, profile, onSearchChange, name, children, selectedSport = "all", onSportChange }: { onSearchChange?: (value: string) => void; profile?: Profile; guest?: boolean; showExplore?: boolean; selectedSport?: string; onSportChange?: (sport: string) => void; name?: string; children?: ReactNode }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  async function share() {
    const url = `${window.location.origin}/games`;
    try {
      if (navigator.share) await navigator.share({ title: "Playza", text: ar ? "تعالى نلعب مع بلايزا" : "Find your next game with Playza", url });
      else { await navigator.clipboard.writeText(url); toast.success(ar ? "اتنسخ رابط الماتشات" : "Game discovery link copied"); }
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) toast.error(ar ? "تعذر المشاركة، حاول تاني" : "Could not share. Please try again."); }
  }
  return <div className={styles.homeHeader}>
    <section className={styles.desktopHero} aria-label={ar ? "اكتشف ماتشك الجاي" : "Find your next game"}>
      <div className={styles.heroCopy}><h1>{ar ? "هنلعب إيه النهاردة؟" : <>Hanel3ab eh<br />el naharda?</>}</h1><p>{ar ? "اختار الرياضة والمكان واحجز ماتشك." : "Pick your sport and location. Book a game."}</p></div>
      <form action="#member-live-games" className={styles.heroSearch} onSubmit={event => { event.preventDefault(); onSearchChange?.(String(new FormData(event.currentTarget).get("search") ?? "")); document.getElementById("member-live-games")?.scrollIntoView({ behavior: "smooth" }); }}><Search aria-hidden="true" size={24} /><input name="search" type="search" aria-controls="member-live-games" onChange={event => onSearchChange?.(event.currentTarget.value)} aria-label={ar ? "دور على ماتش أو ملعب" : "Search games or courts"} placeholder={ar ? "دور على ماتش أو ملعب…" : "Dawer ‘ala match, ryada, aw makan…"} /><button type="submit"><Search size={20} aria-hidden="true" />{ar ? "دوّر على ماتش" : "Find a Game"}</button><DashboardCreateGameButton sport={selectedSport} profile={profile} /></form>
    </section>
    <div className={styles.welcome}>
      <div><p className={styles.eyebrow}>{ar ? "يوم جديد. ماتش جديد." : "A new day. A new game."}</p><h1>{name ? (ar ? `أهلاً، ${name.split(" ")[0]}` : `Hey, ${name.split(" ")[0]}`) : (ar ? "جاهز نلعب؟" : "Ready to play?")}</h1><Link href="/playgrounds" className={styles.location}><MapPin size={14} aria-hidden="true" />{ar ? "اكتشف ملعبك الجاي" : "Find your next court"}</Link></div>
      <button type="button" onClick={() => void share()} className={styles.share}><Share2 size={15} aria-hidden="true" /><span>{ar ? "اعزم صاحبك" : "Invite a friend"}</span></button>
    </div>
    <div className={styles.sportsHeader}><h2>{ar ? "اختار رياضتك" : "Choose Your Sport"}</h2><button type="button" aria-pressed={selectedSport === "all"} aria-controls="member-live-games" onClick={() => onSportChange?.("all")}>{ar ? "كل الرياضات" : "All Sports"}<span aria-hidden="true"> →</span></button></div>
    <nav className={styles.sports} aria-label={ar ? "الرياضات" : "Browse by sport"}><button type="button" className={styles.allSports} aria-pressed={selectedSport === "all"} aria-controls="member-live-games" onClick={() => onSportChange?.("all")}><LayoutGrid size={24} /><span>{ar ? "كل الرياضات" : "All Sports"}</span></button>{sports.map(sport => <button type="button" key={sport.slug} aria-pressed={selectedSport === sport.name} aria-controls="member-live-games" onClick={() => onSportChange?.(sport.name)}><span className={styles.sportIcon}>{SportIcon({ id: sport.slug, size: 32 })}</span><span>{ar ? sport.ar : sport.name}</span></button>)}</nav>
    {children}
    {showExplore && (guest ? <>
      <h2 className={styles.discoverTitle}>{ar ? "اكتشف على بلايزا" : "Explore Playza"}</h2>
      <nav className={styles.categories} aria-label={ar ? "اختار نشاطك" : "Explore activities"}>
        {guestCategories.map(category => <Link key={category.href} href={category.href} className={`${styles.category} ${category.wide ? styles.wide : ""}`}><span className={styles.categoryIcon}>{category.href === "/academies" ? <GraduationCap /> : category.href.includes("tournaments") ? <Trophy /> : category.href.includes("courts") ? <MapPin /> : <CalendarDays />}</span><span aria-hidden="true" className={styles.categoryPhoto} style={{ backgroundPosition: category.photo }} /><span className={styles.shade} aria-hidden="true" /><strong>{ar ? category.ar : category.en}</strong><ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" /></Link>)}
      </nav>
    </> : <section className={styles.premiumExplore} aria-labelledby="explore-playza-heading">
      <header className={styles.premiumExploreHeader}>
        <h2 id="explore-playza-heading">{ar ? <>اكتشف <em>بلايزا</em></> : <>Explore <em>Playza</em></>}</h2>
        <p>{ar ? "طرق أكتر للعب والتدريب والمنافسة" : "More ways to play, train and compete"}</p>
      </header>
      <nav className={styles.premiumCategories} aria-label={ar ? "اكتشف المزيد على بلايزا" : "Explore Playza"}>
        {categories.map(category => {
          const Icon = category.icon;
          return <Link key={category.href} href={category.href} className={styles.premiumCategory} aria-label={ar ? category.ar : category.en}>
            <span aria-hidden="true" className={styles.premiumCategoryPhoto} style={{ backgroundImage: `url("/images/explore/${category.image}.webp")` }} />
            <span aria-hidden="true" className={styles.premiumCategoryShade} />
            <span className={styles.premiumCategoryContent}>
              <span className={styles.premiumCategoryIcon}><Icon size={30} strokeWidth={2.4} aria-hidden="true" /></span>
              <strong>{ar ? category.ar : category.en}</strong>
              <span className={styles.premiumCategoryDescription}>{ar ? category.descriptionAr : category.descriptionEn}</span>
            </span>
            <span aria-hidden="true" className={styles.premiumCategoryArrow}><ArrowUpRight size={23} /></span>
          </Link>;
        })}
      </nav>
    </section>)}
  </div>;
}
