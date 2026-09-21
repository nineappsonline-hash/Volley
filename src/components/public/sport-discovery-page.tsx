import Link from "next/link";
import { notFound } from "next/navigation";
import { SportIcon } from "@/components/marketing/sport-icons";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicGames } from "@/lib/public-games";
import { getCairoSportAcademies } from "@/lib/public-sport-academies";
import { DISCOVERY_SPORTS, discoveryPath, findDiscoverySport, type DiscoveryLanguage } from "@/lib/sport-discovery";
import { SITE_URL, breadcrumbsJsonLd, faqPageJsonLd, jsonLdStringify, landingFaqItems } from "@/lib/seo";
import { formatMoney, formatTime12h } from "@/lib/constants";

const linkStyle = "inline-flex rounded-xl border px-4 py-3 font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Header({ lang, slug }: { lang: DiscoveryLanguage; slug?: string }) {
  const ar = lang === "ar";
  return <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
    <Link href="/" aria-label="Playza"><AppLogo /></Link>
    <nav className="flex flex-wrap gap-5 text-sm font-semibold" aria-label={ar ? "التنقل" : "Navigation"}>
      <Link href={discoveryPath(lang)}>{ar ? "كل الرياضات" : "All sports"}</Link>
      <Link href={discoveryPath(ar ? "en" : "ar", slug)} hrefLang={ar ? "en" : "ar-EG"} lang={ar ? "en" : "ar"}>{ar ? "English" : "العربية"}</Link>
    </nav>
  </header>;
}

export function SportDiscoveryIndex({ lang }: { lang: DiscoveryLanguage }) {
  const ar = lang === "ar";
  const title = ar ? "اختار رياضتك في القاهرة" : "Find your sport in Cairo";
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
    <Header lang={lang} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({
      "@context": "https://schema.org", "@type": "CollectionPage", name: title,
      url: `${SITE_URL}${discoveryPath(lang)}`, inLanguage: ar ? "ar-EG" : "en",
      mainEntity: { "@type": "ItemList", itemListElement: DISCOVERY_SPORTS.map((sport, i) => ({ "@type": "ListItem", position: i + 1, name: ar ? sport.arabic : sport.name, url: `${SITE_URL}${discoveryPath(lang, sport.slug)}` })) },
    }) }} />
    <div className="mx-auto max-w-6xl space-y-8 px-5">
      <section className="rounded-3xl bg-brand p-8 text-white sm:p-12">
        <p className="mb-3 font-semibold text-[#12C98A]">Playza · {ar ? "القاهرة، مصر" : "Cairo, Egypt"}</p>
        <h1 className="text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed">{ar ? "عاوز تنزل تلعب أو تبدأ تدريب؟ اختار رياضتك، اعرف إيه اللي تراجعه قبل المشاركة، واكتشف المباريات والأكاديميات والبطولات المنشورة على بلايزا." : "Looking for a game or a place to train? Choose your sport, learn what to check before joining, and explore games, academies and tournaments published on Playza."}</p>
        <p className="mt-4 text-sm text-white/80">{ar ? "التسجيل مجاني. توفر الأنشطة والمواعيد والأسعار بيختلف حسب المنظم والمكان؛ راجع الإعلان قبل المشاركة." : "Registration is free. Activities, schedules and prices depend on the organizer and venue; check each listing before joining."}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISCOVERY_SPORTS.map(sport => <Link key={sport.slug} href={discoveryPath(lang, sport.slug)} className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="mb-3 flex items-center gap-3"><SportIcon id={sport.slug === "beach-volleyball" ? "volleyball" : sport.slug} size={28} className="text-primary" /><h2 className="text-lg font-bold">{ar ? sport.arabic : sport.name}</h2></div>
          <p className="text-sm leading-relaxed text-muted-foreground">{sport.advice[lang]}</p>
        </Link>)}
      </div>
      <nav className="flex flex-wrap gap-3" aria-label={ar ? "اكتشف المزيد" : "Explore more"}><Link className={linkStyle} href="/games">{ar ? "المباريات" : "Games"}</Link><Link className={linkStyle} href="/academies">{ar ? "الأكاديميات" : "Academies"}</Link><Link className={linkStyle} href="/tournaments">{ar ? "البطولات" : "Tournaments"}</Link></nav>
    </div>
  </main>;
}

