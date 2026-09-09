"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, Check, CalendarDays, QrCode, Users, TrendingUp, MessageCircle, MapPin, Wallet, Trophy, Heart, Volleyball, Menu, X } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import styles from "./landing.module.css";

const audiences = [
  { label: "أنا لاعب", icon: Volleyball, title: "ناقصك ناس تلعب معاهم؟", text: "بدل ما تستنى الجروب يتفق، اكتشف ماتش مناسب لرياضتك ومنطقتك. شوف الميعاد وعدد اللاعبين والتكلفة المتوقعة، وانضم واتفق مع المشاركين في شات الماتش.", points: ["ماتشات عامة، وماتشات خاصة بكود دعوة", "اعرف نصيبك المتوقع من إيجار الملعب قبل ما تنضم", "أكاديميات وتدريبات تقدر تكتشفها"], cta: "ابدأ رحلتك", href: "/signup" },
  { label: "أنا ولي أمر", icon: Heart, title: "خليك قريب من رحلة ابنك الرياضية.", text: "مش لازم تعمل حساب منفصل لكل طفل. بعد ما تنضم لأكاديمية، ضيف ولادك من حسابك، وافتح ملف كل واحد عشان تشوف حضوره واشتراكه وتقييمات أدائه. كده المتابعة تبقى أوضح من مجرد سؤال: التمرين كان عامل إيه؟", points: ["ملف مستقل لكل طفل من حساب ولي الأمر", "تقييمات في المهارة واللياقة والتكتيك والالتزام", "مقارنة التقييمات عشان تلاحظ التطور مع الوقت"], cta: "اكتشف أكاديمية لولادك", href: "/academies" },
  { label: "أنا صاحب أكاديمية", icon: Trophy, title: "وقت أقل في الإدارة. تركيز أكتر في الملعب.", text: "لما الحضور في كشكول والمدفوعات في شيت والمواعيد في جروب، تفاصيل كتير بتضيع. بلايزا بيجمع إدارة الأعضاء والمدربين والفرق والاشتراكات في مكان واحد، مع تقارير تساعدك تفهم وضع أكاديميتك.", points: ["سجّل الحضور بكاميرا الموبايل وكود اللاعب", "حدد باقات التدريب وسعر الحصة التجريبية", "تابع الإيرادات والمصروفات وتقارير الربح والخسارة"], cta: "سجّل أكاديميتك", href: "/signup" },
];
const features = [
  { icon: CalendarDays, title: "ميعادك معروف، من غير لخبطة", text: "جدول التدريب بيجمع المواعيد والمكان والتفاصيل. والأكاديمية تقدر تنظم مواعيد متكررة بدل ما تبدأ من الصفر كل مرة." },
  { icon: QrCode, title: "حضور أسرع بكود خاص بيك", text: "كل عضو ليه QR خاص بيه. مسؤول الأكاديمية يمسحه بالكاميرا لتسجيل الحضور، وولي الأمر يقدر يفتح كود ابنه من ملفه." },
  { icon: TrendingUp, title: "تطور تقدر تلاحظه", text: "شوف تقييمات الأداء وملاحظات المدرب المسجلة من الأكاديمية. قارن آخر تقييم باللي قبله، واعرف نقاط القوة والجوانب اللي محتاجة شغل." },
  { icon: Wallet, title: "اشتراكات وحسابات أوضح", text: "العضو يتابع مدفوعاته والحصص المتبقية. وصاحب الأكاديمية ينظم الباقات ويسجل المصروفات ويتابع تقارير الماليات." },
  { icon: MessageCircle, title: "الكلام عن الماتش في مكانه", text: "شات خاص بالمشاركين الحاليين في كل ماتش، عشان تتفقوا على التفاصيل وتجمعوا الفريق من غير ما الكلام يضيع وسط جروبات تانية." },
  { icon: MapPin, title: "اكتشف مكانك في الرياضة", text: "اتصفح الأكاديميات ومواقعها والرياضات المتاحة، وشوف تفاصيل التدريب والأسعار اللي الأكاديمية محدداها قبل ما تقرر تنضم." },
];

