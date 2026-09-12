"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft, Check, CalendarDays, QrCode, Users, TrendingUp, MessageCircle, MapPin, Wallet, Trophy, Heart, Volleyball, Menu, X } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { InstallBanner } from "@/components/marketing/install-banner";
import { useI18n } from "@/lib/i18n";
import { SportIcon } from "./sport-icons";
import styles from "./landing.module.css";

function audiences(t: (k: any) => string) {
  return [
    { label: t("landing_aud1_label"), icon: Volleyball, title: t("landing_aud1_title"), text: t("landing_aud1_text"), points: [t("landing_aud1_p1"), t("landing_aud1_p2"), t("landing_aud1_p3")], cta: t("landing_aud1_cta"), href: "/signup" },
    { label: t("landing_aud2_label"), icon: Heart, title: t("landing_aud2_title"), text: t("landing_aud2_text"), points: [t("landing_aud2_p1"), t("landing_aud2_p2"), t("landing_aud2_p3")], cta: t("landing_aud2_cta"), href: "/academies" },
    { label: t("landing_aud3_label"), icon: Trophy, title: t("landing_aud3_title"), text: t("landing_aud3_text"), points: [t("landing_aud3_p1"), t("landing_aud3_p2"), t("landing_aud3_p3")], cta: t("landing_aud3_cta"), href: "/signup" },
  ];
}

function features(t: (k: any) => string) {
  return [
    { icon: CalendarDays, title: t("landing_feat1_title"), text: t("landing_feat1_text") },
    { icon: QrCode, title: t("landing_feat2_title"), text: t("landing_feat2_text") },
    { icon: TrendingUp, title: t("landing_feat3_title"), text: t("landing_feat3_text") },
    { icon: Wallet, title: t("landing_feat4_title"), text: t("landing_feat4_text") },
    { icon: MessageCircle, title: t("landing_feat5_title"), text: t("landing_feat5_text") },
    { icon: MapPin, title: t("landing_feat6_title"), text: t("landing_feat6_text") },
  ];
}

