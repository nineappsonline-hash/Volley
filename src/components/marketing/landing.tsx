"use client";

import { publicGamePath } from "@/lib/game-discovery";
import { LOCAL_GAME_GUIDES, localGamePath } from "@/lib/local-games";

import type { PublicGame } from "@/lib/public-games";
import { formatTime12h } from "@/lib/constants";
import { gameSharePrice } from "@/lib/game-share";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, Volleyball, Pause, Play, MapPin } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { academyManagementPath } from "@/lib/academy-management";
import { courtsPath } from "@/lib/court-discovery";
import { discoveryPath } from "@/lib/sport-discovery";
import { BEACH_DESCRIPTION } from "@/lib/landing-content";
import { BeachVolleyballScene } from "./beach-volleyball-scene";
import { BeachVolleyballGameCard } from "@/components/game/beach-volleyball-game-card";
import styles from "./volleyball-landing.module.css";

type Sport = "volleyball" | "beach-volleyball" | "tennis";

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

export function LandingPage({ upcomingGames = [] }: { upcomingGames?: PublicGame[] }) {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [paused, setPaused] = useState(false);
  const [sport, setSport] = useState<Sport>("volleyball");
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const names = { volleyball: copy("Volleyball", "الكرة الطائرة"), "beach-volleyball": copy("Beach volleyball", "الطائرة الشاطئية"), tennis: copy("Tennis", "التنس") };

  return <div className={styles.page} dir={dir} data-paused={paused}>
    <header className={styles.header}>
      <Link href="/" aria-label="Playza"><AppLogo className="w-24 sm:w-28" /></Link>
      <nav className={styles.nav} aria-label={copy("Main navigation", "القائمة الرئيسية")}><Link href="/games">{copy("Join a game", "انضم لماتش")}</Link><Link href={courtsPath(lang)}>{copy("Find your court", "لاقي ملعبك")}</Link><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><a href="#tennis">{copy("Tennis", "التنس")}</a><a href="#beach-volleyball">{copy("Beach volleyball", "الطائرة الشاطئية")}</a><a href="#beach-challenge">{copy("Play now", "العب دلوقتي")}</a><a href="#sports">{copy("The sports", "الرياضات")}</a></nav>
      <div className={styles.headerActions}><LanguageToggle /><Link href="/login" className={styles.login}>{copy("Log in", "تسجيل الدخول")} <ArrowUpRight size={16} /></Link></div>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />{copy("LESS SCROLLING. MORE VOLLEYBALL.", "سيب الموبايل شوية. وانزل العب طايرة.")}</p>
          <h1>{copy("Your people.", "ناس شبهك.")}<br />{copy("Your court.", "ملعبك.")}<br /><span>{copy("Your game.", "لعبتك.")}<svg viewBox="0 0 400 25" aria-hidden="true"><path d="M5 18Q190-7 395 12M30 23Q210 6 365 18" /></svg></span></h1>
          <p className={styles.intro}>{copy("Join tennis, volleyball and beach volleyball games in Egypt. Check the date, court and price, find your level, and meet people who love to play.", "انضم لماتشات تنس وكرة طائرة وطائرة شاطئية في مصر. شوف الميعاد والملعب والتكلفة والمستوى المناسب ليك، واتعرّف على ناس بتحب اللعب.")}</p>
          <div className={styles.actions}><Link className={styles.primary} href="/games">{copy("Find a game to join", "لاقي ماتش وانضم")}<ArrowUpRight size={20} /></Link><Link className={styles.textLink} href={courtsPath(lang)}>{copy("Find a playground", "لاقي ملعب")}<ArrowUpRight size={18} /></Link></div>
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
        <a className={styles.scrollHint} href="#upcoming-games"><ArrowDown size={16} />{copy("LET’S GET YOU OUT THERE", "يلا ننزل الملعب")}</a>
      </section>

      <div className={styles.ribbon} aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}> {copy("SERVE. SET. CONNECT.", "إرسال. إعداد. ضربة ساحقة.")} <span>✳</span> {copy("SEE YOU ON COURT", "نشوفك في الملعب")} <span>✳</span></span>)}</div></div>

      <section id="upcoming-games" aria-labelledby="upcoming-games-title" className={styles.upcomingGames}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{copy("MEET YOUR NEXT TEAMMATES", "اتعرّف على زمايلك في الماتش الجاي")}</p>
          <h2 id="upcoming-games-title">{copy("Find a game. Join the people.", "لاقي ماتش. واتعرّف على ناس جديدة.")}</h2>
          <p>{copy("Browse tennis, volleyball and beach volleyball. Check each game's location, price and joining requirements before you book.", "اكتشف ماتشات التنس والكرة الطائرة والطائرة الشاطئية. راجع مكان وتكلفة وشروط كل ماتش قبل الحجز.")}</p>
        </div>
        {upcomingGames.length > 0 ? <div className={styles.gameGrid}>
          {upcomingGames.map(game => {
            const href = publicGamePath(game.id);
            const place = [game.playground?.name, game.playground?.area ?? game.area, game.playground?.governorate].filter(Boolean).join(", ");
            const price = ar
              ? game.host_pays || game.share_price === 0 ? "مجاني" : game.share_price == null ? "التكلفة لم تتحدد بعد" : `${game.share_price} جنيه لكل لاعب`
              : gameSharePrice(game);
            return <article key={game.id} className={styles.gameCard}>
              <p>{game.sport}</p>
              <h3><Link href={href}>{game.title}</Link></h3>
              <p><time dateTime={game.game_date}>{new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`))}</time> · {formatTime12h(game.start_time, lang)}</p>
              {place && <p>{place}</p>}
              <p><strong>{price}</strong></p>
              <Link href={href} className={styles.textLink}>{copy("View game & joining details", "شوف تفاصيل الماتش والانضمام")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
            </article>;
          })}
        </div> : <p className={styles.gamesEmpty}>{copy("Check the games page for the latest availability. You can also create an account and organize a game with your friends.", "راجع صفحة الماتشات لمعرفة المواعيد المتاحة. وتقدر تعمل حساب وتنظّم ماتش مع أصحابك.")}</p>}
        <nav aria-label={copy("Games in New Cairo", "ماتشات في التجمع")} className="mt-6 flex flex-wrap gap-4">{LOCAL_GAME_GUIDES.map(guide => <Link key={guide.slug} className={styles.textLink} href={localGamePath(lang, guide.slug)}>{guide[lang].title}</Link>)}</nav>
        <div className={styles.actions}><Link href="/games" className={styles.primary}>{copy("Browse all upcoming games", "شوف كل الماتشات الجاية")}<ArrowUpRight size={20} aria-hidden="true" /></Link></div>
      </section>

      <section id="sports" className={styles.sportsSection}>
        <div className={styles.sportsCopy}><p className={styles.eyebrow}>{copy("01 / PICK YOUR PLAY", "01 / اختار لعبتك")}</p><h2>{copy("Big on volleyball.", "الطايرة في قلب لعبتنا.")}<br /><span>{copy("Room for more.", "والتنس والطائرة الشاطئية كمان.")}</span></h2><p>{copy("We live for the rally. Whether it’s over a volleyball net or with a racket in hand.", "تنس أو كرة طائرة أو طائرة شاطئية، المهم نلعب وننبسط مع بعض.")}</p><div className={styles.sportButtons} role="group" aria-label={copy("Choose a sport", "اختار رياضة")}>{(["tennis", "volleyball", "beach-volleyball"] as const).map(item => <button key={item} type="button" aria-pressed={sport === item} onClick={() => setSport(item)}>{names[item]}{item === "volleyball" && <Volleyball size={17} />}</button>)}</div><Link className={styles.textLink} href={discoveryPath(lang, sport)}>{copy("Explore", "اكتشف")} {names[sport]}<ArrowUpRight size={20} /></Link></div>
        <div className={styles.sportPoster} data-sport={sport}><span className={styles.posterLabel}>{copy("THE PLAYZA SPORTS CLUB", "نادي بلايزا الرياضي")}</span><div key={sport} className={styles.posterGraphic} aria-hidden="true">{sport !== "tennis" ? <Ball /> : <svg viewBox="0 0 240 280" fill="none"><g transform="rotate(30 120 140)"><ellipse cx="120" cy="100" rx="63" ry="82" fill="none" stroke="#182d29" strokeWidth="10" />{<path d="M77 44V156M98 25V176M120 20V180M142 25V176M163 44V156M62 60H178M58 86H182M58 112H182M65 138H175" stroke="#182d29" strokeWidth="2" />}<path d="M102 180L114 216H126L138 180M120 215V263" stroke="#182d29" strokeWidth="12" strokeLinecap="round" /></g><circle cx="202" cy="209" r="21" fill="#cced48" stroke="#182d29" strokeWidth="3" /></svg>}</div><strong>{names[sport]}</strong><span className={styles.posterFooter}>{sport === "volleyball" ? copy("OUR FIRST LOVE. YOUR NEXT GAME.", "بنحب الطايرة. ومستنيينك في الملعب.") : copy("NEW RALLIES. SAME GOOD ENERGY.", "لعبة جديدة. ونفس الحماس.")}</span></div>
      </section>

      <section id="tennis" aria-labelledby="tennis-title" className={styles.beachSection}>
        <div className={styles.beachCopy}>
          <p className={styles.eyebrow}>{copy("MAKE TIME FOR TENNIS", "وقت للعب التنس")}</p>
          <h2 id="tennis-title">{copy("Tennis. Find your next rally.", "التنس. ماتشك الجاي يبدأ هنا.")}</h2>
          <p>{copy("Looking for a tennis partner, a court or a place to learn? Explore tennis on Playza, compare published sessions and check the playing level, location and cost before joining.", "بتدور على شريك تلعب معاه تنس، أو ملعب، أو مكان تتعلم فيه؟ اكتشف التنس على بلايزا، وقارن المواعيد المنشورة وراجع المستوى والمكان والتكلفة قبل المشاركة.")}</p>
          <ul className={styles.beachHighlights}><li>{copy("Check singles, doubles and coaching arrangements", "راجع نظام الفردي والزوجي والتدريب مع المنظم")}</li><li>{copy("Confirm racket availability and court details", "اتأكد من توفر المضرب وتفاصيل الملعب")}</li></ul>
          <div className={styles.actions}><Link className={styles.primary} href="/games?sport=tennis">{copy("Find tennis games", "شوف ماتشات التنس")}<ArrowUpRight size={20} /></Link><Link className={styles.textLink} href={discoveryPath(lang, "tennis")}>{copy("Explore tennis", "اكتشف التنس")}<ArrowUpRight size={18} /></Link></div>
          <p className={styles.beachNote}>{copy("Sessions appear when organizers publish them. Check each listing for current availability.", "المواعيد بتظهر لما المنظمين ينشروها. راجع كل إعلان لمعرفة التوفر الحالي.")}</p>
        </div>
        <div className={styles.beachArt} aria-hidden="true"><svg viewBox="0 0 500 360" className={styles.beachScene} fill="none"><rect x="35" y="30" width="430" height="300" rx="28" fill="#C7F23D" /><path d="M75 70H425V290H75ZM250 70V290M75 180H425M155 70V290M345 70V290" stroke="#FFFFFF" strokeWidth="5" /><g transform="rotate(30 260 180)"><ellipse cx="245" cy="132" rx="65" ry="88" fill="#F6F8FA" stroke="#14213D" strokeWidth="12" /><path d="M205 65V200M225 50V215M245 45V220M265 50V215M285 65V200M183 100H307M180 130H310M183 160H307M195 190H295M245 225V320" stroke="#14213D" strokeWidth="5" /></g><circle cx="120" cy="260" r="29" fill="#C7F23D" stroke="#14213D" strokeWidth="4" /><path d="M98 242Q130 250 133 286" stroke="#FFFFFF" strokeWidth="4" /></svg></div>
      </section>

      <section id="beach-volleyball" aria-labelledby="beach-volleyball-title" className={styles.beachSection}>
        <div className={styles.beachCopy}>
          <p className={styles.eyebrow}><span />{copy("02 / TAKE IT TO THE SAND", "02 / اللعب على الرمل")}</p>
          <h2 id="beach-volleyball-title">{copy("Beach volleyball.", "الكرة الطائرة الشاطئية.")}<br /><span>{copy("Same rally. New rhythm.", "نفس الحماس. على الرمل.")}</span></h2>
          <p>{BEACH_DESCRIPTION[lang]}</p>
          <ul className={styles.beachHighlights}>
            <li><Volleyball size={18} aria-hidden="true" />{copy("Explore beach volleyball games and training", "اكتشف مباريات وتدريبات الطائرة الشاطئية")}</li>
            <li><MapPin size={18} aria-hidden="true" />{copy("Check the court, playing level and session details", "راجع الملعب ومستوى اللعب وتفاصيل الميعاد")}</li>
          </ul>
          <div className={styles.actions}>
            <Link className={styles.primary} href={discoveryPath(lang, "beach-volleyball")}>{copy("Explore beach volleyball", "اكتشف الطائرة الشاطئية")}<ArrowUpRight size={20} aria-hidden="true" /></Link>
            <Link className={styles.textLink} href="/academies">{copy("Explore academies", "اكتشف الأكاديميات")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <p className={styles.beachNote}>{copy("Availability varies by organizer and venue. Check each listing before joining.", "المواعيد والتوفر بيختلفوا حسب المنظم والمكان. راجع تفاصيل الإعلان قبل المشاركة.")}</p>
        </div>
        <div className={styles.beachArt}>
          <span className={styles.beachArtLabel}>{copy("SAND. SERVE. REPEAT.", "رمل. إرسال. حماس.")}</span>
          <BeachVolleyballScene />
          <span className={styles.beachTag}><Volleyball size={16} aria-hidden="true" />{copy("Your next rally starts here", "حماسك الجاي يبدأ هنا")}</span>
          <button type="button" className={styles.beachMotion} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={copy(paused ? "Resume animations" : "Pause animations", paused ? "تشغيل الحركة" : "إيقاف الحركة")}>
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
        </div>
      </section>

      {process.env.NEXT_PUBLIC_BEACH_GAME_ENABLED !== "false" && <BeachVolleyballGameCard />}

      <section id="academy-management" aria-labelledby="academy-management-title" className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border bg-card p-6 sm:p-10">
          <p className="text-sm font-semibold text-brand">{copy("FOR ACADEMY OWNERS", "لأصحاب الأكاديميات")}</p>
          <h2 id="academy-management-title" className="mt-3 text-2xl font-bold text-brand sm:text-3xl">{copy("Run your sports academy with Playza.", "أدر أكاديميتك الرياضية مع بلايزا.")}</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{copy("Manage players, subscriptions, training schedules, QR attendance and session finances in one Arabic and English application built for sports academies in Egypt.", "نظّم اللاعبين والاشتراكات وجداول التدريب والحضور عبر QR ومالية الجلسات في تطبيق واحد بالعربية والإنجليزية للأكاديميات الرياضية في مصر.")}</p>
          <Link className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={academyManagementPath(lang)}>{copy("Explore academy management", "اكتشف إدارة الأكاديميات")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className={styles.finalCta}><svg className={styles.ctaStar} viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50 8V92M8 50H92M20 20L80 80M20 80L80 20" fill="none" stroke="currentColor" strokeWidth="12" /></svg><p className={styles.eyebrow}>{copy("LESS PLANNING. MORE PLAYING.", "كلام أقل. لعب أكتر.")}</p><h2>{copy("The court is calling.", "الملعب بيناديك.")}</h2><Link className={styles.primary} href="/games?sport=volleyball">{copy("Find your next volleyball game", "لاقي ماتش كرة طائرة")}<ArrowUpRight size={20} /></Link><p>{copy("Come for the game. Stay for the people.", "تعالى العب، واتعرّف على ناس بتحب نفس لعبتك.")}</p></section>
    </main>

    <footer className={styles.footer}><div><AppLogo className="w-24" /><p>{copy("A little less online. A lot more on court.", "وقت أقل على الموبايل. ووقت أكتر في الملعب.")}</p></div><nav aria-label={copy("Footer", "روابط إضافية")}><Link href="/games">{copy("Upcoming games", "الماتشات الجاية")}</Link><Link href={discoveryPath(lang, "tennis")}>{copy("Tennis", "التنس")}</Link><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><Link href="/signup/owner">{copy("List your playground", "أضف ملعبك")}</Link><Link href={academyManagementPath(lang)}>{copy("For academy owners", "لأصحاب الأكاديميات")}</Link><Link href={discoveryPath(lang, "beach-volleyball")}>{copy("Beach volleyball", "الطائرة الشاطئية")}</Link><Link href={lang === "ar" ? "/ar/guides" : "/guides"}>{copy("Playing guides", "إرشادات اللعب")}</Link><Link href="/faq">{copy("FAQs", "أسئلة شائعة")}</Link></nav><span>© {new Date().getFullYear()} Playza</span></footer>
  </div>;
}
