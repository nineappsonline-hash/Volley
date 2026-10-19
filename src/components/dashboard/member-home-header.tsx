"use client";

import Link from "next/link";
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
  { href: "/parent", en: "Family & kids", ar: "العيلة والأطفال", photo: "100% 0%" },
  { href: "/academy-bookings", en: "My training bookings", ar: "حجوزات تدريبي", photo: "0% 100%" },
  { href: "/sports/archery", en: "Archery", ar: "الرماية بالقوس", photo: "100% 100%" },
  { href: "/profile#evaluations", en: "My progress", ar: "تطوري وتقييمي", photo: "0% 0%" },
];
const sports = [
  { name: "Tennis", ar: "تنس", slug: "tennis", href: "/dashboard/games?sport=Tennis" },
  { name: "Volleyball", ar: "كرة طائرة", slug: "volleyball", href: "/dashboard/games?sport=Volleyball" },
  { name: "Beach volleyball", ar: "طائرة شاطئية", slug: "beach-volleyball", href: "/dashboard/games?sport=Beach%20Volleyball" },
  { name: "Archery", ar: "رماية بالقوس", slug: "archery", href: "/sports/archery" },
];

export function MemberHomeHeader({ name, hasQr, sections }: { name?: string; hasQr: boolean; sections: { id: string; label: string }[] }) {
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
    <nav className={styles.categories} aria-label={ar ? "اختار نشاطك" : "Explore activities"}>
      {categories.map(category => <Link key={category.href} href={category.href} className={`${styles.category} ${category.wide ? styles.wide : ""}`}><span aria-hidden="true" className={styles.categoryPhoto} style={{ backgroundPosition: category.photo }} /><span className={styles.shade} aria-hidden="true" /><strong>{ar ? category.ar : category.en}</strong><ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" /></Link>)}
    </nav>
    <div className={styles.sportsHeader}><h2>{ar ? "العب رياضتك" : "Play your sport"}</h2><Link href="/dashboard/games">{ar ? "اكتشف الكل" : "Discover all"}<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
    <nav className={styles.sports} aria-label={ar ? "الرياضات" : "Browse by sport"}>{sports.map(sport => <Link href={sport.href} key={sport.slug}><span className={styles.sportIcon}>{SportIcon({ id: sport.slug, size: 32 })}</span><span>{ar ? sport.ar : sport.name}</span></Link>)}</nav>
    <nav className={styles.sections} aria-label={ar ? "أقسام لوحة التحكم" : "Dashboard sections"}>{hasQr && <a href="#checkin">{ar ? "كود الحضور" : "Attendance QR"}</a>}{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav>
  </div>;
}