export function LandingPage() {
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
    pageRef.current?.querySelectorAll("section, article").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const [audience, setAudience] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = audiences[audience];
  const [sport, setSport] = useState("football");
  return (
    <main ref={pageRef} dir="rtl" lang="ar-EG" data-paused={paused} className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="بلايزا — الرئيسية"><AppLogo className="w-28" /></Link>
        <nav aria-label="القائمة الرئيسية" className={styles.desktopNav}><a href="#about">إيه بلايزا؟</a><a href="#for-you">بلايزا ليك</a><a href="#features">المميزات</a><a href="#questions">أسئلة شائعة</a></nav>
        <div className={styles.headerActions}><Link href="/login">دخول</Link><Link className={styles.smallCta} href="/signup">يلا نبدأ <ArrowUpLeft size={16} /></Link><button className={styles.menuButton} aria-label={menuOpen ? "اقفل القائمة" : "افتح القائمة"} aria-expanded={menuOpen} aria-controls="home-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
        {menuOpen && <nav id="home-menu" className={styles.mobileNav} aria-label="أقسام الصفحة">{[["about", "إيه بلايزا؟"], ["for-you", "بلايزا ليك"], ["features", "المميزات"], ["questions", "أسئلة شائعة"]].map(([id, text]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{text}</a>)}</nav>}
      </header>

      <section id="about" className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.eyebrow}><span /> لعب أكتر. تنظيم أسهل.</span><h1>نفسك تلعب؟<br /><em>لاقي لَمّتك مع بلايزا.</em></h1><p>دور على ماتش ودي، اتعرف على لاعبين بيحبوا نفس رياضتك، أو اكتشف أكاديمية تتمرن فيها. ولو بتتابع ولادك أو بتدير أكاديمية، هتلاقي أدوات تسهّل عليك المواعيد والحضور ومتابعة التطور.</p><div className={styles.actions}><Link className={styles.cta} href="/signup">يلا نبدأ <ArrowUpLeft size={20} /></Link><Link className={styles.secondary} href="/academies">اكتشف الأكاديميات <MapPin size={18} /></Link></div><p className={styles.heroNote}>مش لازم تكون مشترك في أكاديمية عشان تبدأ.</p></div>
        <div className={styles.visual} role="img" aria-label="رسم توضيحي لملعب مع بطاقات تمثل تنظيم التدريب ومتابعة الأداء">
          <div className={styles.heroSparks} aria-hidden="true"><span>✦</span><span>+</span><span>✦</span></div><span className={styles.orbit} /><div className={styles.sportBadge} aria-hidden="true"><Trophy size={26} /></div><div className={styles.court}><div className={styles.courtInner}><span className={styles.centerLine} /><span className={styles.centerCircle} /><span className={styles.goalOne} /><span className={styles.goalTwo} /><i className={styles.playerOne} /><i className={styles.playerTwo} /><i className={styles.playerThree} /><i className={styles.playerFour} /><Volleyball className={styles.ball} size={44} /></div><span className={styles.courtLabel}>اللعبة بتحلى باللّمّة</span></div>
          <div className={styles.floatingCard}><span className={styles.iconGreen}><Check size={20} /></span><div><strong>خطوة في الملعب</strong><small>وخطوة لقدّام في مستواك</small></div></div>
          <div className={styles.progressCard}><TrendingUp size={22} /><strong>كل تمرينة بتفرق</strong><div className={styles.bars}>{[30, 48, 40, 65, 72, 94].map((height, i) => <span key={i} style={{ height: `${height}%`, animationDelay: `${i * 100}ms` }} />)}</div><small>تابع رحلتك، وشوف تطورك</small></div>
          <span className={styles.visualCaption}>رسم توضيحي للمميزات، مش بيانات فعلية</span>
        </div>
      </section>
      <div className={styles.sports} aria-label="رياضات مختلفة"><span>رياضتك إيه؟</span>{["كرة قدم", "كرة طايرة", "بادل", "باسكت", "سباحة"].map(sport => <span key={sport}><Volleyball size={16} />{sport}</span>)}</div>

      <section className={`${styles.section} ${styles.playTogether}`}>
        <div><span className={styles.kicker}>لأي حد بيحب يلعب</span><h2>الناس موجودة.<br />ناقص بس تتجمعوا.</h2><p>مش كل مرة لازم تلف على أصحابك وتسأل مين فاضي. على بلايزا تقدر تلاقي ماتشات ودية، تشوف المكان والميعاد وعدد المشاركين، وتختار اللي يناسبك. أو تنظم ماتش بنفسك وتدعو ناس تلعب معاك.</p><p>وقبل ما تنزل، شوف تقدير تكلفة الملعب لكل لاعب واتفقوا على التفاصيل في شات خاص بالمشاركين. كده تنزل وإنت عارف رايح فين وهتلعب مع مين.</p><Link className={styles.cta} href="/signup">اعمل حساب وابدأ تلعب <ArrowUpLeft size={20} /></Link></div>
        <div className={styles.matchGraphic} aria-label="رسم توضيحي للتنسيق بين المشاركين، مش محادثة حقيقية"><div className={styles.matchGraphicTitle}><span className={styles.iconGreen}><Users size={24} /></span><div><strong>اللّمّة تبدأ من هنا</strong><small>من أول الاتفاق… لحد صافرة البداية</small></div></div><div className={styles.chatBubble}>مين جاهز يلعب؟ <Volleyball size={18} /></div><div className={styles.chatReply}>أنا معاكم! نتقابل في الملعب 🙌</div><div className={styles.matchChecklist}><span><MapPin size={18} /> مكان معروف</span><span><CalendarDays size={18} /> ميعاد واضح</span><span><Wallet size={18} /> تكلفة متوقعة</span></div><small className={styles.illustrationNote}>مثال توضيحي لفكرة شات الماتش</small></div>
      </section>

      <section className={styles.arenaSection}>
        <div className={styles.arenaCopy}><span className={styles.kicker}>كلنا بنبدأ بخطوة</span><h2>من «نفسي ألعب»<br />لـ «معادي في الملعب».</h2><p>رياضتك، أصحابك، وتمرينتك الجاية. بلايزا بيقرّبك من اللّمّة اللي بتستناها.</p><Link className={styles.cta} href="/signup">خد أول خطوة <ArrowUpLeft size={20} /></Link></div>
        <div className={styles.arenaArt}>
          <div className={styles.sportSelector} role="group" aria-label="اختار رياضة للرسم المتحرك">{[["football", "كرة قدم"], ["padel", "بادل"], ["swimming", "سباحة"], ["volleyball", "كرة طايرة"]].map(([id, label]) => <button key={id} aria-pressed={sport === id} onClick={() => setSport(id)}>{label}</button>)}</div>
          {sport !== "volleyball" ? <SportScene sport={sport} /> : (
          <svg viewBox="0 0 640 390" role="img" aria-label="رسم رياضي للاعبين بيلعبوا كرة طايرة تحت أضواء الملعب">
            <defs><linearGradient id="arena-floor" x2="0" y2="1"><stop stopColor="#1b5661"/><stop offset="1" stopColor="#0b1f3b"/></linearGradient><radialGradient id="arena-light"><stop stopColor="#22d48b" stopOpacity=".3"/><stop offset="1" stopColor="#22d48b" stopOpacity="0"/></radialGradient></defs>
            <ellipse cx="320" cy="205" rx="300" ry="180" fill="url(#arena-light)"/>
            <path d="M60 300 250 215 590 275 390 365Z" fill="url(#arena-floor)" stroke="#63e4b2" strokeWidth="2"/>
            <path d="m100 301 153-65 286 44-155 67Z M330 249l-159 68" fill="none" stroke="#8aeac7" strokeOpacity=".5"/>
            <g stroke="#a2ceda" strokeWidth="3"><path d="M310 160v155M490 119v156"/><path d="m310 169 180-41v76l-180 42Z" fill="#ffffff08"/></g>
            <g stroke="#c5e4e8" strokeOpacity=".35"><path d="m310 188 180-41m-180 60 180-41m-180 60 180-41M340 162v77m30-84v77m30-84v77m30-84v77m30-84v77"/></g>
            <g className={styles.athleteOne} strokeLinecap="round" strokeLinejoin="round"><ellipse cx="204" cy="310" rx="43" ry="9" fill="#0003"/><circle cx="208" cy="173" r="17" fill="#f3ba88"/><path d="m196 198-17 53 44 5 3-49" fill="#22d48b"/><path d="m200 205-27-24-10-33m58 59 24-37 19-18" fill="none" stroke="#f3ba88" strokeWidth="13"/><path d="m191 258-16 25-18 20m57-47 15 29 22 19" fill="none" stroke="#74a4ff" strokeWidth="16"/><path d="m148 306 17 1m81 0 18 2" stroke="#fff" strokeWidth="9"/></g>
            <g className={styles.athleteTwo} strokeLinecap="round" strokeLinejoin="round"><ellipse cx="434" cy="300" rx="39" ry="8" fill="#0003"/><circle cx="433" cy="190" r="15" fill="#cd8b62"/><path d="m420 209-7 41 39 4-6-42" fill="#3b82f6"/><path d="m420 215-28 7-15-16m68 11 25 3 19-17" fill="none" stroke="#cd8b62" strokeWidth="12"/><path d="m420 253-10 26-17 12m48-36 17 21 2 15" fill="none" stroke="#22d48b" strokeWidth="14"/><path d="m385 295 16 0m54 1 16 1" stroke="#fff" strokeWidth="8"/></g>
            <g className={styles.arenaBall}><circle cx="305" cy="92" r="22" fill="#fff"/><path d="M284 91q22-18 42 0m-21-21q-13 22 0 43m-17-8q25 3 33-20" stroke="#3b82f6" strokeWidth="3" fill="none"/></g>
            <g fill="#ffbd59"><path d="m128 92 4 10 11 3-11 3-4 11-3-11-11-3 11-3Z"/><path d="m514 69 3 8 8 2-8 3-3 8-2-8-8-3 8-2Z"/></g>
          </svg>)}<span>اللعب بيجمعنا — اختار رياضتك وشوف الحركة</span>
        </div>
      </section>

      <section id="for-you" className={styles.section}>
        <div className={styles.sectionHeading}><span className={styles.kicker}>كل واحد ليه رحلة</span><h2>بلايزا معمول ليك.</h2><p>اختار دورك وشوف إزاي يومك الرياضي ممكن يبقى أسهل.</p></div>
        <div className={styles.audienceButtons} role="group" aria-label="اختار دورك">{audiences.map((item, index) => <button key={item.label} aria-pressed={index === audience} onClick={() => setAudience(index)}><item.icon size={19} />{item.label}</button>)}</div>
        <div className={styles.audiencePanel} key={audience}><div><span className={styles.kicker}>{current.label}</span><h3>{current.title}</h3><p>{current.text}</p><Link className={styles.textLink} href={current.href}>{current.cta} <ArrowUpLeft size={19} /></Link></div><div className={styles.benefits}>{current.points.map((point, i) => <div key={point}><span>0{i + 1}</span><p>{point}</p><Check size={20} /></div>)}</div></div>
      </section>

      <section id="features" className={`${styles.section} ${styles.featureSection}`}><div className={styles.sectionHeading}><span className={styles.kicker}>تفاصيل صغيرة، فرق كبير</span><h2>أقل «التمرين إمتى؟»<br />وأكتر «يلا نلعب!»</h2><p>أدوات عملية بتحل لخبطة المواعيد والمتابعة والحسابات، وتسيبلك مساحة تركز في الرياضة.</p></div><div className={styles.featureGrid}>{features.map((feature, index) => <article className={styles.featureCard} key={feature.title}><div className={styles.featureTop}><feature.icon size={26} /><span>0{index + 1}</span></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>

      <section className={styles.section}><div className={styles.stepsHeading}><div><span className={styles.kicker}>من الشاشة للملعب</span><h2>البداية أبسط مما تتخيل.</h2></div><Link className={styles.secondary} href="/signup">اعمل حسابك <ArrowUpLeft size={18} /></Link></div><div className={styles.steps}>{[["اعمل حسابك", "سجّل كلاعب أو ولي أمر، أو اختار إنشاء أكاديمية لو بتدير مكان للتدريب."], ["اختار طريقك", "اكتشف أكاديمية وانضم ليها، أو دور على ماتش مناسب. وصاحب الأكاديمية يبدأ يجهز فرق ومواعيد التدريب."], ["العب وتابع", "خليك متابع لمواعيدك وحضورك وتقييماتك. ولو ولي أمر، تابع كل طفل من ملفه الخاص." ]].map(([title, text], i) => <article key={title}><span>{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section id="questions" className={`${styles.section} ${styles.faq}`}><div><span className={styles.kicker}>قبل ما تبدأ</span><h2>ممكن تكون بتسأل…</h2><p>ودي إجابات تساعدك تاخد أول خطوة.</p></div><div>{[["لازم أكون مشترك في أكاديمية عشان أستخدم بلايزا؟", "لأ، تقدر تعمل حساب وتكتشف المجتمع والماتشات الودية من غير ما تكون تابع لأكاديمية. بعض المميزات مرتبطة بنوع اشتراكك، وتقدر تشوف تفاصيل الباقات من حسابك."], ["أقدر أتابع أكتر من طفل من نفس الحساب؟", "أيوه. بعد ما تنضم لأكاديمية، تقدر تضيف أفراد عيلتك وتفتح ملف كل طفل لوحده لمتابعة بياناته وحضوره ومدفوعاته وتقييماته المتاحة."], ["السعر اللي ظاهر للماتش ده سعر نهائي؟", "ده تقدير لنصيب اللاعب من إيجار الملعب حسب سعر الساعة ومدة الماتش والحد الأدنى والأقصى للاعبين، والمنظم محسوب ضمن العدد. رسوم إنشاء الماتش وأي إضافات مش داخلة في التقدير."], ["مين بيسجّل التقييم والحضور؟", "إدارة الأكاديمية بتسجّل تقييمات الأداء وملاحظات المدرب، وبتقدر تستخدم ماسح QR لتسجيل الحضور. العضو وولي أمره يقدروا يشوفوا التقييمات الخاصة بيهم." ]].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
      <section className={styles.finalCta}><div><span className={styles.kicker}>الخطوة الجاية ليك</span><h2>سيب اللخبطة برّه الملعب.</h2><p>ابدأ مع بلايزا، وخلي تركيزك في اللي بتحبه.</p></div><Link className={styles.cta} href="/signup">جاهز؟ يلا نبدأ <ArrowUpLeft size={22} /></Link></section>
      <footer className={styles.footer}><AppLogo className="w-24" /><p>بلايزا — مكان يجمعنا على حب الرياضة.</p><button className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "تشغيل الحركة" : "إيقاف الحركة"}</button><div><Link href="/academies">الأكاديميات</Link><Link href="/login">تسجيل الدخول</Link><a href="#about">ارجع لفوق ↑</a></div></footer>
    </main>
  );
}


function SportScene({ sport }: { sport: string }) {
  const swimming = sport === "swimming";
  const padel = sport === "padel";
  return <svg key={sport} viewBox="0 0 640 390" role="img" aria-label={swimming ? "سبّاح بيتحرك وسط حارات حمام السباحة" : padel ? "لاعبين بادل بيتبادلوا الكرة بالمضارب" : "لاعب كرة قدم بيسدد الكرة ناحية المرمى"}>
    <path d="M55 290 225 145 592 224 411 369Z" fill={swimming ? "#126f9c" : "#155443"} stroke="#73dfcc" strokeWidth="2" />
    {swimming ? <>
      <g stroke="#ffcc72" strokeWidth="4" strokeDasharray="9 7"><path d="m104 303 170-145m-90 165 170-145m-90 165 170-145m-90 165 170-145" /></g>
      <g className={styles.waterWaves} fill="none" stroke="#8adcf3" strokeWidth="2" strokeOpacity=".7"><path d="M145 260q15-12 30 0t30 0m100 60q15-12 30 0t30 0M300 200q15-12 30 0t30 0M400 265q15-12 30 0t30 0" /></g>
      <g className={styles.swimmer} strokeLinecap="round"><path d="m270 259 55-38" stroke="#22d48b" strokeWidth="23"/><circle cx="338" cy="211" r="15" fill="#f2bb91"/><path d="m328 201q16-16 23 4" stroke="#ffcd66" strokeWidth="11"/><path d="m313 229-4-34 35-14m-42 55 35 14 24-17" stroke="#f2bb91" strokeWidth="11" fill="none"/><path d="m273 257-26 3-20 20m47-15-9 24-21 6" stroke="#f2bb91" strokeWidth="10" fill="none"/><path d="m219 255-18 8m27 27-18 9m137-32 22 0" stroke="#d8f8ff" strokeWidth="3"/></g>
    </> : <>
      <path d="m90 288 146-125 316 68-146 118Z M248 328l147-126" stroke="#c5efdb" strokeWidth="2" fill="none"/>
      {padel ? <g stroke="#b3d7ef" fill="none"><path d="M70 280V112l170-85 340 74v122" strokeWidth="3" opacity=".4"/><path d="M320 178v135m-10-125 170 32v-56l-170-31Z" fill="#ffffff0b" strokeWidth="2"/><path d="m310 150 170 32m-170-16 170 32m-130-57v52m40-46v53m40-46v53" opacity=".5"/></g> : <g stroke="#e3f3eb" fill="none" strokeWidth="3"><ellipse cx="326" cy="264" rx="43" ry="23" transform="rotate(-30 326 264)"/><path d="M452 255V165l87 18v89m-87-107 19-17 89 18v87l-21 19m-68-124v89l89 16"/><path d="m471 172 89 17m-89 0 89 17m-89 0 89 17m-89 0 89 17m-66-86v88m22-83v88m22-83v87" strokeWidth="1" opacity=".45"/></g>}
      <g className={styles.athleteOne} strokeLinecap="round"><circle cx="211" cy="205" r="16" fill="#e9ae7c"/><path d="m200 226-10 42 34 3 2-40" fill="#22d48b"/><path d="m203 231-28 22m47-17 27-17" stroke="#e9ae7c" strokeWidth="11"/><path d="m199 273-14 31m33-30 31 13" stroke="#70a5ff" strokeWidth="14"/><path d="m175 307 19 0m50-17 16-1" stroke="#fff" strokeWidth="8"/>
      {padel && <g transform="rotate(25 261 200)"><path d="M259 222v-19" stroke="#fff" strokeWidth="7"/><ellipse cx="259" cy="185" rx="17" ry="23" fill="#182945" stroke="#ffca6c" strokeWidth="4"/><path d="m251 173 16 24m0-24-16 24" stroke="#9fb9cf" strokeWidth="2"/></g>}</g>
      {padel && <g className={styles.athleteTwo} strokeLinecap="round"><circle cx="459" cy="155" r="14" fill="#bf805d"/><path d="m449 175-8 36 31 4-1-35" fill="#3b82f6"/><path d="m449 184-30 11m47-9 19 15" stroke="#bf805d" strokeWidth="10"/><path d="m448 215-9 24m24-23 16 26" stroke="#22d48b" strokeWidth="12"/><path d="m420 196-17-12" stroke="#fff" strokeWidth="6"/><ellipse cx="392" cy="172" rx="14" ry="20" fill="#182945" stroke="#ffca6c" strokeWidth="4"/></g>}
      <g className={padel ? styles.padelBall : styles.footballBall}><circle cx="291" cy="267" r={padel ? 7 : 15} fill={padel ? "#e4fa60" : "#fff"}/>{!padel && <path d="m291 258 8 6-3 9h-10l-3-9Z" fill="#0b1f3b"/>}</g>
    </>}
  </svg>;
}