export async function SportDiscoveryPage({ slug, lang }: { slug: string; lang: DiscoveryLanguage }) {
  const sport = findDiscoverySport(slug);
  if (!sport) notFound();
  const ar = lang === "ar";
  const name = ar ? sport.arabic : sport.name;
  const gamesUrl = `/games?sport=${sport.slug}`;
  const [games, academies] = await Promise.all([getPublicGames(sport.name), getCairoSportAcademies(sport.name)]);
  const cairoGames = games.filter(game => ["cairo", "القاهرة"].includes(game.playground?.governorate?.trim().toLowerCase() ?? ""));
  const questions: [string, string][] = ar ? [
    [`إزاي ألاقي ${name} في القاهرة؟`, `ابدأ بالمباريات والأكاديميات المنشورة على Playza. راجع عنوان المكان والمنطقة والميعاد ومستوى المشاركين. لو مفيش إعلان مناسب حاليًا، تقدر تتابع الأكاديميات أو تنظم نشاط من حسابك؛ توفر الأنشطة مش مضمون في كل منطقة.`],
    ["ينفع أبدأ لوحدي أو كمبتدئ؟", "راجع مستوى النشاط وشروط السن قبل الانضمام. بعض المباريات بتقبل لاعبين أفراد، والأكاديميات بتوضح مجموعات التدريب. اسأل المنظم لو الإعلان مش موضح هل النشاط مناسب للمبتدئين."],
    ["المشاركة بكام؟", "إنشاء حساب وتصفح Playza مجاني. تكلفة الملعب أو التدريب أو البطولة منفصلة وبتختلف حسب الإعلان. راجع الرسوم وحالة الحجز والدفع قبل الحضور؛ مفيش سعر موحد لكل الأماكن."],
    ["هل البطولات محتاجة اشتراك مدفوع؟", "تصفح البطولات متاح للحسابات المجانية والمدفوعة. ممكن يكون للبطولة رسوم مشاركة يحددها المنظم، والتنظيم والإدارة متاحين لمسؤولي الأكاديمية حسب صلاحياتهم."],
  ] : [
    [`How do I find ${sport.name.toLowerCase()} in Cairo?`, "Start with games and academies published on Playza. Check the venue address, area, date and participant level. If nothing suitable is listed, follow an academy or organize an activity through your account. Availability is not guaranteed in every area."],
    ["Can I join on my own or as a beginner?", "Check the activity's experience and age requirements before joining. Some games accept individual players, while academies describe their training groups. Ask the organizer if beginner suitability is not stated."],
    ["How much does participation cost?", "Creating an account and browsing Playza are free. Court, coaching and tournament fees are separate and vary by listing. Check the price, booking and payment status before attending; there is no single price for every venue."],
    ["Do tournaments require a paid subscription?", "Tournament discovery is available to free and paid accounts. Organizers may charge a separate entry fee. Academy administrators organize and manage tournaments according to their account permissions."],
  ];
  const title = ar ? `${name} في القاهرة` : `Play ${name} in Cairo`;
  return <main lang={lang} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background pb-16">
    <Header lang={lang} slug={slug} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "WebPage", name: title, url: `${SITE_URL}${discoveryPath(lang, slug)}`, inLanguage: ar ? "ar-EG" : "en", description: sport.advice[lang], about: { "@type": "Thing", name: sport.name } },
      breadcrumbsJsonLd([{ name: ar ? "الرئيسية" : "Home", url: SITE_URL }, { name: ar ? "الرياضات" : "Sports", url: `${SITE_URL}${discoveryPath(lang)}` }, { name, url: `${SITE_URL}${discoveryPath(lang, slug)}` }]),
      faqPageJsonLd(landingFaqItems(questions)),
    ] }) }} />
    <div className="mx-auto max-w-6xl space-y-10 px-5">
      <section className="rounded-3xl bg-brand p-8 text-white sm:p-12">
        <SportIcon id={slug === "beach-volleyball" ? "volleyball" : slug} size={48} className="mb-4 text-[#12C98A]" />
        <h1 className="text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed">{sport.advice[lang]}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href={gamesUrl} className="rounded-xl bg-white px-5 py-3 font-bold text-brand">{ar ? "شوف الأنشطة المنشورة" : "Browse published activities"}</Link><Link href="/academies" className="rounded-xl border border-white/40 px-5 py-3 font-semibold">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link></div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? "اختار مكان وميعاد مناسبين ليك" : "Choose a location and time that work for you"}</h2>
        <p className="max-w-4xl leading-relaxed text-muted-foreground">{ar ? "في القاهرة، ابدأ بمكان تقدر تروح له بانتظام. راجع العنوان الفعلي والمنطقة، مثل مدينة نصر أو المعادي أو مصر الجديدة أو القاهرة الجديدة، بدل الاعتماد على اسم الرياضة فقط. راجع عنوان الإعلان وخطة المواصلات قبل اختيار الميعاد." : "In Cairo, start with a location you can reach regularly. Check the actual address and district, such as Nasr City, Maadi, Heliopolis or New Cairo, rather than choosing by sport alone. Check the listing’s address and your travel plans before choosing a session time."}</p>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? `أكاديميات ${name} المنشورة في القاهرة` : `Published ${name} academies in Cairo`}</h2>
        {academies.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{academies.map(academy => <Link key={academy.slug} href={`/a/${encodeURIComponent(academy.slug)}`} className="rounded-2xl border bg-card p-5 hover:border-primary"><h3 className="font-bold">{academy.name}</h3><p className="mt-2 text-sm text-muted-foreground">{[academy.area, academy.governorate].filter(Boolean).join(" · ")}</p></Link>)}</div> : <p className="rounded-2xl border p-5 text-muted-foreground">{ar ? "لا توجد إعلانات أكاديميات متاحة للعرض هنا حاليًا. راجع دليل الأكاديميات لاكتشاف الخيارات المنشورة ومناطقها." : "No academy listings are available to display here right now. Explore the academy directory for published options and their locations."}</p>}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? `أنشطة ${name} القادمة في القاهرة` : `Upcoming ${name} activities in Cairo`}</h2>
        <p className="text-sm text-muted-foreground">{ar ? "أنشطة منشورة بملاعب في القاهرة. افتح صفحة المباريات لمراجعة كل الخيارات والتفاصيل." : "Published activities at Cairo venues. Open the games page to see all options and participation details."}</p>
        {cairoGames.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cairoGames.slice(0, 6).map(game => <article key={game.id} className="space-y-2 rounded-2xl border bg-card p-5">
          <h3 className="font-bold">{game.title}</h3>
          <p className="text-sm text-muted-foreground">{[game.playground?.name, game.playground?.area || game.area, game.playground?.governorate].filter(Boolean).join(" · ") || game.location || (ar ? "راجع المكان مع المنظم" : "Confirm the location with the organizer")}</p>
          <p className="text-sm"><time dateTime={game.game_date}>{new Intl.DateTimeFormat(ar ? "ar-EG" : "en", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`))}</time> · {formatTime12h(game.start_time, lang)}</p>
          <p className="text-sm font-semibold">{game.host_pays ? (ar ? "المنظم بيتكفل بالتكلفة" : "Host covers the cost") : game.share_price == null ? (ar ? "راجع التكلفة مع المنظم" : "Confirm the cost") : formatMoney(game.share_price, lang)}</p>
          <Link href={gamesUrl} className="inline-block text-sm font-semibold text-primary underline underline-offset-4">{ar ? "تفاصيل المشاركة" : "View participation details"}</Link>
        </article>)}</div> : <p className="rounded-2xl border p-5 text-muted-foreground">{ar ? "لا توجد أنشطة قادمة متاحة للعرض هنا حاليًا. تقدر تراجع صفحة المباريات أو تنظم نشاط وتشارك رابطه مع أصحابك." : "No upcoming activities are available to display here right now. Check the games page or organize an activity and share it with friends."}</p>}
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">{ar ? "قبل ما تشارك" : "Before you join"}</h2>{questions.map(([q, a]) => <article key={q} className="rounded-2xl border p-5"><h3 className="font-bold">{q}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{a}</p></article>)}</section>
      <nav className="flex flex-wrap gap-3 border-t pt-6" aria-label={ar ? "خطوتك الجاية" : "Next steps"}><Link className={linkStyle} href={`/tournaments?sport=${slug}`}>{ar ? `بطولات ${name}` : `${name} tournaments`}</Link><Link className={linkStyle} href="/signup">{ar ? "اعمل حساب مجاني" : "Create a free account"}</Link><Link className={linkStyle} href={discoveryPath(lang)}>{ar ? "اكتشف باقي الرياضات" : "Explore other sports"}</Link></nav>
    </div>
  </main>;
}
