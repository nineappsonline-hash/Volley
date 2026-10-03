"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, Volleyball, Pause, Play, MapPin, MoveUpRight } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { discoveryPath } from "@/lib/sport-discovery";
import styles from "./volleyball-landing.module.css";

type Sport = "volleyball" | "padel" | "tennis";

function Ball({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true"><circle cx="100" cy="100" r="94" fill="#f8f4e8" stroke="#182d29" strokeWidth="3" /><path d="M100 6C144 27 165 68 151 111L100 100C80 72 75 35 100 6Z" fill="#cced48" /><path d="M151 111C131 151 94 175 52 179L100 100Z" fill="#728dfa" /><path d="M100 100C56 104 24 82 10 63C0 115 22 153 52 179Z" fill="#cced48" /><g stroke="#182d29" strokeWidth="3"><path d="M100 6C74 40 77 72 100 100C146 106 177 127 181 147M100 100C85 145 66 169 52 179M10 63C39 94 68 108 100 100" /><path d="M125 12C108 46 113 75 133 105M151 111C128 150 106 169 79 191M7 99C37 123 66 133 88 129" /></g></svg>;
}

function CourtScene({ small = false }: { small?: boolean }) {
  return <div className={small ? styles.miniCourt : styles.scene} aria-hidden="true">
    <svg viewBox="0 0 640 540" className={styles.courtSvg} fill="none">
      <ellipse cx="330" cy="443" rx="272" ry="60" fill="#172e29" opacity=".12" />
      <path d="M45 310L354 161L614 311L305 479Z" fill="#213e35" />
      <path d="M45 298L354 149L614 299L305 467Z" fill="#cced48" stroke="#172e29" strokeWidth="3" />
      <path d="M86 296L353 168L574 299L305 445Z" stroke="#f9f7ed" strokeWidth="4" />
      <path d="M221 231L441 371M151 264L373 409M288 199L509 335" stroke="#f9f7ed" strokeWidth="3" />
      <path d="M204 230V126L463 274V387" stroke="#182d29" strokeWidth="7" strokeLinecap="round" />
      <path d="M206 136L460 280V348L206 204Z" fill="#f7f4e8" fillOpacity=".35" stroke="#182d29" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <path key={i} d={`M${215+i*21} ${141+i*12}v67`} stroke="#182d29" strokeWidth="1.4" />)}
      <path d="M206 153L460 297M206 170L460 314M206 187L460 331" stroke="#182d29" strokeWidth="1.4" />
      <g className={styles.player}><ellipse cx="175" cy="323" rx="30" ry="10" fill="#182d29" opacity=".15" /><path d="M174 276L157 311M186 277L201 314" stroke="#182d29" strokeWidth="12" strokeLinecap="round" /><path d="M174 229L165 272L192 280L199 234Z" fill="#728dfa" stroke="#182d29" strokeWidth="3" /><circle cx="191" cy="213" r="14" fill="#f1b99b" stroke="#182d29" strokeWidth="3" /><path d="M175 238L155 221L166 195M197 238L216 214L215 185" stroke="#182d29" strokeWidth="9" strokeLinecap="round" /><path d="M145 316H162M195 319H212" stroke="#f8f4e8" strokeWidth="9" strokeLinecap="round" /></g>
      <g><ellipse cx="451" cy="269" rx="27" ry="9" fill="#182d29" opacity=".15" /><path d="M445 224L429 261M456 225L474 255" stroke="#182d29" strokeWidth="11" strokeLinecap="round" /><path d="M436 185L433 223L460 230L465 187Z" fill="#f4a17e" stroke="#182d29" strokeWidth="3" /><circle cx="450" cy="169" r="13" fill="#ad7458" stroke="#182d29" strokeWidth="3" /><path d="M438 192L416 211L400 203M461 195L482 183" stroke="#182d29" strokeWidth="9" strokeLinecap="round" /></g>
      <path d="M257 126Q335 34 425 106" stroke="#182d29" strokeWidth="2" strokeDasharray="7 9" />
      <path d="M411 94L427 108L408 112" stroke="#182d29" strokeWidth="2" />
      <g transform="translate(276 71)"><circle r="22" fill="#f8f4e8" stroke="#182d29" strokeWidth="2" /><path d="M-20-8Q0 6 15-16M0 1Q-3 16-13 18M0 1Q17 1 21 7" stroke="#182d29" strokeWidth="2" /></g>
    </svg>
  </div>;
}

