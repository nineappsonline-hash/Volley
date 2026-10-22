import Link from "next/link";
import { BadgeCheck, Percent, Search, Image as ImageIcon, CalendarCheck, Clock, LayoutGrid, Languages, ArrowUpRight } from "lucide-react";
import { LIST_YOUR_COURT, listYourCourtPath } from "@/lib/list-your-court";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

const icons = [BadgeCheck, Percent, Search, ImageIcon, CalendarCheck, Clock, LayoutGrid, Languages];

/** Public sports courts linked from the venue owner landing page. */
const SPORTS: { slug: string; en: string; ar: string }[] = [
  { slug: "padel", en: "Padel", ar: "بادل" },
  { slug: "tennis", en: "Tennis", ar: "تنس" },
  { slug: "basketball", en: "Basketball", ar: "باسكت" },
  { slug: "volleyball", en: "Volleyball", ar: "كرة طائرة" },
  { slug: "beach-volleyball", en: "Beach Volleyball", ar: "طائرة شاطئية" },
];

export function ListYourCourtPage({ lang }: { lang: "en" | "ar" }) {
  const c = LIST_YOUR_COURT[lang];
  const ar = lang === "ar";
  const url = `${SITE_URL}${listYourCourtPath(lang)}`;
  const graph = [
    breadcrumbsJsonLd([{ name: c.home, url: SITE_URL }, { name: c.title, url }]),
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: c.title,
      description: c.description,
      inLanguage: ar ? "ar-EG" : "en",
      isPartOf: { "@type": "WebSite", name: "Playza", url: SITE_URL },
    },
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: ar ? "تسجيل الملاعب الرياضية على بلايزا" : "Sports court listing on Playza",
      serviceType: ar ? "تسجيل ملعب رياضي وربطه بالحجز" : "Sports court listing and booking",
      provider: { "@type": "Organization", name: "Playza", url: SITE_URL },
      areaServed: { "@type": "Country", name: "Egypt" },
      description: c.description,
    },
    {
      "@type": "FAQPage",
      mainEntity: c.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
  return (
    <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": graph }) }} />
      <header className="bg-brand text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 text-white" aria-label={c.title}>
          <Link href="/" className="rounded px-2 py-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Playza · {c.home}</Link>
          <Link href={listYourCourtPath(ar ? "en" : "ar")} hrefLang={ar ? "en" : "ar"} className="rounded px-2 py-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{c.switch}</Link>
        </nav>
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-8 sm:pb-20">
          <p className="text-sm font-semibold text-[hsl(var(--playza-lime))]">{c.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-white sm:text-5xl">{c.title}</h1>
          <p className="mt-5 text-xl font-medium text-white">{c.heading}</p>
          <p className="mt-4 max-w-3xl leading-relaxed text-white/85">{c.intro}</p>
          <Link href="/signup/owner" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-brand hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{c.cta}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12" aria-labelledby="owner-benefits">
        <h2 id="owner-benefits" className="text-2xl font-bold text-brand">{c.benefitTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.benefits.map(([title, description], i) => {
            const Icon = icons[i];
            return (
              <article key={title} className="rounded-xl border bg-card p-5">
                <Icon size={24} className="text-brand" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-brand">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-12 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold text-brand">{c.workflowTitle}</h2>
          <ol className="mt-4 list-decimal space-y-3 ps-5 text-muted-foreground">{c.workflow.map(step => <li key={step}>{step}</li>)}</ol>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold text-brand">{c.fitTitle}</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{c.fit}</p>
          <p className="mt-5 font-semibold text-brand">{c.sports}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {SPORTS.map(sport => (
              <Link key={sport.slug} href={`/courts?sport=${sport.slug}`} className="rounded-lg border px-3 py-2 text-sm text-brand hover:bg-accent">{ar ? sport.ar : sport.en}</Link>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-14">
        <h2 className="text-2xl font-bold text-brand">{c.faqTitle}</h2>
        <div className="mt-6 space-y-3">
          {c.faqs.map(([q, a]) => (
            <details key={q} className="rounded-xl border bg-card p-5">
              <summary className="cursor-pointer rounded font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{q}</summary>
              <p className="mt-3 leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
