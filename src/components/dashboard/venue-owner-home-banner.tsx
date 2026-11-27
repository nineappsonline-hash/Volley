"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, MapPin, Percent } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import styles from "./venue-owner-home-banner.module.css";

/** Dedicated acquisition section for sports venue owners on guest and member homepages. */
export function VenueOwnerHomeBanner() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <section className={styles.section} aria-labelledby="venue-owner-home-heading" dir={ar ? "rtl" : "ltr"}>
      <div className={styles.content}>
        <p className={styles.kicker}><MapPin size={17} aria-hidden="true" />{ar ? "لأصحاب الملاعب الرياضية" : "FOR SPORTS VENUE OWNERS"}</p>
        <h2 id="venue-owner-home-heading">{ar ? <>عندك ملعب؟ <em>خلّي الناس تلاقيه.</em></> : <>Own a court? <em>Get discovered.</em></>}</h2>
        <p className={styles.description}>{ar ? "سجّل ملعبك مجانًا، وخلّي اللاعبين يشوفوا مواعيدك ويحجزوا بسهولة." : "List your court for free, reach players, and manage availability and bookings."}</p>
        <div className={styles.benefits}>
          <span><BadgeCheck size={16} aria-hidden="true" />{ar ? "تسجيل مجاني" : "Free listing"}</span>
          <span><Percent size={16} aria-hidden="true" />{ar ? "بدون عمولة على الإيجار" : "No rental commission"}</span>
          <span><CalendarDays size={16} aria-hidden="true" />{ar ? "إدارة الحجوزات" : "Manage bookings"}</span>
        </div>
        <div className={styles.actions}>
          <Link href="/signup/owner" className={styles.primary}>{ar ? "سجّل ملعبك الآن" : "Register your court"}<ArrowUpRight size={19} aria-hidden="true" /></Link>
          <Link href={ar ? "/ar/list-your-court" : "/list-your-court"} className={styles.secondary}>{ar ? "اعرف أكتر" : "Learn more"}<ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.sportScene} />
        <div className={styles.visualShade} />
        <div className={styles.floatingCard}>
          <span className={styles.floatingIcon}><CalendarDays size={23}/></span>
          <span><strong>{ar ? "ملعبك على بلايزا" : "Your court on Playza"}</strong><small>{ar ? "مواعيد • حجوزات • إدارة" : "Availability · Bookings · Control"}</small></span>
          <BadgeCheck size={22} className={styles.verified}/>
        </div>
      </div>
    </section>
  );
}
