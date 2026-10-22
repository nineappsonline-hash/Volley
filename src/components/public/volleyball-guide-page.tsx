import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_GUIDES, guidePath, guideMetadata, findGuide, type GuideLanguage } from "@/lib/guides";
import { SITE_URL, breadcrumbsJsonLd, jsonLdStringify } from "@/lib/seo";

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  player: { en: "Player discovery guides", ar: "أدلة لاقي ناس تلعب" },
  academy: { en: "Academy guides", ar: "أدلة الأكاديميات" },
};

const VolleyballGuidePage = ({ lang, slug }: { lang: GuideLanguage; slug?: string }) => {
  const ar = lang === "ar";
  const guide = findGuide(slug ?? "");
  if (slug && !guide) notFound();
  const c = guide?.[lang];
  const title = String(guideMetadata(lang, slug).title);
  const description = (guideMetadata(lang, slug).description ?? "") as string;
  const link = "inline-flex rounded-lg border bg-card px-4 py-3 font-semibold text-brand hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
  const related = guide
    ? ALL_GUIDES
        .filter(g => g.slug !== slug && (g.category === guide.category || g.sport === guide.sport))
        .sort((a, b) => Number(b.sport === guide.sport) - Number(a.sport === guide.sport))
        .slice(0, 6)
    : [];
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background px-5 py-8">
    <nav className="mx-auto flex max-w-4xl flex-wrap justify-between gap-4 text-brand"><Link href="/">Playza · {ar ? "الرئيسية" : "Home"}</Link><Link href={guidePath(ar ? "en" : "ar", slug)} hrefLang={ar ? "en" : "ar-EG"} lang={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link></nav>
    <article className="mx-auto mt-8 max-w-4xl rounded-2xl border bg-card p-6 sm:p-10">
      <h1 className="text-3xl font-bold text-brand">{title}</h1>
      <p className="mt-4 text-muted-foreground">{description}</p>
      {guide && c ? c.sections.map(([heading, text]) => <section key={heading} className="mt-7"><h2 className="text-xl font-semibold text-brand">{heading}</h2><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></section>) : (
        <div className="mt-8 space-y-8">
          {(["player", "academy"] as const).map(category => (
            <section key={category}>
              <h2 className="text-2xl font-bold text-brand">{CATEGORY_LABELS[category][lang]}</h2>
              <ul className="mt-4 grid gap-3">
                {ALL_GUIDES.filter(g => g.category === category).map(g => (
                  <li key={g.slug} className="rounded-xl border p-4">
                    <Link href={guidePath(lang, g.slug)} className="font-semibold text-brand underline underline-offset-4">{g[lang].title}</Link>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g[lang].description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {guide && c && <div className="mt-8 flex flex-wrap gap-3">
        <Link className={link} href={guide.category === "player" ? `/games?sport=${guide.sport}` : "/academies"}>{c.cta}</Link>
        {guide.category === "player" ? <Link className={link} href="/academies">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link> : <Link className={link} href={`/games?sport=${guide.sport}`}>{ar ? "راجع الماتشات الجاية" : "View upcoming games"}</Link>}
      </div>}
      {guide && related.length > 0 && <h2 className="mt-9 text-xl font-semibold text-brand">{ar ? "أدلة مرتبطة" : "Related guides"}</h2>}
      {guide && related.length > 0 && <ul className="mt-4 space-y-3">{related.map(relatedGuide => <li key={relatedGuide.slug}><Link className="text-brand underline underline-offset-4" href={guidePath(lang, relatedGuide.slug)}>{relatedGuide[lang].title}</Link></li>)}</ul>}
    </article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [breadcrumbsJsonLd([{ name: "Playza", url: SITE_URL }, { name: title, url: `${SITE_URL}${guidePath(lang, slug)}` }]), { "@type": guide ? "Article" : "CollectionPage", headline: title, name: title, description: c?.description, inLanguage: ar ? "ar-EG" : "en", url: `${SITE_URL}${guidePath(lang, slug)}`, ...(c ? { articleBody: c.sections.map(([h, t]) => `${h}\n${t}`).join("\n\n") } : {}), author: { "@type": "Organization", name: "Playza", url: SITE_URL } }] }) }} />
  </main>;
};

export { VolleyballGuidePage };
