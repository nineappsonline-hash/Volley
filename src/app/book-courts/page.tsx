import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import {
  SITE_URL,
  OG_IMAGE,
  jsonLdStringify,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  landingFaqItems,
} from "@/lib/seo";

const title = "حجز ملاعب بادل وكرة طائرة | Padel & Volley";
const description = "عاوز تلعب بادل أو volley؟ اكتشف مباريات Playza، اختار الرياضة والمنطقة، وراجع الملعب والميعاد وتكلفة المشاركة قبل الانضمام. دليلك لحجز الملاعب واللعب مع ناس جديدة.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/book-courts" },
  openGraph: { title, description, url: `${SITE_URL}/book-courts`, locale: "ar_EG", type: "website", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
};

const questions: [string, string][] = [
  ["عاوز العب بادل، أبدأ إزاي؟", "افتح مباريات البادل، وشوف المواعيد والأماكن المتاحة. اختار مباراة مناسبة، وسجّل دخولك لمراجعة تفاصيل المشاركة والدفع. لو مفيش مباراة مناسبة، تقدر تنشئ لعبة وتختار من الملاعب المتاحة داخل حسابك."],
  ["عايز ألعب كرة طائرة ومش معايا فريق كامل؟", "مش لازم تبدأ بفريق كامل. شوف ماتشات الكرة الطائرة وعدد الأماكن واللاعبين، وبعدها اختار الماتش اللي يناسبك. الانضمام مرتبط بالأماكن المتاحة وشروط كل لعبة."],
  ["إزاي أعرف تكلفة حجز ملاعب بادل؟", "التكلفة بتختلف حسب الملعب ومدة اللعب وطريقة توزيع المبلغ. راجع تكلفة المشاركة وتفاصيل الدفع داخل اللعبة قبل ما تنضم؛ الأسعار والتوافر بيتحددوا لكل لعبة."],
  ["هل حجز ملاعب volley هو نفسه حجز كرة طائرة؟", "أيوه، كلمة volley هنا بنستخدمها للكرة الطائرة. اختار Volleyball من الرياضات، وراجع تفاصيل المكان علشان تتأكد إنه مناسب لنوع اللعب اللي بتدور عليه."],
  ["أقدر أشوف مكان الملعب قبل المشاركة؟", "تقدر تراجع موقع الملعب وتفاصيله والصور المتاحة، وتستخدم رابط الاتجاهات لما يكون مضاف. راجع الميعاد والمكان قبل تأكيد مشاركتك."],
];

export default function BookCourtsPage() {
  return <main lang="ar" dir="rtl" className="min-h-screen bg-background text-foreground">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({
      "@context": "https://schema.org", "@graph": [
        { "@type": "WebPage", "@id": `${SITE_URL}/book-courts#page`, url: `${SITE_URL}/book-courts`, name: title, description, inLanguage: "ar-EG", about: [{ "@type": "Thing", name: "Padel", alternateName: "بادل" }, { "@type": "Thing", name: "Volleyball", alternateName: ["volley", "كرة طائرة"] }] },
        breadcrumbsJsonLd([{ name: "Playza", url: SITE_URL }, { name: "حجز ملاعب", url: `${SITE_URL}/book-courts` }]),
        faqPageJsonLd(landingFaqItems(questions)),
      ],
    }) }} />
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6"><Link href="/" aria-label="Playza"><AppLogo /></Link><Link href="/games" className="text-sm font-semibold text-primary">شوف المباريات المتاحة</Link></header>
    <div className="mx-auto max-w-5xl space-y-12 px-5 pb-16">
      <section className="rounded-3xl border bg-card p-7 shadow-sm sm:p-12">
        <p className="mb-3 text-sm font-semibold text-primary">Playza · العب واتعرف على لاعبين</p>
        <h1 className="text-3xl font-bold leading-relaxed sm:text-5xl">حجز ملاعب بادل وكرة طائرة</h1>
        <p className="mt-5 max-w-3xl text-lg leading-loose text-muted-foreground">عاوز تنزل تلعب بدل ما تفضل تدوّر على ناس وميعاد ومكان؟ Playza بيساعدك تلاقي مباريات، تراجع تفاصيل الملعب وتكلفة المشاركة، وتنضم للعبة المناسبة ليك. اختار بادل أو كرة طائرة وابدأ بالمواعيد المتاحة.</p>
        <nav aria-label="اختار رياضتك" className="mt-6 flex flex-wrap gap-3"><Link href="#padel" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">حجز ملاعب بادل</Link><Link href="#volley" className="rounded-xl border px-5 py-3 font-semibold">كرة طائرة — Volley</Link></nav>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section id="padel" className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-bold">عاوز العب بادل — Padel</h2><p className="leading-loose text-muted-foreground">ابدأ بمباراة بادل مناسبة لوقتك ومكانك. شوف تاريخ اللعبة ومدتها وعدد المشاركين وتكلفة الفرد. ولو بتنظم لعبتك بنفسك، اختار رياضة البادل وحدد المنطقة، وبعدها اختار ملعب من الخيارات المتاحة.</p><Link href="/games?sport=padel" className="inline-block font-semibold text-primary underline underline-offset-4">شوف مباريات البادل المتاحة</Link></section>
        <section id="volley" className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-bold">عاوز العب volley — كرة طائرة</h2><p className="leading-loose text-muted-foreground">دور على مباراة كرة طائرة تقدر تنضم لها، أو نظّم لعبة وشارك رابطها مع أصحابك. راجع المكان والميعاد وشروط المشاركة وعدد الأماكن قبل الانضمام. ولو بتدور على تدريب منتظم، اكتشف الأكاديميات كمان.</p><Link href="/games?sport=volleyball" className="inline-block font-semibold text-primary underline underline-offset-4">شوف مباريات Volley المتاحة</Link></section>
      </div>
      <section className="space-y-5"><h2 className="text-2xl font-bold">من اختيار الملعب لحد المشاركة</h2><ol className="grid list-inside list-decimal gap-4 sm:grid-cols-3"><li className="rounded-2xl border p-5 leading-loose">اختار الرياضة والمنطقة المناسبة، وراجع الألعاب المتاحة.</li><li className="rounded-2xl border p-5 leading-loose">افتح تفاصيل اللعبة وشوف الملعب والميعاد وعدد اللاعبين والتكلفة.</li><li className="rounded-2xl border p-5 leading-loose">سجّل دخولك واتبع خطوات الانضمام والدفع الظاهرة، وتابع حالتك من حسابك.</li></ol><p className="text-sm leading-loose text-muted-foreground">إرسال إيصال الدفع بيحتاج مراجعة. راجع حالة الدفع والحجز داخل اللعبة، وما تعتبرش إرسال الإيصال وحده تأكيد نهائي.</p></section>
      <section className="space-y-5"><h2 className="text-2xl font-bold">أسئلة عن حجز الملاعب واللعب</h2>{questions.map(([q,a]) => <article key={q} className="rounded-2xl border p-5"><h3 className="text-lg font-semibold">{q}</h3><p className="mt-2 leading-loose text-muted-foreground">{a}</p></article>)}</section>
      <footer className="flex flex-wrap gap-5 border-t pt-6 text-sm"><Link href="/games">كل المباريات</Link><Link href="/academies">اكتشف الأكاديميات</Link><Link href="/solutions/padel">حلول إدارة أكاديميات البادل</Link><Link href="/solutions/volleyball">حلول إدارة أكاديميات الكرة الطائرة</Link><Link href="/faq">الأسئلة الشائعة</Link></footer>
    </div>
  </main>;
}
