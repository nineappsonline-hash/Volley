import { isActiveSport } from "@/lib/active-sports";
import { publicGamePath } from "@/lib/game-discovery";
import { LOCAL_GAME_GUIDES, localGamePath } from "@/lib/local-games";
import { VOLLEYBALL_GUIDES, guidePath } from "@/lib/volleyball-guides";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SportIcon } from "@/components/marketing/sport-icons";
import { AppLogo } from "@/components/shared/app-logo";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { courtsPath } from "@/lib/court-discovery";
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
        <p className="mb-3 font-semibold text-[#C7F23D]">Playza · {ar ? "القاهرة، مصر" : "Cairo, Egypt"}</p>
        <h1 className="text-white text-3xl font-bold sm:text-5xl">{title}</h1>
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
  const bookableSport = isActiveSport(sport.name);
  const gamesUrl = bookableSport ? `/games?sport=${sport.slug}` : "/games";
  const volleyball = slug === "volleyball" || slug === "beach-volleyball";
  const showCourts = volleyball || slug === "tennis";
  const [games, academies, publicCourts] = await Promise.all([getPublicGames(sport.name), getCairoSportAcademies(sport.name), showCourts ? getPublicCourtDirectory(sport.name) : Promise.resolve([])]);
  const courts = publicCourts.filter(c => ["cairo", "القاهرة"].includes(c.governorate?.trim().toLowerCase() ?? ""));
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
    {volleyball && <nav aria-label={ar ? "ماتشات في التجمع" : "Games in New Cairo"} className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 pb-5">{LOCAL_GAME_GUIDES.map(g => <Link key={g.slug} className="underline underline-offset-4" href={localGamePath(lang, g.slug)}>{g[lang].title}</Link>)}</nav>}
    {volleyball && <nav className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 pb-5" aria-label={ar ? "إرشادات اللعب" : "Playing guides"}>{VOLLEYBALL_GUIDES.map(g => <Link key={g.slug} className="text-brand underline underline-offset-4" href={guidePath(lang, g.slug)}>{g[lang].title}</Link>)}</nav>}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "WebPage", name: title, url: `${SITE_URL}${discoveryPath(lang, slug)}`, inLanguage: ar ? "ar-EG" : "en", description: sport.advice[lang], about: { "@type": "Thing", name: sport.name } },
      breadcrumbsJsonLd([{ name: ar ? "الرئيسية" : "Home", url: SITE_URL }, { name: ar ? "الرياضات" : "Sports", url: `${SITE_URL}${discoveryPath(lang)}` }, { name, url: `${SITE_URL}${discoveryPath(lang, slug)}` }]),
      faqPageJsonLd(landingFaqItems(questions)),
    ] }) }} />
    <div className="mx-auto max-w-6xl space-y-10 px-5">
      <section className="rounded-3xl bg-brand p-8 text-white sm:p-12">
        <SportIcon id={slug === "beach-volleyball" ? "volleyball" : slug} size={48} className="mb-4 text-[#C7F23D]" />
        <h1 className="text-white text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed">{sport.advice[lang]}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href={gamesUrl} className="rounded-xl bg-white px-5 py-3 font-bold text-brand">{bookableSport ? ar ? "شوف الأنشطة المنشورة" : "Browse published activities" : ar ? "شوف كل الماتشات المنشورة" : "Browse all published games"}</Link><Link href="/academies" className="rounded-xl border border-white/40 px-5 py-3 font-semibold">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link></div>
      </section>
      {slug === "archery" && <>
        <section className="space-y-4"><h2 className="text-2xl font-bold">{ar ? "اختيار تدريب الرماية بالقوس للمبتدئين" : "Choosing archery training for beginners"}</h2><p className="max-w-4xl leading-relaxed text-muted-foreground">{ar ? "لو دي أول تجربة ليك، اسأل عن حصة تعريفية مع مدرب بدل افتراض إن دخول الميدان يشمل تعليم الأساسيات. اتأكد من نوع القوس المستخدم، وطريقة تقسيم المجموعات حسب السن والخبرة، وهل الأدوات وتأجير القوس داخل سعر الحصة. صفحة المكان لوحدها مش تأكيد لوجود تدريب للمبتدئين." : "For your first archery session, ask for a coached introduction rather than assuming range access includes instruction. Confirm the bow type, how groups are divided by age and experience, and whether equipment and bow rental are included in the session price. A venue profile alone does not confirm that beginner archery lessons are available."}</p></section>
        <section className="space-y-4"><h2 className="text-2xl font-bold">{ar ? "ميدان الرماية والمواعيد والتكلفة" : "Archery ranges, session times and prices"}</h2><p className="max-w-4xl leading-relaxed text-muted-foreground">{ar ? "لما تقارن أماكن الرماية بالقوس في القاهرة، راجع عنوان الميدان الفعلي وتعليمات الدخول مع المنظم. اسأل عن مدة الحصة وعدد المشاركين وطريقة الحجز وما يشمله السعر: التدريب أو الأدوات أو دخول الميدان. توفر التدريب والأسعار بيعتمد على الإعلانات الحالية؛ الدليل هنا مش إعلان عن ميعاد أو سعر ثابت." : "When comparing archery options in Cairo, check the range's actual address and entrance arrangements with the organizer. Ask about session length, group size, booking requirements and what the fee covers: coaching, equipment or range access. Training availability and prices depend on current published listings; this guide does not announce a fixed session schedule or price."}</p></section>
      </>}
      {slug === "tennis" && <section className="space-y-4"><h2 className="text-2xl font-bold">{ar ? "ملعب تنس ولا شريك لعب ولا دروس؟" : "Tennis courts, playing partners or lessons?"}</h2><p className="max-w-4xl leading-relaxed text-muted-foreground">{ar ? "حجز ملعب تنس مناسب لو عندك شريك أو مجموعة جاهزة. المباراة المنشورة ممكن تتيح طلب مكان فردي حسب شروط المنظم، أما دروس التنس فهي تدريب منفصل مع مدرب. راجع نظام الفردي أو الزوجي ومستوى اللعب، واسأل عن تأجير المضرب وتوفير الكرات والإضاءة ونوع أرضية الملعب. قارن مدة الحجز وما يشمله السعر قبل ما تختار ميعادك في القاهرة." : "A tennis court booking suits players who already have a partner or group. A published game may let you request an individual place, depending on the organizer, while tennis lessons are a separate coached activity. Check singles or doubles format and playing level, then ask about racket rental, balls, lighting and court surface. Compare booking duration and what the price includes before choosing a session in Cairo."}</p></section>}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? "اختار مكان وميعاد مناسبين ليك" : "Choose a location and time that work for you"}</h2>
        <p className="max-w-4xl leading-relaxed text-muted-foreground">{ar ? "في القاهرة، ابدأ بمكان تقدر تروح له بانتظام. راجع العنوان الفعلي والمنطقة، مثل مدينة نصر أو المعادي أو مصر الجديدة أو القاهرة الجديدة، بدل الاعتماد على اسم الرياضة فقط. راجع عنوان الإعلان وخطة المواصلات قبل اختيار الميعاد." : "In Cairo, start with a location you can reach regularly. Check the actual address and district, such as Nasr City, Maadi, Heliopolis or New Cairo, rather than choosing by sport alone. Check the listing’s address and your travel plans before choosing a session time."}</p>
      </section>
      {showCourts && <>
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">{ar ? `ملاعب ${name} المنشورة في القاهرة` : `Published ${name} courts in Cairo`}</h2>
          {courts.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{courts.map(c => <article key={c.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <h3 className="font-bold"><Link href={`/p/${encodeURIComponent(c.id)}`}>{c.name}</Link></h3>
            <p className="text-sm">{[c.area, c.governorate].filter(Boolean).join(" · ")}</p>
            {c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}
            <p className="text-sm font-semibold">{c.rental_cost != null && c.rental_cost >= 0 && c.rental_hours != null && c.rental_hours > 0 ? `${formatMoney(c.rental_cost, lang)} / ${c.rental_hours} ${ar ? "ساعة" : "hour(s)"}` : ar ? "راجع صفحة الملعب للأسعار" : "Check the court page for prices"}</p>
            <Link href={`/p/${encodeURIComponent(c.id)}`} className="inline-block text-sm font-semibold underline underline-offset-4">{ar ? "المكان والمواعيد وتفاصيل الحجز" : "Location, schedule & booking details"}</Link>
          </article>)}</div> : <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{ar ? "مفيش ملاعب منشورة متاحة للعرض هنا بالاختيار ده حاليًا." : "No published courts are available to display here for this selection right now."}</p>}
          <Link className={linkStyle} href={courtsPath(lang, slug)}>{ar ? `اكتشف ملاعب ${name} في مصر` : `Explore ${sport.name} courts in Egypt`}</Link>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">{ar ? "قبل ما تختار لعب أو تدريب" : "Before choosing a game or training session"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border bg-card p-5"><h3 className="font-bold">{ar ? "صالات ولا ملاعب رملية؟" : "Indoor or sand-court volleyball?"}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ar ? "كرة الطائرة الشاطئية بتتلعب على الرمل، أما الكرة الطائرة في الصالات أو الملاعب المفتوحة فلها أرضيات وتجهيزات مختلفة. راجع نوع الأرضية ونظام الفرق والإضاءة مع المكان قبل الحجز؛ اسم الرياضة لوحده مش كفاية لتحديد التجهيزات." : "Beach volleyball is played on sand; indoor and other outdoor volleyball courts have different surfaces and facilities. Confirm the surface, team format and lighting with the venue before booking; a sport label alone does not establish the facilities."}</p></article>
            <article className="rounded-2xl border bg-card p-5"><h3 className="font-bold">{ar ? "مبتدئ أو جاي لوحدك؟" : "Starting out or joining alone?"}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ar ? "اختار نشاط مستواه وشروط السن مناسبة ليك. التدريب مع أكاديمية مختلف عن مباراة ودية؛ راجع عدد الأماكن، وإذا كان التنظيم بيقبل لاعبين أفراد، وما إذا كانت المعدات أو التدريب مشمولة في الرسوم." : "Choose an activity with suitable experience and age requirements. Academy coaching differs from a friendly game: check available places, whether individual players can join, and whether equipment or instruction is included in the fee."}</p></article>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{ar ? "سعر إيجار الملعب مش هو بالضرورة تكلفة الفرد في المباراة أو سعر اشتراك التدريب. قارن مدة الإيجار والرسوم اللي بيعلنها المنظم، وافتح التفاصيل للتأكد من الميعاد وشروط الحجز." : "A court's rental rate is not necessarily the per-player game fee or academy subscription price. Compare the rental duration and organizer's published fees, then open the details to confirm the schedule and booking conditions."}</p>
        </section>
      </>}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? `أكاديميات ${name} المنشورة في القاهرة` : `Published ${name} academies in Cairo`}</h2>
        {academies.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{academies.map(academy => <Link key={academy.slug} href={`/a/${encodeURIComponent(academy.slug)}`} className="rounded-2xl border bg-card p-5 hover:border-primary"><h3 className="font-bold">{academy.name}</h3><p className="mt-2 text-sm text-muted-foreground">{[academy.area, academy.governorate].filter(Boolean).join(" · ")}</p>{academy.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{academy.description}</p>}</Link>)}</div> : <p className="rounded-2xl border p-5 text-muted-foreground">{ar ? "لا توجد إعلانات أكاديميات متاحة للعرض هنا حاليًا. راجع دليل الأكاديميات لاكتشاف الخيارات المنشورة ومناطقها." : "No academy listings are available to display here right now. Explore the academy directory for published options and their locations."}</p>}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{ar ? `أنشطة ${name} القادمة في القاهرة` : `Upcoming ${name} activities in Cairo`}</h2>
        <p className="text-sm text-muted-foreground">{ar ? "أنشطة منشورة بملاعب في القاهرة. افتح صفحة المباريات لمراجعة كل الخيارات والتفاصيل." : "Published activities at Cairo venues. Open the games page to see all options and participation details."}</p>
        {cairoGames.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cairoGames.slice(0, 6).map(game => <article key={game.id} className="space-y-2 rounded-2xl border bg-card p-5">
          <h3 className="font-bold"><Link href={publicGamePath(game.id)} className="underline underline-offset-4">{game.title}</Link></h3>
          <p className="text-sm text-muted-foreground">{[game.playground?.name, game.playground?.area || game.area, game.playground?.governorate].filter(Boolean).join(" · ") || game.location || (ar ? "راجع المكان مع المنظم" : "Confirm the location with the organizer")}</p>
          <p className="text-sm"><time dateTime={game.game_date}>{new Intl.DateTimeFormat(ar ? "ar-EG" : "en", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`))}</time> · {formatTime12h(game.start_time, lang)}</p>
          <p className="text-sm font-semibold">{game.host_pays ? (ar ? "المنظم بيتكفل بالتكلفة" : "Host covers the cost") : game.share_price == null ? (ar ? "راجع التكلفة مع المنظم" : "Confirm the cost") : formatMoney(game.share_price, lang)}</p>
          <Link href={publicGamePath(game.id)} className="inline-block text-sm font-semibold text-primary underline underline-offset-4">{ar ? "تفاصيل المشاركة" : "View participation details"}</Link>
        </article>)}</div> : <p className="rounded-2xl border p-5 text-muted-foreground">{ar ? "لا توجد أنشطة قادمة متاحة للعرض هنا حاليًا. تقدر تراجع صفحة المباريات أو تنظم نشاط وتشارك رابطه مع أصحابك." : "No upcoming activities are available to display here right now. Check the games page or organize an activity and share it with friends."}</p>}
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">{ar ? "قبل ما تشارك" : "Before you join"}</h2>{questions.map(([q, a]) => <article key={q} className="rounded-2xl border p-5"><h3 className="font-bold">{q}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{a}</p></article>)}</section>
      <nav className="flex flex-wrap gap-3 border-t pt-6" aria-label={ar ? "خطوتك الجاية" : "Next steps"}><Link className={linkStyle} href={`/tournaments?sport=${slug}`}>{ar ? `بطولات ${name}` : `${name} tournaments`}</Link><Link className={linkStyle} href="/signup">{ar ? "اعمل حساب مجاني" : "Create a free account"}</Link><Link className={linkStyle} href={discoveryPath(lang)}>{ar ? "اكتشف باقي الرياضات" : "Explore other sports"}</Link></nav>
    </div>
  </main>;
}