export function LandingPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [paused, setPaused] = useState(false);
  const [sport, setSport] = useState<Sport>("volleyball");
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const names = { volleyball: copy("Volleyball", "الكرة الطائرة"), padel: copy("Padel", "البادل"), tennis: copy("Tennis", "التنس") };

  return <div className={styles.page} dir={dir} data-paused={paused}>
    <header className={styles.header}>
      <Link href="/" aria-label="Playza"><AppLogo className="w-24 sm:w-28" /></Link>
      <nav className={styles.nav} aria-label={copy("Main navigation", "القائمة الرئيسية")}><a href="#find-your-court">{copy("Find your court", "لاقي ملعبك")}</a><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><a href="#sports">{copy("The sports", "الرياضات")}</a></nav>
      <div className={styles.headerActions}><LanguageToggle /><Link href="/login" className={styles.login}>{copy("Log in", "تسجيل الدخول")} <ArrowUpRight size={16} /></Link></div>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />{copy("LESS SCROLLING. MORE VOLLEYBALL.", "سيب الموبايل شوية. وانزل العب طايرة.")}</p>
          <h1>{copy("Your people.", "ناس شبهك.")}<br />{copy("Your court.", "ملعبك.")}<br /><span>{copy("Your game.", "لعبتك.")}<svg viewBox="0 0 400 25" aria-hidden="true"><path d="M5 18Q190-7 395 12M30 23Q210 6 365 18" /></svg></span></h1>
          <p className={styles.intro}>{copy("Find a volleyball court. Discover an academy. Turn “we should play” into your next plan.", "لاقي ملعب كرة طائرة أو أكاديمية تناسبك، واجمع أصحابك وانزلوا العبوا.")}</p>
          <div className={styles.actions}><Link className={styles.primary} href="/playgrounds">{copy("Find a playground", "لاقي ملعب")}<ArrowUpRight size={20} /></Link><Link className={styles.textLink} href="/academies">{copy("Explore academies", "اكتشف الأكاديميات")}<ArrowUpRight size={18} /></Link></div>
          <p className={styles.heroNote}><Volleyball size={17} />{copy("Volleyball at heart. Everyone in.", "بنحب الطايرة. وبنرحّب بكل اللي حابب يلعب.")}</p>
        </div>
        <div className={styles.heroArt}>
          <div className={styles.orbit} aria-hidden="true" />
          <span className={styles.artLabel}>{copy("MEET YOU AT THE NET", "نتقابل عند الشبكة")}</span>
          <CourtScene />
          <Ball className={styles.heroBall} />
          <span className={styles.sticker}>{copy("GOOD", "أحلى")}<br />{copy("GAME!", "لعبة!")}<span>✳</span></span>
          <div className={styles.locationTag}><MapPin size={16} />{copy("Your next favourite place", "هنا تبدأ أحلى ماتشاتك")}</div>
          <button type="button" className={styles.motionButton} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? copy("Play animations", "تشغيل الرسوم المتحركة") : copy("Pause animations", "إيقاف الرسوم المتحركة")}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        </div>
        <a className={styles.scrollHint} href="#find-your-court"><ArrowDown size={16} />{copy("LET’S GET YOU OUT THERE", "يلا ننزل الملعب")}</a>
      </section>

      <div className={styles.ribbon} aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}> {copy("SERVE. SET. CONNECT.", "إرسال. إعداد. ضربة ساحقة.")} <span>✳</span> {copy("SEE YOU ON COURT", "نشوفك في الملعب")} <span>✳</span></span>)}</div></div>

      <section id="find-your-court" className={styles.discover}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>{copy("01 / FIND YOUR PLACE", "01 / لاقي مكانك")}</p><h2>{copy("Two ways in.", "ملعب تلعب فيه.")}<br /><span>{copy("A whole lot of play.", "وأكاديمية تتدرّب فيها.")}</span></h2></div>
        <div className={styles.discoveryGrid}>
          <Link href="/playgrounds" className={`${styles.discoveryCard} ${styles.courtCard}`}><div className={styles.cardTop}><span>{copy("THE PLAYGROUNDS", "الملاعب")}</span><span className={styles.circleArrow}><ArrowUpRight /></span></div><div className={styles.cardGraphic}><CourtScene small /></div><div className={styles.cardCopy}><h3>{copy("Find your home court.", "لاقي الملعب اللي يناسبك.")}</h3><p>{copy("Explore places to play. Pick your spot and bring your people.", "اكتشف الملاعب، اختار مكانك، واجمع أصحابك.")}</p></div></Link>
          <Link href="/academies" className={`${styles.discoveryCard} ${styles.academyCard}`}><div className={styles.cardTop}><span>{copy("THE ACADEMIES", "الأكاديميات")}</span><span className={styles.circleArrow}><ArrowUpRight /></span></div><div className={styles.academyGraphic} aria-hidden="true"><span className={styles.stepOne}>01</span><span className={styles.stepTwo}>02</span><span className={styles.stepThree}>03<MoveUpRight /></span><Ball className={styles.academyBall} /><span className={styles.spark}>✳</span></div><div className={styles.cardCopy}><h3>{copy("Your next level starts here.", "طوّر مستواك من هنا.")}</h3><p>{copy("First serve or a stronger spike. Find an academy to grow with.", "سواء لسه بتبدأ أو عايز تطوّر مستواك، لاقي أكاديمية تتدرّب معاها.")}</p></div></Link>
        </div>
      </section>

      <section id="sports" className={styles.sportsSection}>
        <div className={styles.sportsCopy}><p className={styles.eyebrow}>{copy("02 / PICK YOUR PLAY", "02 / اختار لعبتك")}</p><h2>{copy("Big on volleyball.", "الطايرة في قلب لعبتنا.")}<br /><span>{copy("Room for more.", "والبادل والتنس كمان.")}</span></h2><p>{copy("We live for the rally. Whether it’s over a volleyball net or with a racket in hand.", "كرة طائرة أو بادل أو تنس، المهم نلعب وننبسط مع بعض.")}</p><div className={styles.sportButtons} role="group" aria-label={copy("Choose a sport", "اختار رياضة")}>{(["volleyball", "padel", "tennis"] as const).map(item => <button key={item} type="button" aria-pressed={sport === item} onClick={() => setSport(item)}>{names[item]}{item === "volleyball" && <Volleyball size={17} />}</button>)}</div><Link className={styles.textLink} href={discoveryPath(lang, sport)}>{copy("Explore", "اكتشف")} {names[sport]}<ArrowUpRight size={20} /></Link></div>
        <div className={styles.sportPoster} data-sport={sport}><span className={styles.posterLabel}>{copy("THE PLAYZA SPORTS CLUB", "نادي بلايزا الرياضي")}</span><div key={sport} className={styles.posterGraphic} aria-hidden="true">{sport === "volleyball" ? <Ball /> : <svg viewBox="0 0 240 280" fill="none"><g transform="rotate(30 120 140)"><ellipse cx="120" cy="100" rx="63" ry="82" fill={sport === "padel" ? "#182d29" : "none"} stroke="#182d29" strokeWidth="10" />{sport === "padel" ? Array.from({ length: 5 }, (_, row) => Array.from({ length: 4 }, (_, col) => <circle key={`${row}-${col}`} cx={87+col*22} cy={52+row*23} r="5" fill="#f4a17e" />)) : <path d="M77 44V156M98 25V176M120 20V180M142 25V176M163 44V156M62 60H178M58 86H182M58 112H182M65 138H175" stroke="#182d29" strokeWidth="2" />}<path d="M102 180L114 216H126L138 180M120 215V263" stroke="#182d29" strokeWidth="12" strokeLinecap="round" /></g><circle cx="202" cy="209" r="21" fill="#cced48" stroke="#182d29" strokeWidth="3" /></svg>}</div><strong>{names[sport]}</strong><span className={styles.posterFooter}>{sport === "volleyball" ? copy("OUR FIRST LOVE. YOUR NEXT GAME.", "بنحب الطايرة. ومستنيينك في الملعب.") : copy("NEW RALLIES. SAME GOOD ENERGY.", "لعبة جديدة. ونفس الحماس.")}</span></div>
      </section>

      <section className={styles.finalCta}><svg className={styles.ctaStar} viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50 8V92M8 50H92M20 20L80 80M20 80L80 20" fill="none" stroke="currentColor" strokeWidth="12" /></svg><p className={styles.eyebrow}>{copy("LESS PLANNING. MORE PLAYING.", "كلام أقل. لعب أكتر.")}</p><h2>{copy("The court is calling.", "الملعب بيناديك.")}</h2><Link className={styles.primary} href="/games?sport=volleyball">{copy("Find your next volleyball game", "لاقي ماتش كرة طائرة")}<ArrowUpRight size={20} /></Link><p>{copy("Come for the game. Stay for the people.", "تعالى العب، واتعرّف على ناس بتحب نفس لعبتك.")}</p></section>
    </main>

    <footer className={styles.footer}><div><AppLogo className="w-24" /><p>{copy("A little less online. A lot more on court.", "وقت أقل على الموبايل. ووقت أكتر في الملعب.")}</p></div><nav aria-label={copy("Footer", "روابط إضافية")}><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><Link href="/signup/owner">{copy("List your playground", "أضف ملعبك")}</Link><Link href="/signup/tenant">{copy("For academy owners", "لأصحاب الأكاديميات")}</Link><Link href="/faq">{copy("FAQs", "أسئلة شائعة")}</Link></nav><span>© {new Date().getFullYear()} Playza</span></footer>
  </div>;
}