export function LandingPage() {
  const { t, lang, dir } = useI18n();
  const pageRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    pageRef.current?.querySelectorAll(`section, article, .${styles.kicker}`).forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const [audience, setAudience] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = audiences(t)[audience];
  const [sport, setSport] = useState("football");
  const sportList: [string, string][] = [
    ["football", t("sport_football")],
    ["basketball", t("sport_basketball")],
    ["handball", t("sport_handball")],
    ["volleyball", t("sport_volleyball")],
    ["tennis", t("sport_tennis")],
    ["swimming", t("sport_swimming")],
    ["padel", t("sport_padel")],
    ["squash", t("sport_squash")],
    ["table-tennis", t("sport_table_tennis")],
    ["badminton", t("sport_badminton")],
    ["gymnastics", t("sport_gymnastics")],
    ["karate", t("sport_karate")],
    ["boxing", t("sport_boxing")],
    ["athletics", t("sport_athletics")],
    ["kung-fu", t("sport_kungfu")],
    ["taekwondo", t("sport_taekwondo")],
    ["crossfit", t("sport_crossfit")],
    ["judo", t("sport_judo")],
    ["kickboxing", t("sport_kickboxing")],
    ["wrestling", t("sport_wrestling")],
    ["archery", t("sport_archery")],
    ["fencing", t("sport_fencing")],
    ["equestrian", t("sport_equestrian")],
    ["cycling", t("sport_cycling")],
    ["weightlifting", t("sport_weightlifting")],
    ["parkour", t("sport_parkour")],
  ];
  const arenaSports: [string, string][] = [
    ["football", t("landing_sport_football")],
    ["padel", t("landing_sport_padel")],
    ["swimming", t("landing_sport_swimming")],
    ["volleyball", t("landing_sport_volleyball")],
  ];
  const navLinks: [string, string][] = [
    [t("landing_nav_about"), "#about"],
    [t("landing_nav_for_you"), "#for-you"],
    [t("landing_nav_features"), "#features"],
    [t("landing_nav_faq"), "/faq"],
  ];
  const steps: [string, string][] = [
    [t("landing_step1_title"), t("landing_step1_text")],
    [t("landing_step2_title"), t("landing_step2_text")],
    [t("landing_step3_title"), t("landing_step3_text")],
  ];
  const faq: [string, string][] = [
    [t("landing_faq1_q"), t("landing_faq1_a")],
    [t("landing_faq2_q"), t("landing_faq2_a")],
    [t("landing_faq3_q"), t("landing_faq3_a")],
    [t("landing_faq4_q"), t("landing_faq4_a")],
  ];
  return (
    <main ref={pageRef} dir={dir} lang={lang === "ar" ? "ar-EG" : "en"} data-paused={paused} className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label={t("landing_aria_home")}><AppLogo className="w-28" /></Link>
        <nav aria-label={t("landing_nav_about")} className={styles.desktopNav}>{navLinks.map(([text, href]) => href.startsWith("#") ? <a key={href} href={href}>{text}</a> : <Link key={href} href={href}>{text}</Link>)}</nav>
        <div className={styles.headerActions}><LanguageToggle /><Link href="/login">{t("landing_signin")}</Link><Link className={styles.smallCta} href="/signup">{t("landing_cta_start")} <ArrowUpLeft size={16} /></Link><button className={styles.menuButton} aria-label={menuOpen ? t("landing_menu_close") : t("landing_menu_open")} aria-expanded={menuOpen} aria-controls="home-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
        {menuOpen && <nav id="home-menu" className={styles.mobileNav} aria-label={t("landing_nav_about")}>{navLinks.map(([text, href]) => href.startsWith("#") ? <a key={href} href={href} onClick={() => setMenuOpen(false)}>{text}</a> : <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{text}</Link>)}</nav>}
      </header>

      <section id="top" className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.eyebrow}><span /> {t("landing_hero_eyebrow")}</span><h1>{t("landing_hero_title_a")}<br /><em>{t("landing_hero_title_b")}</em></h1><p>{t("landing_hero_desc_alt")}</p><div className={styles.actions}><Link className={styles.cta} href="/signup">{t("landing_cta_start")} <ArrowUpLeft size={20} /></Link><Link className={styles.secondary} href="/academies">{t("landing_cta_discover")} <MapPin size={18} /></Link></div><p className={styles.heroNote}>{t("landing_hero_note")}</p></div>
        <div className={styles.editorialHero}>
          <Image src="/images/playza-sports-editorial.webp" alt={t("landing_editorial_alt")} width={1200} height={800} priority sizes="(max-width: 700px) 100vw, 50vw" />
          <div className={styles.editorialCaption}><span>{t("landing_editorial_span")}</span><strong>{t("landing_editorial_strong")}</strong></div>
        </div>
      </section>
      <InstallBanner />
      <div className={styles.sports} aria-label={t("landing_sports_prompt")}><span>{t("landing_sports_prompt")}</span>{sportList.map(([id, name]) => <span key={id}><SportIcon id={id} size={16} />{name}</span>)}</div>

      <section id="about" className={`${styles.section}`}>
        <div className={styles.sectionHeading}><span className={styles.kicker}>{t("landing_about_kicker")}</span><h2>{t("landing_about_title")}</h2><p>{t("landing_about_desc")}</p></div>
        <div className={styles.aboutGrid}>{[t("landing_about_point1"), t("landing_about_point2"), t("landing_about_point3")].map((point, i) => <div className={styles.aboutCard} key={point}><span>0{i + 1}</span><p>{point}</p></div>)}</div>
      </section>

      <section className={`${styles.section} ${styles.playTogether}`}>
        <div><span className={styles.kicker}>{t("landing_play_kicker")}</span><h2>{t("landing_play_title_a")}<br /><em>{t("landing_play_title_b")}</em></h2><p>{t("landing_play_desc1")}</p><p>{t("landing_play_desc2")}</p><Link className={styles.cta} href="/signup">{t("landing_play_cta")} <ArrowUpLeft size={20} /></Link></div>
        <div className={styles.matchGraphic} aria-label={t("landing_play_graphic_aria")}><div className={styles.matchGraphicTitle}><span className={styles.iconGreen}><Users size={24} /></span><div><strong>{t("landing_chat_title")}</strong><small>{t("landing_chat_subtitle")}</small></div></div><div className={styles.chatBubble}>{t("landing_chat_bubble")} <Volleyball size={18} /></div><div className={styles.chatReply}>{t("landing_chat_reply")} 🙌</div><div className={styles.matchChecklist}><span><MapPin size={18} /> {t("landing_checklist_place")}</span><span><CalendarDays size={18} /> {t("landing_checklist_time")}</span><span><Wallet size={18} /> {t("landing_checklist_cost")}</span></div><small className={styles.illustrationNote}>{t("landing_illustration_note")}</small></div>
      </section>

      <section className={styles.arenaSection}>
        <div className={styles.arenaCopy}><span className={styles.kicker}>{t("landing_arena_kicker")}</span><h2>{t("landing_arena_title_a")}<br /><em>{t("landing_arena_title_b")}</em></h2><p>{t("landing_arena_desc")}</p><Link className={styles.cta} href="/signup">{t("landing_arena_cta")} <ArrowUpLeft size={20} /></Link></div>
        <div className={styles.arenaArt}>
          <div className={styles.sportSelector} role="group" aria-label={t("landing_sport_select_aria")}>{arenaSports.map(([id, label]) => <button key={id} aria-pressed={sport === id} onClick={() => setSport(id)}>{label}</button>)}</div>
          <SportScene sport={sport} /><span>{t("landing_arena_note")}</span>
        </div>
      </section>

      <section id="for-you" className={styles.section}>
        <div className={styles.sectionHeading}><span className={styles.kicker}>{t("landing_foryou_kicker")}</span><h2>{t("landing_foryou_title")}</h2><p>{t("landing_foryou_desc")}</p></div>
        <div className={styles.audienceButtons} role="group" aria-label={t("landing_foryou_aria")}>{audiences(t).map((item, index) => <button key={item.label} aria-pressed={index === audience} onClick={() => setAudience(index)}><item.icon size={19} />{item.label}</button>)}</div>
        <div className={styles.audiencePanel} key={audience}><div><span className={styles.kicker}>{current.label}</span><h3>{current.title}</h3><p>{current.text}</p><Link className={styles.textLink} href={current.href}>{current.cta} <ArrowUpLeft size={19} /></Link></div><div className={styles.benefits}>{current.points.map((point, i) => <div key={point}><span>0{i + 1}</span><p>{point}</p><Check size={20} /></div>)}</div></div>
      </section>

      <section id="features" className={`${styles.section} ${styles.featureSection}`}><div className={styles.sectionHeading}><span className={styles.kicker}>{t("landing_feat_kicker")}</span><h2>{t("landing_feat_title_a")}<br /><em>{t("landing_feat_title_b")}</em></h2><p>{t("landing_feat_desc")}</p></div><div className={styles.featureGrid}>{features(t).map((feature, index) => <article className={styles.featureCard} key={feature.title}><div className={styles.featureTop}><feature.icon size={26} /><span>0{index + 1}</span></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>

      <section className={styles.section}><div className={styles.stepsHeading}><div><span className={styles.kicker}>{t("landing_steps_kicker")}</span><h2>{t("landing_steps_title")}</h2></div><Link className={styles.secondary} href="/signup">{t("landing_steps_cta")} <ArrowUpLeft size={18} /></Link></div><div className={styles.steps}>{steps.map(([title, text], i) => <article key={title}><span>{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section id="questions" className={`${styles.section} ${styles.faq}`}><div><span className={styles.kicker}>{t("landing_faq_kicker")}</span><h2>{t("landing_faq_title")}</h2><p>{t("landing_faq_desc")}</p></div><div>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}<Link className={styles.textLink} href="/faq">{t("landing_faq_more_cta")} <ArrowUpLeft size={18} /></Link></div></section>
      <section className={styles.finalCta}><div><span className={styles.kicker}>{t("landing_final_kicker")}</span><h2>{t("landing_final_title")}</h2><p>{t("landing_final_desc")}</p></div><Link className={styles.cta} href="/signup">{t("landing_final_cta")} <ArrowUpLeft size={22} /></Link></section>
      <footer className={styles.footer}><AppLogo className="w-24" /><p>{t("landing_footer_desc")}</p><button className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? t("landing_motion_play") : t("landing_motion_pause")}</button><div><span className={styles.footerHeading}>{t("landing_footer_solutions")}</span><Link href="/games">{t("landing_footer_games")}</Link><Link href="/tournaments">{t("landing_footer_tournaments")}</Link><Link href="/academies">{t("landing_footer_academies")}</Link><Link href="/faq">{t("landing_footer_faq")}</Link><Link href="/solutions/football">{t("landing_sport_football")}</Link><Link href="/solutions/volleyball">{t("landing_sport_volleyball")}</Link><Link href="/solutions/padel">{t("landing_sport_padel")}</Link><Link href="/login">{t("landing_signin")}</Link><a href="#top">{t("landing_footer_top")}</a></div></footer>
    </main>
  );
}


function SportScene({ sport }: { sport: string }) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    football: t("landing_sport_football"),
    padel: t("landing_sport_padel"),
    swimming: t("landing_sport_swimming"),
    volleyball: t("landing_sport_volleyball"),
  };
  const scenes: Record<string, { label: string; position: string }> = {
    football: { label: labels.football, position: "0% 0%" },
    padel: { label: labels.padel, position: "100% 0%" },
    swimming: { label: labels.swimming, position: "0% 100%" },
    volleyball: { label: labels.volleyball, position: "100% 100%" },
  };
  const scene = scenes[sport] ?? scenes.football;
  return <div className={styles.sportPhoto} key={sport} role="img" aria-label={t("landing_scene_aria").replace("{sport}", scene.label)} style={{ backgroundPosition: scene.position }}><span>{scene.label}</span></div>;
}