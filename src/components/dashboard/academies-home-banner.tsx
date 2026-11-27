"use client";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import styles from "./academies-home-banner.module.css";

/** Home discovery promotion using the approved sports academies artwork. */
export function AcademiesHomeBanner() {
  const { lang } = useI18n();
  return (
    <section className={styles.section} aria-label={lang === "ar" ? "اكتشف أكاديميات الكرة الطائرة وكرة السلة والتنس" : "Explore volleyball, basketball and tennis academies"}>
      <Link
        href="/academies"
        className={styles.link}
        aria-label={lang === "ar" ? "تصفح الأكاديميات الرياضية وبرامج التدريب" : "Explore sports academies and training programs"}
      >
        <Image
          src="/images/academies/home-academies-banner.webp"
          width={2172}
          height={724}
          alt={lang === "ar" ? "أكاديميات وتدريب الكرة الطائرة وكرة السلة والتنس" : "Academies and training for volleyball, basketball and tennis"}
          className={styles.image}
          sizes="(max-width: 640px) 100vw, (max-width: 1600px) 90vw, 1400px"
          quality={90}
        />
      </Link>
    </section>
  );
}
