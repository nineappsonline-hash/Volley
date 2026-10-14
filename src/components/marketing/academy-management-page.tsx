import Link from "next/link";
import { Users, CalendarDays, QrCode, Wallet, BarChart3, Smartphone, ArrowUpRight } from "lucide-react";
import { ACADEMY_MANAGEMENT, academyManagementPath } from "@/lib/academy-management";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

const icons = [Users, CalendarDays, QrCode, Wallet, BarChart3, Smartphone];
export function AcademyManagementPage({ lang }: { lang: "en" | "ar" }) {
  const c = ACADEMY_MANAGEMENT[lang];
  const url = `${SITE_URL}${academyManagementPath(lang)}`;
  const graph = [
    breadcrumbsJsonLd([{ name: c.home, url: SITE_URL }, { name: c.title, url }]),
    { "@type": "SoftwareApplication", "@id": `${url}#software`, name: "Playza", url, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: c.description, inLanguage: lang === "ar" ? "ar-EG" : "en", featureList: c.features.map(([title]) => title), publisher: { "@type": "Organization", name: "Playza", url: SITE_URL } },
    { "@type": "FAQPage", mainEntity: c.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
  ];
  return <main lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": graph }) }} />
    <header className="bg-brand text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 text-white" aria-label={c.title}>
        <Link href="/" className="rounded px-2 py-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Playza · {c.home}</Link>
        <Link href={academyManagementPath(lang === "ar" ? "en" : "ar")} hrefLang={lang === "ar" ? "en" : "ar"} className="rounded px-2 py-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{c.switch}</Link>
      </nav>
      <div className="mx-auto max-w-6xl px-6 pb-14 pt-8 sm:pb-20">
        <p className="text-sm font-semibold text-[hsl(var(--playza-lime))]">{c.eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold text-white leading-tight sm:text-5xl">{c.title}</h1>
        <p className="mt-5 text-xl font-medium text-white">{c.heading}</p>
        <p className="mt-4 max-w-3xl leading-relaxed text-white/85">{c.intro}</p>
        <Link href="/signup/tenant" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-brand hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{c.cta}<ArrowUpRight size={18} aria-hidden="true" /></Link>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-6 py-12" aria-labelledby="management-features">
      <h2 id="management-features" className="text-2xl font-bold text-brand">{c.featuresTitle}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{c.features.map(([title, description], i) => { const Icon = icons[i]; return <article key={title} className="rounded-xl border bg-card p-5"><Icon size={24} className="text-brand" aria-hidden="true" /><h3 className="mt-3 font-semibold text-brand">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></article>; })}</div>
    </section>
    <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-12 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold text-brand">{c.workflowTitle}</h2><ol className="mt-4 list-decimal space-y-3 ps-5 text-muted-foreground">{c.workflow.map(step => <li key={step}>{step}</li>)}</ol></div>
      <div className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold text-brand">{c.fitTitle}</h2><p className="mt-4 leading-relaxed text-muted-foreground">{c.fit}</p><Link href="/solutions" className="mt-5 inline-block font-semibold text-brand underline underline-offset-4">{c.solutions}</Link><div className="mt-4 flex flex-wrap gap-3">{["volleyball", "football", "basketball", "padel", "swimming"].map(sport => <Link key={sport} href={`/solutions/${sport}`} className="rounded-lg border px-3 py-2 text-sm text-brand hover:bg-accent">{lang === "ar" ? ({ volleyball: "كرة طائرة", football: "كرة قدم", basketball: "كرة سلة", padel: "بادل", swimming: "سباحة" } as Record<string, string>)[sport] : sport}</Link>)}</div></div>
    </section>
    <section className="mx-auto max-w-4xl px-6 pb-14"><h2 className="text-2xl font-bold text-brand">{c.faqTitle}</h2><div className="mt-6 space-y-3">{c.faqs.map(([q, a]) => <details key={q} className="rounded-xl border bg-card p-5"><summary className="cursor-pointer rounded font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{q}</summary><p className="mt-3 leading-relaxed text-muted-foreground">{a}</p></details>)}</div></section>
  </main>;
}
