"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    pageRef.current?.querySelectorAll(`section, article, .${styles.kicker}`).forEach(element => observer.observe(element));
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
        <div className={styles.editorialHero}>
          <Image src="/images/playza-sports-editorial.png" alt="مشاهد رياضية توضيحية لكرة القدم والبادل والسباحة والكرة الطايرة" width={1536} height={1024} priority sizes="(max-width: 700px) 100vw, 50vw" />
          <div className={styles.editorialCaption}><span>أربع رياضات. شغف واحد.</span><strong>اللّمّة بتبدأ هنا.</strong></div>
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
          <div className={styles.sportSelector} role="group" aria-label="اختار رياضتك">{[["football", "كرة قدم"], ["padel", "بادل"], ["swimming", "سباحة"], ["volleyball", "كرة طايرة"]].map(([id, label]) => <button key={id} aria-pressed={sport === id} onClick={() => setSport(id)}>{label}</button>)}</div>
          <SportScene sport={sport} /><span>صور تعبيرية للرياضات، مش صور لأكاديميات مسجلة</span>
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
  const scenes: Record<string, { label: string; position: string }> = {
    football: { label: "كرة قدم", position: "0% 0%" },
    padel: { label: "بادل", position: "100% 0%" },
    swimming: { label: "سباحة", position: "0% 100%" },
    volleyball: { label: "كرة طايرة", position: "100% 100%" },
  };
  const scene = scenes[sport] ?? scenes.football;
  return <div className={styles.sportPhoto} key={sport} role="img" aria-label={`صورة تعبيرية لرياضة ${scene.label}`} style={{ backgroundPosition: scene.position }}><span>{scene.label}</span></div>;
}
