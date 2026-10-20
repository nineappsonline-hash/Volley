"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, MapPin, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { SportIcon } from "@/components/marketing/sport-icons";
import styles from "./member-home.module.css";

const categories = [
  { href: "/dashboard/games", en: "Friendly games", ar: "مباريات ودية", photo: "100% 0%", wide: true },
  { href: "/academies", en: "Academies & training", ar: "أكاديميات وتدريب", photo: "0% 100%", wide: true },
  { href: "/dashboard/tournaments", en: "Tournaments", ar: "بطولات", photo: "100% 0%" },
  { href: "/playgrounds", en: "Court rentals", ar: "حجز ملاعب", photo: "0% 0%" },
  { href: "/academy-bookings", en: "My training bookings", ar: "حجوزات تدريبي", photo: "0% 100%" },
  { href: "/profile#evaluations", en: "My progress", ar: "تطوري وتقييمي", photo: "0% 0%" },
];
const sports = [
  { name: "Tennis", ar: "تنس", slug: "tennis" },
  { name: "Volleyball", ar: "كرة طائرة", slug: "volleyball" },
  { name: "Beach Volleyball", ar: "طائرة شاطئية", slug: "beach-volleyball" },
  { name: "Archery", ar: "رماية بالقوس", slug: "archery" },
];

export function MemberHomeHeader({ name, children, selectedSport = "all", onSportChange }: { selectedSport?: string; onSportChange?: (sport: string) => void; name?: string; children?: ReactNode }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  async function share() {
    const url = `${window.location.origin}/games`;
    try {
      if (navigator.share) await navigator.share({ title: "Playza", text: ar ? "تعالى نلعب مع بلايزا" : "Find your next game with Playza", url });
      else { await navigator.clipboard.writeText(url); toast.success(ar ? "اتنسخ رابط المباريات" : "Game discovery link copied"); }
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) toast.error(ar ? "تعذر المشاركة، حاول تاني" : "Could not share. Please try again."); }
  }
  return <div className={styles.homeHeader}>
    <div className={styles.welcome}>
      <div><p className={styles.eyebrow}>{ar ? "يوم جديد. مباراة جديدة." : "A new day. A new game."}</p><h1>{name ? (ar ? `أهلاً، ${name.split(" ")[0]}` : `Hey, ${name.split(" ")[0]}`) : (ar ? "جاهز نلعب؟" : "Ready to play?")}</h1><Link href="/playgrounds" className={styles.location}><MapPin size={14} aria-hidden="true" />{ar ? "اكتشف ملعبك الجاي" : "Find your next court"}</Link></div>
      <button type="button" onClick={() => void share()} className={styles.share}><Share2 size={15} aria-hidden="true" /><span>{ar ? "اعزم صاحبك" : "Invite a friend"}</span></button>
    </div>
    <div className={styles.sportsHeader}><h2>{ar ? "العب رياضتك" : "Play your sport"}</h2><button type="button" aria-pressed={selectedSport === "all"} aria-controls="member-live-games" onClick={() => onSportChange?.("all")}>{ar ? "كل الرياضات" : "All sports"}</button></div>
    <nav className={styles.sports} aria-label={ar ? "الرياضات" : "Browse by sport"}>{sports.map(sport => <button type="button" key={sport.slug} aria-pressed={selectedSport === sport.name} aria-controls="member-live-games" onClick={() => onSportChange?.(sport.name)}><span className={styles.sportIcon}>{SportIcon({ id: sport.slug, size: 32 })}</span><span>{ar ? sport.ar : sport.name}</span></button>)}</nav>
    {children}
    <nav className={styles.categories} aria-label={ar ? "اختار نشاطك" : "Explore activities"}>
      {categories.map(category => <Link key={category.href} href={category.href} className={`${styles.category} ${category.wide ? styles.wide : ""}`}><span aria-hidden="true" className={styles.categoryPhoto} style={{ backgroundPosition: category.photo }} /><span className={styles.shade} aria-hidden="true" /><strong>{ar ? category.ar : category.en}</strong><ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" /></Link>)}
    </nav>
  </div>;
}
