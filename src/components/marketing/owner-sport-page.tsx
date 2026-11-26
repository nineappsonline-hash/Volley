import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import { OWNER_SPORTS, ownerSportPath, type OwnerSportLanguage, type OwnerSportSlug } from "@/lib/owner-sport-pages";
import { listYourCourtPath } from "@/lib/list-your-court";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

const slugs = ["padel", "volleyball", "basketball"] as const;

export function OwnerSportPage({ lang, slug }: { lang: OwnerSportLanguage; slug: OwnerSportSlug }) {
  const ar = lang === "ar";
  const copy = OWNER_SPORTS[slug][lang];
  const url = `${SITE_URL}${ownerSportPath(lang, slug)}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: copy.title,
        description: copy.description,
        url,
        provider: { "@type": "Organization", name: "Playza", url: SITE_URL },
        areaServed: { "@type": "Country", name: "Egypt" }
      },
      {
        "@type": "WebPage", "@id": `${url}#webpage`, url, name: copy.title,
        description: copy.description, inLanguage: ar ? "ar-EG" : "en"
      },
      breadcrumbsJsonLd([
        { name: ar ? "الرئيسية" : "Home", url: SITE_URL },
        { name: ar ? "تسجيل ملعبك" : "List your court", url: `${SITE_URL}${listYourCourtPath(lang)}` },
        { name: copy.title, url }
      ])
    ]
  };
  return <main lang={ar ? "ar-EG" : "en"} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify(schema) }} />
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6">
      <Link href="/" aria-label="Playza"><AppLogo /></Link>
      <Link href={ownerSportPath(ar ? "en" : "ar", slug)} hrefLang={ar ? "en" : "ar-EG"} className="underline underline-offset-4">{ar ? "English" : "العربية"}</Link>
    </header>
    <section className="bg-brand px-5 py-14 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="font-semibold text-highlight">{ar ? "لأصحاب الملاعب" : "FOR COURT OWNERS"} · Playza</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight sm:text-5xl">{copy.title}</h1>
        <h2 className="mt-5 text-xl font-semibold">{copy.heading}</h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/90">{copy.intro}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup/owner" className="inline-flex rounded-xl bg-primary px-6 py-3 font-bold text-brand">{ar ? "سجّل ملعبك مجانًا" : "List your court for free"}</Link>
          <Link href={listYourCourtPath(lang)} className="inline-flex rounded-xl border border-white px-6 py-3 font-semibold text-white">{ar ? "كل تفاصيل إضافة الملاعب" : "How court listing works"}</Link>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-5xl space-y-12 px-5 py-12">
      <section>
        <p className="text-lg leading-relaxed">{copy.audience}</p>
        <h2 className="mt-7 text-2xl font-bold">{copy.benefitsTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{copy.benefits.map(([title, description]) =>
          <article key={title} className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
          </article>
        )}</div>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-2xl font-bold">{copy.workflowTitle}</h2>
        <ol className="mt-5 list-decimal space-y-4 ps-6 leading-relaxed">{copy.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <Link className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href="/signup/owner">{ar ? "ابدأ تسجيل ملعبك" : "Start registering your court"}</Link>
      </section>
      <section>
        <h2 className="text-2xl font-bold">{ar ? "أسئلة شائعة لأصحاب الملاعب" : "Common court-owner questions"}</h2>
        <div className="mt-5 space-y-3">{copy.faq.map(([q, a]) =>
          <details key={q} className="rounded-xl border bg-card p-5">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-3 text-muted-foreground leading-relaxed">{a}</p>
          </details>
        )}</div>
      </section>
      <p className="rounded-xl border p-5 text-sm leading-relaxed text-muted-foreground">{copy.disclaimer}</p>
      <nav aria-label={ar ? "خدمات للملاعب" : "More venue owner solutions"} className="border-t pt-6">
        <h2 className="font-bold">{ar ? "شوف الحلول لباقي أنواع الملاعب" : "Other court types"}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {slugs.filter(item => item !== slug).map(item => <Link key={item} className="rounded-xl border px-4 py-2 font-semibold underline-offset-4 hover:underline" href={ownerSportPath(lang, item)}>{OWNER_SPORTS[item][lang].title}</Link>)}
        </div>
      </nav>
    </div>
  </main>;
}
