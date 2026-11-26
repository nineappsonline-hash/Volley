import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, LandPlot, ArrowUpRight } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { findDiscoverySport, discoveryPath, type DiscoveryLanguage } from "@/lib/sport-discovery";
import { sportToSlug } from "@/lib/sport-slugs";
import {
  courtsForLocation,
  courtLocationMetadata,
  locationLabel,
  courtsLocationPath,
  findCourtLocation,
} from "@/lib/court-locations";
import { formatMoney } from "@/lib/constants";
import { ShareMenu } from "@/components/academies/academy-share";
import { SITE_URL, jsonLdStringify, breadcrumbsJsonLd } from "@/lib/seo";

/**
 * SEO landing page for a single sport + location combination. Renders only real
 * approved courts; an empty combination is a 404 (handled by the route's
 * generateStaticParams / dynamicParams=false) so no thin doorway page ships.
 */
export async function CourtLocationPage({
  lang,
  sport: sportSlug,
  location: locationSlug,
}: {
  lang: DiscoveryLanguage;
  sport: string;
  location: string;
}) {
  const sport = findDiscoverySport(sportSlug);
  if (!sport) notFound();

  const all = await getPublicCourtDirectory();
  const courts = courtsForLocation(all, sport.name, locationSlug);
  if (!courts.length) notFound();

  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => (ar ? arabic : en);
  const metadata = courtLocationMetadata(lang, sportSlug, locationSlug);
  const title = metadata.title as string;
  const place = locationLabel(lang, locationSlug);
  const href = courtsLocationPath(lang, sportSlug, locationSlug);
  const known = findCourtLocation(locationSlug);

  const intro = ar
    ? `دي ملاعب ${sport.arabic} المنشورة على بلايزا في ${place}. الأسعار المعروضة هي أسعار حجز الملعب بالكامل لمدة ساعة، وتقدر تفتح أي ملعب لمراجعة العناوين وتفاصيل الحجز.`
    : `These are the ${sport.name.toLowerCase()} courts currently published on Playza in ${place}. Prices shown are final full-court booking prices for one hour; open any court to review its address and booking details.`;

  const locationNote = ar
    ? `لو بتدوّر على ملاعب ${sport.arabic} قريبة منك في ${place}، قارن العنوان المذكور لكل ملعب مع طريقك قبل الحجز. ${known ? "" : "هذه المنطقة من بيانات الملاعب المسجّلة على بلايزا."}`
    : `Looking for ${sport.name.toLowerCase()} courts near you in ${place}? Compare each court's listed address with your route before booking.${known ? "" : " This area comes from the venues registered on Playza."}`;

  return (
    <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card">
        <nav aria-label={copy("Court navigation", "روابط الملاعب")} className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" aria-label="Playza"><AppLogo /></Link>
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            <Link href={discoveryPath(lang)}>{copy("Sports", "الرياضات")}</Link>
            <Link href={`${lang === "ar" ? "/ar" : ""}/courts?sport=${sportSlug}`}>{copy("All locations", "كل المناطق")}</Link>
            <Link href={courtsLocationPath(ar ? "en" : "ar", sportSlug, locationSlug)} lang={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link>
            <Link href="/login">{copy("Log in", "تسجيل الدخول")}</Link>
          </div>
          <ShareMenu
            target={{ url: `${SITE_URL}${href}`, title: `${sport.name} courts in ${place}`, text: `${sport.name} courts in ${place}` }}
            label={lang === "ar" ? "مشاركة" : "Share"}
            align="end"
          />
        </nav>
      </header>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
        { "@type": "CollectionPage", name: title, description: metadata.description, url: `${SITE_URL}${href}`, inLanguage: ar ? "ar-EG" : "en" },
        breadcrumbsJsonLd([
          { name: copy("Home", "الرئيسية"), url: SITE_URL },
          { name: copy(`${sport.name} courts`, `ملاعب ${sport.arabic}`), url: `${SITE_URL}${lang === "ar" ? "/ar" : ""}/courts?sport=${sportSlug}` },
          { name: place, url: `${SITE_URL}${href}` },
        ]),
        { "@type": "ItemList", name: title, numberOfItems: courts.length, itemListElement: courts.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE_URL}/p/${encodeURIComponent(c.id)}` })) },
      ] }) }} />
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <section className="rounded-3xl bg-brand px-5 py-7 text-white sm:p-9">
          <p className="text-sm font-semibold text-[hsl(var(--playza-lime))]">{copy(`Padel, tennis & more in ${place}`, `ملاعب رياضية في ${place}`)}</p>
          <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85">{intro}</p>
        </section>
        <nav aria-label={copy("Other sports in this area", "رياضات تانية في المنطقة")} className="flex flex-wrap gap-2">
          {[{ name: copy("All sports", "كل الرياضات"), slug: undefined }, ...[...new Set(all.map((c) => c.sport?.name).filter((n): n is string => !!n))].map((name) => ({ name: ar ? findDiscoverySport(sportToSlug(name))?.arabic ?? name : name, slug: sportToSlug(name) }))].map((item) => {
            const hrefAll = item.slug ? courtsLocationPath(lang, item.slug, locationSlug) : `${lang === "ar" ? "/ar" : ""}/courts`;
            return <Link key={item.slug ?? "all"} href={hrefAll} aria-current={item.slug === sportSlug ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${item.slug === sportSlug ? "border-brand bg-accent text-accent-foreground" : "bg-card hover:bg-accent"}`}>{item.name}</Link>;
          })}
        </nav>
        <p className="text-sm text-muted-foreground">{locationNote}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <Link href={`/p/${encodeURIComponent(c.id)}`} aria-label={c.name} className="flex h-32 items-center justify-center overflow-hidden bg-muted">
                {c.cover_url || c.photos[0] ? (
                  // Venue photos can come from user-provided hosts.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_url || c.photos[0]} alt={c.name} width={480} height={270} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : <LandPlot className="h-10 w-10 text-muted-foreground" aria-hidden="true" />}
              </Link>
              <div className="space-y-3 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{c.sport?.name}</p>
                <h2 className="text-base font-bold"><Link href={`/p/${encodeURIComponent(c.id)}`}>{c.name}</Link></h2>
                <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{[c.area, c.governorate, c.country].filter(Boolean).join(" · ") || copy("Confirm location with the venue", "راجع المكان مع الملعب")}</p>
                {c.address && <p className="text-xs leading-relaxed text-muted-foreground">{c.address}</p>}
                <p className="text-sm font-semibold">{c.booking_price?.full_court != null && c.booking_price?.full_court >= 0 && c.booking_price?.hours != null && c.booking_price.hours > 0 ? `${copy("Full court", "الملعب بالكامل")} · ${formatMoney(c.booking_price.full_court, lang)} / ${c.booking_price.hours} ${copy("hour(s)", "ساعة")}` : copy("Check the venue page for pricing", "راجع صفحة الملعب للأسعار")}</p>
                <Link href={`/p/${encodeURIComponent(c.id)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-accent">{copy("Court details & booking", "تفاصيل الملعب والحجز")}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link>
              </div>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 border-t pt-5 text-sm font-semibold">
          <Link href={discoveryPath(lang, sportSlug)}>{copy(`${sport.name} guide`, `دليل ${sport.arabic}`)}</Link>
          <Link href={`/games?sport=${sportSlug}`}>{copy("Find a game", "لاقي ماتش")}</Link>
          <Link href="/academies">{copy("Explore academies", "اكتشف الأكاديميات")}</Link>
          <Link href={listYourCourtHref(lang)}>{copy("List your court", "أضف ملعبك")}</Link>
        </div>
      </div>
    </main>
  );
}

function listYourCourtHref(lang: DiscoveryLanguage) {
  return lang === "ar" ? "/ar/list-your-court" : "/list-your-court";
}
