import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, LandPlot, ArrowUpRight } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { courtsPath, courtDirectoryMetadata } from "@/lib/court-discovery";
import { findDiscoverySport, discoveryPath, type DiscoveryLanguage } from "@/lib/sport-discovery";
import { sportToSlug } from "@/lib/sport-slugs";
import { formatMoney } from "@/lib/constants";
import { SITE_URL, jsonLdStringify, breadcrumbsJsonLd } from "@/lib/seo";
import { courtsLocationPath, locationLabel, locationSlugsWithInventory } from "@/lib/court-locations";
import { listYourCourtPath } from "@/lib/list-your-court";

export async function CourtDirectory({ lang, slug }: { lang: DiscoveryLanguage; slug?: string }) {
  const selected = slug ? findDiscoverySport(slug) : undefined;
  if (slug && !selected) notFound();
  const all = await getPublicCourtDirectory();
  const courts = selected ? all.filter(c => c.sport?.name.toLowerCase() === selected.name.toLowerCase()) : all;
  const sports = [...new Set(all.flatMap(c => c.sport ? [c.sport.name] : []))];
  const regions = selected ? locationSlugsWithInventory(courts, selected.name) : [];
  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const metadata = courtDirectoryMetadata(lang, slug);
  const title = metadata.title as string;
  const href = courtsPath(lang, slug);
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
    <header className="border-b bg-card"><nav aria-label={copy("Court navigation", "روابط الملاعب")} className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
      <Link href="/" aria-label="Playza"><AppLogo /></Link>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold"><Link href={discoveryPath(lang)}>{copy("Sports", "الرياضات")}</Link><Link href={courtsPath(ar ? "en" : "ar", slug)} lang={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link><Link href="/login">{copy("Log in", "تسجيل الدخول")}</Link></div>
    </nav></header>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: title, description: metadata.description, url: `${SITE_URL}${href}`, inLanguage: ar ? "ar-EG" : "en" },
      breadcrumbsJsonLd([{ name: copy("Home", "الرئيسية"), url: SITE_URL }, { name: title, url: `${SITE_URL}${href}` }]),
      { "@type": "ItemList", name: title, numberOfItems: courts.length, itemListElement: courts.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE_URL}/p/${encodeURIComponent(c.id)}` })) },
    ] }) }} />
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <section className="rounded-3xl bg-brand px-5 py-7 text-white sm:p-9"><h1 className="text-2xl font-extrabold text-white sm:text-3xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85">{metadata.description}</p></section>
      <nav aria-label={copy("Filter by sport", "اختار الرياضة")} className="flex flex-wrap gap-2">
        {[{ name: copy("All sports", "كل الرياضات"), slug: undefined }, ...sports.map(name => ({ name: ar ? findDiscoverySport(sportToSlug(name))?.arabic ?? name : name, slug: sportToSlug(name) }))].map(item => <Link key={item.slug ?? "all"} href={courtsPath(lang, item.slug)} aria-current={item.slug === slug ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${item.slug === slug ? "border-brand bg-accent text-accent-foreground" : "bg-card hover:bg-accent"}`}>{item.name}</Link>)}
      </nav>
      {selected && regions.length > 0 && <section aria-labelledby="courts-by-area" className="rounded-2xl border bg-card p-5">
        <h2 id="courts-by-area" className="text-lg font-bold">{copy(`${selected.name} courts by area`, `ملاعب ${selected.arabic} حسب المنطقة`)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy("Choose an area with real published courts to compare locations, rental prices and individual venues.", "اختار منطقة فيها ملاعب منشورة فعلًا، وقارن العناوين والأسعار وتفاصيل الملاعب.")}</p>
        <nav aria-label={copy("Court locations", "مناطق الملاعب")} className="mt-4 flex flex-wrap gap-2">
          {regions.map(region => <Link key={region} href={courtsLocationPath(lang, selected.slug, region)} className="rounded-lg border bg-background px-4 py-2 text-sm font-semibold underline-offset-4 hover:underline hover:bg-accent">{locationLabel(lang, region)}</Link>)}
        </nav>
      </section>}
      <p className="text-sm text-muted-foreground">{copy("Prices shown are final full-court booking prices for one hour. Open a court to check dates, duration and availability.", "الأسعار المعروضة هي أسعار حجز الملعب بالكامل لمدة ساعة. افتح صفحة الملعب لمراجعة المواعيد والمدة والإتاحة.")}</p>
      {courts.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{courts.map(c => <article key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Link href={`/p/${encodeURIComponent(c.id)}`} aria-label={c.name} className="flex h-32 items-center justify-center overflow-hidden bg-muted">
          {c.cover_url || c.photos[0] ? (
            // Venue photos can come from user-provided hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.cover_url || c.photos[0]} alt={c.name} width={480} height={270} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : <LandPlot className="h-10 w-10 text-muted-foreground" aria-hidden="true" />}
        </Link>
        <div className="space-y-3 p-4"><p className="text-xs font-semibold text-muted-foreground">{ar ? findDiscoverySport(sportToSlug(c.sport?.name ?? ""))?.arabic ?? c.sport?.name : c.sport?.name}</p><h2 className="text-base font-bold"><Link href={`/p/${encodeURIComponent(c.id)}`}>{c.name}</Link></h2>
          <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{[c.area, c.governorate, c.country].filter(Boolean).join(" · ") || copy("Confirm location with the venue", "راجع المكان مع الملعب")}</p>
          {c.address && <p className="text-xs leading-relaxed text-muted-foreground">{c.address}</p>}
          <p className="text-sm font-semibold">{c.booking_price?.full_court != null && c.booking_price?.full_court >= 0 && c.booking_price?.hours != null && c.booking_price.hours > 0 ? `${copy("Full court", "الملعب بالكامل")} · ${formatMoney(c.booking_price?.full_court, lang)} / ${c.booking_price?.hours} ${copy("hour(s)", "ساعة")}` : copy("Check the venue page for pricing", "راجع صفحة الملعب للأسعار")}</p>
          <Link href={`/p/${encodeURIComponent(c.id)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-accent">{copy("Court details & booking", "تفاصيل الملعب والحجز")}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link>
        </div>
      </article>)}</div> : <p className="rounded-2xl border bg-card p-5 text-muted-foreground">{copy("No published courts are available to display for this selection. Explore the other sports or check public games.", "مفيش ملاعب منشورة متاحة للعرض بالاختيار ده. اكتشف الرياضات التانية أو راجع الماتشات العامة.")}</p>}
      <div className="flex flex-wrap gap-4 border-t pt-5 text-sm font-semibold"><Link href={slug ? discoveryPath(lang, slug) : discoveryPath(lang)}>{copy("Playing & training guide", "دليل اللعب والتدريب")}</Link><Link href={slug ? `/games?sport=${encodeURIComponent(slug)}` : "/games"}>{copy("Find a game", "لاقي ماتش")}</Link><Link href="/academies">{copy("Explore academies", "اكتشف الأكاديميات")}</Link><Link href={listYourCourtPath(lang)}>{copy("Own a court? List it for free", "عندك ملعب؟ ضيفه مجانًا")}</Link></div>
    </div>
  </main>;
}
