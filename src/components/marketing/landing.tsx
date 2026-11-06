"use client";
import { ShopShowcase } from "@/components/shop/shop-catalog";

import { CourtOwnerBenefits } from "@/components/auth/court-owner-benefits";
import { GameCardShell } from "@/components/games/game-card-shell";
import { guestGameCard } from "@/lib/guest-games";
import { publicGamePath } from "@/lib/game-discovery";

import type { PublicGame } from "@/lib/public-games";
import { useState } from "react";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { landingBrowsePath } from "@/lib/guest-access";

import { ArrowUpRight, ArrowDown, Volleyball, Pause, Play, MapPin, Users, CalendarDays, QrCode, Check, Sparkles } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useI18n } from "@/lib/i18n";
import { academyManagementPath } from "@/lib/academy-management";
import { listYourCourtPath } from "@/lib/list-your-court";
import { courtsPath } from "@/lib/court-discovery";
import { discoveryPath } from "@/lib/sport-discovery";
import { ARCHERY_DESCRIPTION, BEACH_DESCRIPTION, TENNIS_DESCRIPTION, SportsHeroSceneCopy } from "@/lib/landing-content";
import { SportCardArt } from "./sport-card-art";
import { SportsHeroScene } from "./sports-hero-scene";
import { BeachVolleyballGameCard } from "@/components/game/beach-volleyball-game-card";
import styles from "./volleyball-landing.module.css";

function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} href={typeof href === "string" ? landingBrowsePath(href) : href} />;
}

function CourtScene({ small = false }: { small?: boolean }) {
  return <div className={small ? styles.miniCourt : styles.scene} aria-hidden="true">
    <svg viewBox="0 0 640 540" className={styles.courtSvg} fill="none">
      <ellipse cx="330" cy="443" rx="272" ry="60" fill="#172e29" opacity=".12" />
      <path d="M45 310L354 161L614 311L305 479Z" fill="#213e35" />
      <path d="M45 298L354 149L614 299L305 467Z" fill="var(--color-primary)" stroke="#172e29" strokeWidth="3" />
      <path d="M86 296L353 168L574 299L305 445Z" stroke="#f9f7ed" strokeWidth="4" />
      <path d="M221 231L441 371M151 264L373 409M288 199L509 335" stroke="#f9f7ed" strokeWidth="3" />
      <path d="M204 230V126L463 274V387" stroke="var(--color-purple-dark)" strokeWidth="7" strokeLinecap="round" />
      <path d="M206 136L460 280V348L206 204Z" fill="#f7f4e8" fillOpacity=".35" stroke="var(--color-purple-dark)" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <path key={i} d={`M${215+i*21} ${141+i*12}v67`} stroke="var(--color-purple-dark)" strokeWidth="1.4" />)}
      <path d="M206 153L460 297M206 170L460 314M206 187L460 331" stroke="var(--color-purple-dark)" strokeWidth="1.4" />
      <g className={styles.player}><ellipse cx="175" cy="323" rx="30" ry="10" fill="var(--color-purple-dark)" opacity=".15" /><path d="M174 276L157 311M186 277L201 314" stroke="var(--color-purple-dark)" strokeWidth="12" strokeLinecap="round" /><path d="M174 229L165 272L192 280L199 234Z" fill="var(--color-purple-light)" stroke="var(--color-purple-dark)" strokeWidth="3" /><circle cx="191" cy="213" r="14" fill="#f1b99b" stroke="var(--color-purple-dark)" strokeWidth="3" /><path d="M175 238L155 221L166 195M197 238L216 214L215 185" stroke="var(--color-purple-dark)" strokeWidth="9" strokeLinecap="round" /><path d="M145 316H162M195 319H212" stroke="#f8f4e8" strokeWidth="9" strokeLinecap="round" /></g>
      <g><ellipse cx="451" cy="269" rx="27" ry="9" fill="var(--color-purple-dark)" opacity=".15" /><path d="M445 224L429 261M456 225L474 255" stroke="var(--color-purple-dark)" strokeWidth="11" strokeLinecap="round" /><path d="M436 185L433 223L460 230L465 187Z" fill="#f4a17e" stroke="var(--color-purple-dark)" strokeWidth="3" /><circle cx="450" cy="169" r="13" fill="#ad7458" stroke="var(--color-purple-dark)" strokeWidth="3" /><path d="M438 192L416 211L400 203M461 195L482 183" stroke="var(--color-purple-dark)" strokeWidth="9" strokeLinecap="round" /></g>
      <path d="M257 126Q335 34 425 106" stroke="var(--color-purple-dark)" strokeWidth="2" strokeDasharray="7 9" />
      <path d="M411 94L427 108L408 112" stroke="var(--color-purple-dark)" strokeWidth="2" />
      <g transform="translate(276 71)"><circle r="22" fill="#f8f4e8" stroke="var(--color-purple-dark)" strokeWidth="2" /><path d="M-20-8Q0 6 15-16M0 1Q-3 16-13 18M0 1Q17 1 21 7" stroke="var(--color-purple-dark)" strokeWidth="2" /></g>
    </svg>
  </div>;
}

