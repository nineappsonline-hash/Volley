import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { PublicListHero, SportFilterLinks } from "@/components/public/public-listing-ui";
import {
  getPublicTournaments,
  getPublicTournamentSports,
} from "@/lib/public-games";
import { slugToSport, sportToSlug } from "@/lib/sport-slugs";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
} from "@/lib/seo";

export const revalidate = 300;

type SP = Promise<{ sport?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  const title = sport
    ? `بطولات ${SPORT_AR[sport] ?? sport} في مصر — المواعيد والتسجيل`
    : "بطولات رياضية في مصر — كرة قدم، بادل، طائرة وسلة";
  const description = sport
    ? `بطولات ${SPORT_AR[sport] ?? sport} القادمة في مصر من أكاديميات معتمدة: المواعيد، الأماكن، وروابط التسجيل.`
    : "كل البطولات القادمة في مصر من أكاديميات بلايزا: كورة، بادل، طائرة، سلة. المواعيد والأماكن والتفاصيل — شارك بفريقك أو انضم أكاديمية وابدأ المنافسة.";

  return {
    title,
    description,
    keywords: sport
      ? [`بطولات ${SPORT_AR[sport] ?? sport}`, `بطولة ${sport} مصر`, "بطولات أهلية", "تسجيل بطولات"]
      : [
          "بطولات كرة قدم",
          "بطولات كرة قدم أهلية",
          "بطولات شركات",
          "بطولات 7×7",
          "بطولات 5×5",
          "بطولات بادل مصر",
          "بطولات كرة طائرة",
          "بطولات كرة سلة",
          "تنظيم بطولة كرة قدم",
          "تسجيل بطولة",
          "tournaments Egypt",
        ],
    alternates: { canonical: sport ? `/tournaments?sport=${sportToSlug(sport)}` : "/tournaments" },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tournaments`,
      siteName: "Playza",
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
      locale: "ar_EG",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

const SPORT_AR: Record<string, string> = {
  Football: "كرة القدم",
  Volleyball: "الكرة الطائرة",
  Basketball: "كرة السلة",
  Padel: "البادل",
  Swimming: "السباحة",
  Handball: "كرة اليد",
  Tennis: "التنس",
  Squash: "الإسكواش",
};

const STATUS_AR: Record<string, { label: string; cls: string }> = {
  upcoming: { label: "قادمة", cls: "bg-attention-100 text-warning-ink" },
  in_progress: { label: "جارية", cls: "bg-success-ink/10 text-success-ink" },
  completed: { label: "انتهت", cls: "bg-muted text-muted-foreground" },
  canceled: { label: "ملغاة", cls: "bg-muted text-muted-foreground" },
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  const [tournaments, sports] = await Promise.all([
    getPublicTournaments(sport),
    getPublicTournamentSports(),
  ]);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: "الرئيسية", url: SITE_URL },
      { name: "بطولات", url: `${SITE_URL}/tournaments` },
    ]),
    faqPageJsonLd(
      landingFaqItems([
        [
          "إزاي أشارك في بطولة؟",
          "البطولات معروضة على بلايزا من أكاديميات معتمدة. افتح صفحة البطولة، راجع المواعيد والشروط، وسجّل حساب مجاني وانضم لأكاديمية المنظمة أو تواصل معهم للمشاركة.",
        ],
        [
          "البطولات دي لفرق ولا للاعبين الأفراد؟",
          "الاتنين. في بطولات فرق (5×5 و7×7 و11) وبطولات فردية زي البادل والتنس. تفاصيل كل بطولة مكتوبة في صفحتها مع شروط المشاركة.",
        ],
        [
          "بتنظّم بطولة نفسك؟",
          "بلايزا بيساعدك تدير البطولة من الألف إلى الياء: الجدولة والفرق والملاعب والنتائج. سجّل أكاديميتك وابدأ أول بطولة لك.",
        ],
      ])
    ),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "بطولات رياضية في مصر",
      numberOfItems: tournaments.length,
      itemListElement: tournaments.slice(0, 20).map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/tournaments`,
        name: t.name,
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />

      <PublicListHero
        emoji="🏆"
        title={sport ? `بطولات ${SPORT_AR[sport] ?? sport} في مصر` : "بطولات رياضية في مصر"}
        subtitle="شارك بفريقك أو انضم كلاعب فردي — بطولات من أكاديميات بلايزا في مصر: المواعيد والأماكن والتفاصيل واضحة."
        note="بتنظم بطولة؟ سجّل أكاديميتك على بلايزا واستخدم أدوات إدارة البطولات مجاناً أثناء الفترة التجريبية."
        ctaLabel="شوف البطولات وسجّل"
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SportFilterLinks
          sports={sports}
          to={(s) => (s ? `/tournaments?sport=${sportToSlug(s)}` : "/tournaments")}
          current={sport}
          allLabel="كل الرياضات"
        />

        {tournaments.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-primary/40" />
            <p className="mt-4 font-semibold">
              {sport
                ? `مفيش بطولات ${SPORT_AR[sport] ?? sport} معروضة حالياً`
                : "مفيش بطولات معروضة حالياً"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              البطولات بتظهر هنا أول ما الأكاديميات تنشرها. بتدير أكاديمية؟ سجّل وانشر أول بطولة لك.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tournaments.map((t) => {
              const place = [t.academy?.area, t.academy?.governorate]
                .filter(Boolean)
                .join("، ");
              const status = STATUS_AR[t.status] ?? STATUS_AR.completed;
              return (
                <article
                  key={t.id}
                  className="flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{t.name}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.sport ? (SPORT_AR[t.sport] ?? t.sport) : "رياضة متعددة"}
                        {t.academy?.name ? ` · ${t.academy.name}` : ""}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">التاريخ</dt>
                      <dd>
                        {fmtDate(t.start_date)}
                        {t.end_date ? ` — ${fmtDate(t.end_date)}` : ""}
                      </dd>
                    </div>
                    {place && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">المكان</dt>
                        <dd>{place}</dd>
                      </div>
                    )}
                  </dl>

                  {t.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}

                  {t.prize && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-amber-600">
                      <Trophy className="h-4 w-4 shrink-0" />
                      الجائزة: {t.prize}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <Link
                      href={t.academy?.slug ? `/a/${t.academy.slug}` : "/academies"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Trophy className="h-4 w-4" />
                      التفاصيل والتسجيل
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <nav className="mt-12 border-t pt-6 text-center text-sm">
          <p className="mb-3 font-semibold text-muted-foreground">كمّل بحثك</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/games" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              ماتشات ودية
            </Link>
            <Link href="/academies" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              أكاديميات رياضية
            </Link>
            <Link href="/solutions" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              حلول الأكاديميات
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
