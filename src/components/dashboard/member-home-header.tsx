"use client";

import { authLink } from "@/lib/auth-redirect";
import { isGuestBrowsePath } from "@/lib/guest-access";

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
  { href: "/academies", en: "Academies & training", ar: "أكاديميات وتدريب", photo: "0% 100%", wide: true },
  { href: "/dashboard/tournaments", en: "Tournaments", ar: "بطولات", photo: "100% 0%" },
  { href: "/academy-bookings", en: "My training bookings", ar: "حجوزات تدريبي", photo: "100% 100%" },
  { href: "/profile#evaluations", en: "My progress", ar: "تطوري وتقييمي", photo: "0% 0%" },
];
const sports = [
  { name: "Tennis", ar: "تنس", slug: "tennis" },
  { name: "Padel", ar: "بادل", slug: "padel" },
  { name: "Basketball", ar: "كرة سلة", slug: "basketball" },
  { name: "Volleyball", ar: "كرة طائرة", slug: "volleyball" },
  { name: "Beach Volleyball", ar: "طائرة شاطئية", slug: "beach-volleyball" },
  { name: "Archery", ar: "رماية بالقوس", slug: "archery" },
];

export function MemberHomeHeader({ guest = false, profile, onSearchChange, name, children, selectedSport = "all", onSportChange }: { onSearchChange?: (value: string) => void; profile?: Profile; guest?: boolean; selectedSport?: string; onSportChange?: (sport: string) => void; name?: string; children?: ReactNode }) {
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
      <div className={styles.heroCopy}><h1>{ar ? "هنلعب إيه النهاردة؟" : <>Hanel3ab eh<br />el naharda?</>}</h1><p>{ar ? "لاقي ماتش، قابل لاعبين وخليك نشيط مع بلايزا." : "Find a game, join players, and stay active with Playza."}</p></div>
      <form action="#member-live-games" className={styles.heroSearch} onSubmit={event => { event.preventDefault(); onSearchChange?.(String(new FormData(event.currentTarget).get("search") ?? "")); document.getElementById("member-live-games")?.scrollIntoView({ behavior: "smooth" }); }}><Search aria-hidden="true" size={24} /><input name="search" type="search" aria-controls="member-live-games" onChange={event => onSearchChange?.(event.currentTarget.value)} aria-label={ar ? "دور على ماتش أو ملعب" : "Search games or courts"} placeholder={ar ? "دور على ماتش أو ملعب…" : "Dawer ‘ala match, ryada, aw makan…"} /><button type="submit"><Search size={20} aria-hidden="true" />{ar ? "لاقي ماتش" : "Find a Game"}</button><DashboardCreateGameButton sport={selectedSport} profile={profile} /></form>
    </section>
    <div className={styles.welcome}>
      <div><p className={styles.eyebrow}>{ar ? "يوم جديد. ماتش جديد." : "A new day. A new game."}</p><h1>{name ? (ar ? `أهلاً، ${name.split(" ")[0]}` : `Hey, ${name.split(" ")[0]}`) : (ar ? "جاهز نلعب؟" : "Ready to play?")}</h1><Link href="/playgrounds" className={styles.location}><MapPin size={14} aria-hidden="true" />{ar ? "اكتشف ملعبك الجاي" : "Find your next court"}</Link></div>
      <button type="button" onClick={() => void share()} className={styles.share}><Share2 size={15} aria-hidden="true" /><span>{ar ? "اعزم صاحبك" : "Invite a friend"}</span></button>
    </div>
    <div className={styles.sportsHeader}><h2>{ar ? "اختار رياضتك" : "Choose Your Sport"}</h2><button type="button" aria-pressed={selectedSport === "all"} aria-controls="member-live-games" onClick={() => onSportChange?.("all")}>{ar ? "كل الرياضات" : "All Sports"}<span aria-hidden="true"> →</span></button></div>
    <nav className={styles.sports} aria-label={ar ? "الرياضات" : "Browse by sport"}><button type="button" className={styles.allSports} aria-pressed={selectedSport === "all"} aria-controls="member-live-games" onClick={() => onSportChange?.("all")}><LayoutGrid size={24} /><span>{ar ? "كل الرياضات" : "All Sports"}</span></button>{sports.map(sport => <button type="button" key={sport.slug} aria-pressed={selectedSport === sport.name} aria-controls="member-live-games" onClick={() => onSportChange?.(sport.name)}><span className={styles.sportIcon}>{SportIcon({ id: sport.slug, size: 32 })}</span><span>{ar ? sport.ar : sport.name}</span></button>)}</nav>
    {children}
    <h2 className={styles.discoverTitle}>{ar ? "اكتشف المزيد على بلايزا" : "Discover More on Playza"}</h2>
    <nav className={styles.categories} aria-label={ar ? "اختار نشاطك" : "Explore activities"}>
      {categories.map(category => <Link key={category.href} href={guest ? category.href === "/academies" ? "/dashboard/academies" : isGuestBrowsePath(category.href) ? category.href : authLink("/login", category.href) : category.href} className={`${styles.category} ${category.wide ? styles.wide : ""}`}><span className={styles.categoryIcon}>{category.href === "/academies" ? <GraduationCap /> : category.href.includes("tournaments") ? <Trophy /> : category.href.includes("profile") ? <TrendingUp /> : <CalendarDays />}</span><span aria-hidden="true" className={styles.categoryPhoto} style={{ backgroundPosition: category.photo }} /><span className={styles.shade} aria-hidden="true" /><strong>{ar ? category.ar : category.en}</strong><ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" /></Link>)}
    </nav>
  </div>;
}