export function LandingPage({ upcomingGames = [] }: { upcomingGames?: PublicGame[] }) {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [paused, setPaused] = useState(false);
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const names = { archery:copy("Archery", "الرماية بالقوس"), basketball:copy("Basketball","كرة السلة"), padel: copy("Padel", "البادل"), volleyball: copy("Volleyball", "الكرة الطائرة"), "beach-volleyball": copy("Beach volleyball", "الطائرة الشاطئية"), tennis: copy("Tennis", "التنس") };

  return <div className={styles.page} dir={dir} data-paused={paused}>
    <header className={styles.header}>
      <Link href="/" aria-label="Playza"><AppLogo className="w-24 sm:w-28" /></Link>
      <nav className={styles.nav} aria-label={copy("Main navigation", "القائمة الرئيسية")}><Link href="/games">{copy("Join a game", "انضم لماتش")}</Link><Link href={courtsPath(lang)}>{copy("Find your court", "لاقي ملعبك")}</Link><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><Link href="/dashboard?sport=tennis">{copy("Tennis", "التنس")}</Link><Link href="/dashboard?sport=padel">{copy("Padel", "البادل")}</Link><Link href="/dashboard?sport=archery">{copy("Archery", "الرماية بالقوس")}</Link><Link href="/dashboard?sport=beach-volleyball">{copy("Beach volleyball", "الطائرة الشاطئية")}</Link><Link href="/dashboard">{copy("Play now", "العب دلوقتي")}</Link><Link href="/dashboard">{copy("The sports", "الرياضات")}</Link></nav>
      <div className={styles.headerActions}><LanguageToggle /><Link href="/login" className={styles.login}>{copy("Log in", "تسجيل الدخول")} <ArrowUpRight size={16} /></Link></div>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />{SportsHeroSceneCopy[lang].eyebrow}</p>
          <h1>{copy("Find People", "اختار ناس")}<br />{copy("to Play With", "تلعب معاهم")}<br /><span>{copy("Join Games", "وانضم لماتش")}<svg viewBox="0 0 400 25" aria-hidden="true"><path d="M5 18Q190-7 395 12M30 23Q210 6 365 18" /></svg></span></h1>
          <p className={styles.intro}>{SportsHeroSceneCopy[lang].intro}</p>
          <div className={styles.actions}><NextLink className={`${styles.primary} ${styles.heroJoin}`} href="/dashboard">{copy("Find a Game", "شوف الماتش المناسب")}<ArrowUpRight size={24} /></NextLink></div>
          <p className={styles.heroNote}><Volleyball size={17} />{SportsHeroSceneCopy[lang].note}</p>
        </div>
        <div className={styles.heroArt}>
          <div className={styles.orbit} aria-hidden="true" />
          <span className={styles.artLabel}>{copy("FIND YOUR NEXT MOVE", "اختار لعبتك الجاية")}</span>
          <SportsHeroScene className={styles.multiSportHero} label={SportsHeroSceneCopy[lang].artLabel} />
          <span className={styles.sticker}>{copy("GOOD", "أحلى")}<br />{copy("GAME!", "لعبة!")}<span>✳</span></span>
          <div className={styles.locationTag}><MapPin size={16} />{copy("Your next favourite place", "هنا تبدأ أحلى ماتشاتك")}</div>
          <button type="button" className={styles.motionButton} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? copy("Play animations", "تشغيل الرسوم المتحركة") : copy("Pause animations", "إيقاف الرسوم المتحركة")}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        </div>
        <a className={styles.scrollHint} href="#upcoming-games"><ArrowDown size={16} />{copy("LET’S GET YOU OUT THERE", "يلا ننزل الملعب")}</a>
      </section>

      <div className={styles.ribbon} aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}> {copy("SERVE. SET. CONNECT.", "العب. اتعرّف. واتبسط.")} <span>✳</span> {copy("SEE YOU ON COURT", "نشوفك في الملعب")} <span>✳</span></span>)}</div></div>

      <section id="upcoming-games" aria-labelledby="upcoming-games-title" className={styles.upcomingGames}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{copy("MEET YOUR NEXT TEAMMATES", "اتعرّف على زمايلك في الماتش الجاي")}</p>
          <h2 id="upcoming-games-title">{copy("Find a game. Join the people.", "لاقي ماتش. وانضم للعبة.")}</h2>
          <p>{copy("Browse upcoming games for volleyball, basketball, padel, tennis and beach volleyball in Egypt. See location, spots left and price, then join other players.", "شوف الماتشات الجاية لكرة الطائرة، وكرة السلة، والبادل، والتنس، والطائرة الشاطئية في مصر. شوف المكان، والأماكن المتاحة، والسعر، وانضم للاعبين.")}</p>
        </div>
        {upcomingGames.length > 0 ? <div className={`flex flex-col gap-3 text-start ${styles.landingGameCards}`}>
          {upcomingGames.map(game => <GameCardShell key={game.id} layout="list" game={guestGameCard(game)} joined={false} detailsHref={publicGamePath(game.id)} />)}
        </div> : <p className={styles.gamesEmpty}>{copy("Check the games page for the latest availability. You can also create an account and organize a game with your friends.", "شوف المواعيد المتاحة في صفحة الماتشات، أو اعمل حساب ونظّم ماتش مع صحابك.")}</p>}
        <div className={styles.actions}><Link href="/games" className={styles.primary}>{copy("Browse all upcoming games", "شوف كل الماتشات الجاية")}<ArrowUpRight size={20} aria-hidden="true" /></Link></div>
      </section>


      <section id="sports" aria-labelledby="sports-title" className={styles.combinedSports}>
        <div className={styles.sectionHeading}><h2 id="sports-title">{copy("Find players. Play your sport.", "اختار ناس. العب رياضتك.")}</h2><p>{copy("Join games, find sports partners, and discover academies for volleyball, basketball, padel, tennis and beach volleyball in Egypt.", "انضم لماتشات، اختار شركاء للعب، واكتشف أكاديميات لرياضات كرة الطائرة، وكرة السلة، والبادل، والتنس، والطائرة الشاطئية في مصر.")}</p></div>
        <div className={styles.sportsCards}>
          {(["padel", "tennis", "volleyball", "basketball", "beach-volleyball", "archery"] as const).map(item => <article id={item} key={item} className={styles.sportTile} aria-labelledby={`${item}-title`}>
            <div className={styles.sportTileArt} aria-hidden="true"><SportCardArt sport={item} /></div>
            <h3 id={`${item}-title`}>{names[item]}</h3>
            <p>{item === "archery" ? ARCHERY_DESCRIPTION[lang] : item === "tennis" ? TENNIS_DESCRIPTION[lang] : item === "beach-volleyball" ? BEACH_DESCRIPTION[lang] : item === "padel" ? copy("Find padel courts and games in Egypt. Choose your location, level and time for your next rally.", "اكتشف ملاعب وماتشات البادل في مصر. اختار المكان والمستوى والوقت لماتشك الجاي.") : item === "basketball" ? copy("Find basketball games and courts in Egypt. Meet your next team and check the final price before booking.", "اكتشف ماتشات وملاعب كرة السلة في مصر. انضم لفريقك الجاي وراجع السعر النهائي قبل الحجز.") : copy("Join volleyball games in Egypt. Find your level, meet teammates and get back on court.", "انضم لماتشات الكرة الطائرة في مصر. اختار مستواك واتعرّف على فريقك وارجع للملعب.")}</p>
            <Link className={styles.textLink} href={`/dashboard?sport=${item}`}>{item === "archery" ? copy("Explore archery", "اكتشف الرماية بالقوس") : copy("Find games", "شوف الماتشات")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </article>)}
        </div>
      </section>

      <section id="playground-owners" aria-labelledby="playground-owners-title" className={styles.ownerSection}>
        <div className={styles.ownerHeading}>
        <div><p className={styles.eyebrow}>{copy("FOR PLAYGROUND OWNERS", "لأصحاب الملاعب")}</p>
        <h2 id="playground-owners-title" className="mt-3 text-3xl font-extrabold text-secondary sm:text-4xl">{copy("Your playground. More players. Zero commission.", "ملعبك. لاعبين أكتر. من غير عمولة.")}</h2>
        <p className="mb-6 mt-4 max-w-3xl leading-relaxed text-muted-foreground">{copy("List your tennis, padel, basketball, volleyball or beach volleyball courts on Playza and help players in Egypt find their next place to play.", "ضيف ملعبك على بلايزا، سواء تنس أو بادل أو كرة سلة أو كرة طائرة أو طائرة شاطئية، وخلّي اللاعبين يلاقوك بسهولة.")}</p>
        </div><div className={styles.ownerArt} aria-hidden="true"><CourtScene small /><span className={styles.ownerBadge}>0%<small>{copy("COMMISSION", "عمولة")}</small></span><span className={styles.ownerSpark}>✳</span><span className={styles.ownerPin}><MapPin size={22} /></span></div>
        </div>
        <button type="button" className={styles.ownerMotion} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? copy("Play animations", "تشغيل الرسوم المتحركة") : copy("Pause animations", "إيقاف الرسوم المتحركة")}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        <CourtOwnerBenefits />
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            [copy("Reach more players", "وصّل ملعبك للاعبين أكتر"), copy("Show your court photos, location and sport to players browsing Playza.", "اعرض صور ملعبك وموقعه والرياضة للاعبين اللي بيبحثوا على بلايزا.")],
            [copy("Stay in control", "إدارة الملعب في إيدك"), copy("Set your rental price, manage multiple courts and choose weekly availability for each court.", "حدد سعر الإيجار، وأدر أكتر من ملعب، واضبط مواعيد الإتاحة الأسبوعية لكل ملعب.")],
            [copy("Track bookings and payouts", "تابع الحجوزات والمستحقات"), copy("See your booking schedule and follow the payment status of your rental earnings from your owner dashboard.", "راجع جدول الحجوزات وتابع حالة صرف مستحقات الإيجار من لوحة تحكم صاحب الملعب.")],
          ].map(([title, description]) => <li key={title} className="rounded-2xl border bg-card p-5"><h3 className="font-bold text-secondary">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></li>)}
        </ul>
      </section>

      <section id="academy-management" aria-labelledby="academy-management-title" className={`mx-auto max-w-6xl px-6 py-12 ${styles.academyMgmt}`}>
        <div className={styles.academyPanel}>
          <div className={styles.academyCopy}>
          <p className="text-sm font-semibold text-white">{copy("FOR ACADEMY OWNERS", "لأصحاب الأكاديميات")}</p>
          <h2 id="academy-management-title" className="mt-3 text-2xl font-bold text-primary sm:text-3xl">{copy("Run your sports academy with Playza.", "نظّم أكاديميتك مع بلايزا.")}</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{copy("Manage players, subscriptions, training schedules, QR attendance and session finances in one Arabic and English application built for sports academies in Egypt.", "نظّم اللاعبين والاشتراكات وجداول التدريب والحضور عبر QR ومالية الجلسات في تطبيق واحد بالعربية والإنجليزية للأكاديميات الرياضية في مصر.")}</p>
          <Link className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={academyManagementPath(lang)}>{copy("Explore academy management", "اكتشف إدارة الأكاديميات")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className={styles.academyVisual} aria-hidden="true">
            <div className={styles.academyOrbit} />
            <Sparkles className={styles.academySpark} size={32} />
            <div className={styles.academyBoard}>
              <div className={styles.academyBoardHeader}><span className={styles.academyBoardIcon}><CalendarDays size={22} /></span><span>{copy("Your next training", "تمرينك الجاي")}<small>{copy("Everything in one place", "كل حاجة في مكان واحد")}</small></span><span className={styles.academyStatus} /></div>
              <div className={styles.academyCourt}>
                <svg viewBox="0 0 280 140" fill="none"><path d="M32 105L135 25L251 65L147 131Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2" /><path d="M49 102L138 37L232 68L145 119ZM95 68L190 99M143 39L145 119" stroke="currentColor" strokeWidth="1.5" /><path d="M91 65V38L193 72V105M92 45L192 79M92 53L192 87" stroke="white" strokeOpacity=".65" strokeWidth="2" /><circle className={styles.academyBall} cx="160" cy="35" r="9" fill="currentColor" /><path d="M122 41Q145 5 174 24" stroke="currentColor" strokeDasharray="3 5" /></svg>
              </div>
              <div className={styles.academyRoster}><span><Users size={17} />{copy("Players ready", "اللاعبين جاهزين")}</span><div>{[0,1,2,3].map(i => <span key={i}><Check size={12} /></span>)}</div></div>
              <div className={styles.academyProgress}><span /></div>
            </div>
            <div className={styles.academyQr}><QrCode size={32} /><span>{copy("QR check-in", "حضور بالـ QR")}</span><Check size={16} /></div>
            <div className={styles.academySchedule}><CalendarDays size={18} />{copy("Training, organized", "تمرينك متظبط")}</div>
          </div>
        </div>
      </section>

      {process.env.NEXT_PUBLIC_BEACH_GAME_ENABLED !== "false" && <BeachVolleyballGameCard />}

      <ShopShowcase />
      <section className={styles.finalCta}><svg className={styles.ctaStar} viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50 8V92M8 50H92M20 20L80 80M20 80L80 20" fill="none" stroke="currentColor" strokeWidth="12" /></svg><p className={styles.eyebrow}>{copy("LESS PLANNING. MORE PLAYING.", "كلام أقل. لعب أكتر.")}</p><h2>{copy("The court is calling.", "الملعب بيناديك.")}</h2><Link className={styles.primary} href={discoveryPath(lang)}>{copy("Find your next sport", "اكتشف لعبتك الجاية")}<ArrowUpRight size={20} /></Link><p>{copy("Tennis, padel, basketball, volleyball, beach volleyball or archery. Find your people and your next activity.", "تنس، بادل، كرة سلة، كرة طائرة، طائرة شاطئية أو رماية بالقوس. اختار لعبتك واتعرّف على ناس بتحبها.")}</p></section>
    </main>

    <footer className={styles.footer}><div><AppLogo className="w-24" /><p>{copy("A little less online. A lot more on court.", "وقت أقل على الموبايل. ووقت أكتر في الملعب.")}</p></div><nav aria-label={copy("Footer", "روابط إضافية")}><Link href="/shop">{copy("Playza Shop", "متجر بلايزا")}</Link><Link href={discoveryPath(lang, "archery")}>{copy("Archery", "الرماية بالقوس")}</Link><Link href="/games">{copy("Upcoming games", "الماتشات الجاية")}</Link><Link href={discoveryPath(lang, "tennis")}>{copy("Tennis", "التنس")}</Link><Link href="/academies">{copy("Academies", "الأكاديميات")}</Link><Link href={listYourCourtPath(lang)}>{copy("List your playground", "أضف ملعبك")}</Link><Link href={academyManagementPath(lang)}>{copy("For academy owners", "لأصحاب الأكاديميات")}</Link><Link href={discoveryPath(lang, "beach-volleyball")}>{copy("Beach volleyball", "الطائرة الشاطئية")}</Link><Link href={lang === "ar" ? "/ar/guides" : "/guides"}>{copy("Playing guides", "إرشادات اللعب")}</Link><Link href="/faq">{copy("FAQs", "أسئلة شائعة")}</Link></nav><span>© {new Date().getFullYear()} Playza</span></footer>
  </div>;
}
