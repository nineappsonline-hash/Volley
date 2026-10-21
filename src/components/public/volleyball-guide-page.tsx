import Link from "next/link";
import { notFound } from "next/navigation";
import { VOLLEYBALL_GUIDES, guidePath, guideMetadata, type GuideLanguage } from "@/lib/volleyball-guides";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";
export function VolleyballGuidePage({ lang, slug }: { lang: GuideLanguage; slug?: string }) {
  const ar = lang === "ar";
  const guide = VOLLEYBALL_GUIDES.find(g => g.slug === slug);
  if (slug && !guide) notFound();
  const c = guide?.[lang];
  const title = String(guideMetadata(lang, slug).title);
  const link = "inline-flex rounded-lg border bg-card px-4 py-3 font-semibold text-brand hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background px-5 py-8">
    <nav className="mx-auto flex max-w-4xl flex-wrap justify-between gap-4 text-brand"><Link href="/">Playza · {ar ? "الرئيسية" : "Home"}</Link><Link href={guidePath(ar ? "en" : "ar", slug)} hrefLang={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link></nav>
    <article className="mx-auto mt-8 max-w-4xl rounded-2xl border bg-card p-6 sm:p-10">
      <h1 className="text-3xl font-bold text-brand">{title}</h1>
      <p className="mt-4 text-muted-foreground">{c?.description ?? (ar ? "ابدأ بالإرشادات دي واختار نشاطاً مناسباً من الإعلانات الحالية." : "Start with these guides and choose a suitable activity from current listings.")}</p>
      {c?.sections.map(([heading, text]) => <section key={heading} className="mt-7"><h2 className="text-xl font-semibold text-brand">{heading}</h2><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></section>)}
      <div className="mt-8 flex flex-wrap gap-3"><Link className={link} href={`/games?sport=${guide?.sport ?? "volleyball"}`}>{ar ? "راجع الماتشات الجاية" : "View upcoming games"}</Link><Link className={link} href={`${ar ? "/ar" : ""}/courts?sport=${guide?.sport ?? "volleyball"}`}>{ar ? "اكتشف الملاعب" : "Explore courts"}</Link><Link className={link} href="/academies">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link></div>
      <h2 className="mt-9 text-xl font-semibold text-brand">{ar ? "إرشادات اللعب" : "Playing guides"}</h2><ul className="mt-4 space-y-3">{VOLLEYBALL_GUIDES.filter(g => g.slug !== slug).map(g => <li key={g.slug}><Link className="text-brand underline underline-offset-4" href={guidePath(lang, g.slug)}>{g[lang].title}</Link></li>)}</ul>
    </article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [breadcrumbsJsonLd([{ name: "Playza", url: SITE_URL }, { name: title, url: `${SITE_URL}${guidePath(lang, slug)}` }]), { "@type": guide ? "Article" : "CollectionPage", headline: title, name: title, description: c?.description, inLanguage: ar ? "ar-EG" : "en", url: `${SITE_URL}${guidePath(lang, slug)}`, ...(c ? { articleBody: c.sections.map(([h, t]) => `${h}\n${t}`).join("\n\n") } : {}), author: { "@type": "Organization", name: "Playza", url: SITE_URL } }] }) }} />
  </main>;
}
