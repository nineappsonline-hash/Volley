import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Coins,
  MapPin,
  Users,
  Volleyball,
} from "lucide-react";
import { PublicListHero, SportFilterLinks } from "@/components/public/public-listing-ui";
import { Button } from "@/components/ui/button";
import {
  getPublicGameSports,
  getPublicGames,
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
import { dictionary } from "@/lib/i18n/dictionary";

export const revalidate = 300; // refresh listing every 5 minutes

type SP = Promise<{ sport?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  // The root layout template appends the brand: "… | بلايزا Playza".
  const title = sport
    ? `ماتشات ${SPORT_AR[sport] ?? sport} الودية القادمة في مصر`
    : "ماتشات ودية وأهلي في مصر — كورة، طائرة، سلة، بادل";
  const description = sport
    ? `اعرض ماتشات ${SPORT_AR[sport] ?? sport} الودية القادمة في مصر: المواعيد، المكان، عدد اللاعبين وسهم الحصة. جرّب ماتش قريب منك مع بلايزا.`
    : "دور على ماتش ودية قريب منك: كورة، طائرة، سلة، بادل وسباحة. المواعيد، المكان، عدد اللاعبين وسهم الحصة واضح من البداية. سجّل مجاناً وانضم لأقرب ماتش.";

  return {
    title,
    description,
    keywords: sport
      ? [`ماتشات ${sport} ودية`, `لعب ${SPORT_AR[sport] ?? sport}`, "ماتشات أهلي", "جيمز ودية"]
      : [
          "ماتشات ودية",
          "ماتشات أهلي",
          "حجز ماتش كرة قدم",
          "جيمز ودية",
          "لعب كرة قدم",
          "لعب كرة طائرة",
          "لعب بادل",
          "ماتشات أهلي كورة",
          "ماتشات كرة سلة",
          "ماتشات بادل مصر",
          "ملعب قريب مني",
          "friendly games Egypt",
        ],
    alternates: { canonical: sport ? `/games?sport=${sportToSlug(sport)}` : "/games" },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/games`,
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

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

export default async function GamesPage({ searchParams }: { searchParams: SP }) {
  const { sport: sportParam } = await searchParams;
  const sport = sportParam ? slugToSport(sportParam) : undefined;

  const [games, sports] = await Promise.all([
    getPublicGames(sport),
    getPublicGameSports(),
  ]);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: "الرئيسية", url: SITE_URL },
      { name: "ماتشات ودية", url: `${SITE_URL}/games` },
    ]),
    faqPageJsonLd(
      landingFaqItems([
        [
          "إزاي ألاقي ماتش ودية قريب مني؟",
          "افتح صفحة الماتشات على بلايزا، اختار رياضتك ومنطقتك، وشوف الماتشات القادمة بالمواعيد والمكان وسهم الحصة. سجّل مجاناً وانضم للماتش اللي يناسبك.",
        ],
        [
          "هل محتاج تكون في أكاديمية عشان تلعب؟",
          "لأ. الماتشات على بلايزا مفتوحة لأي حد — سجّل حساب مجاني، اختار ماتش قريب منك، واحجز مكانك. بعض الماتشات ليها شرط سن أو مستوى، مكتوب على كل ماتش.",
        ],
        [
          "بكام سهم الماتش الودي؟",
          "كل ماتش بيوضح نصيب اللاعب من إيجار الملعب بناءً على سعر الساعة ومدة الماتش وأقل عدد لاعبين. السعر ظاهر قبل ما تنضم ومش بيتغير بعد التسجيل.",
        ],
      ])
    ),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "ماتشات ودية قادمة في مصر",
      numberOfItems: games.length,
      itemListElement: games.slice(0, 20).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/games`,
        name: g.title,
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
        emoji="🎮"
        title={sport ? `ماتشات ${SPORT_AR[sport] ?? sport} الودية` : "ماتشات ودية وأهلي في مصر"}
        subtitle="الناس موجودة، وناقص بس تتجمعوا. اختار ماتش قريب منك — المواعيد والمكان والسعر واضحين من البداية."
        note="سجّل حساب مجاني وانضم لأي ماتش مفتوح. بعض الماتشات ليها شرط سن أو مستوى — مكتوب قبل ما تنضم."
        ctaLabel="سجّل مجاناً واطلع ملعب"
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SportFilterLinks
          sports={sports}
          to={(s) => (s ? `/games?sport=${sportToSlug(s)}` : "/games")}
          current={sport}
          allLabel="كل الرياضات"
        />

        {games.length === 0 ? (
          <EmptyState sport={sport} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {games.map((g) => {
              const place = [
                g.playground?.name,
                g.playground?.area ?? g.area,
                g.playground?.governorate,
              ]
                .filter(Boolean)
                .join("، ");
              const full = g.joined >= g.max_players;
              return (
                <article
                  key={g.id}
                  className="flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{g.title}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {SPORT_AR[g.sport] ?? g.sport}
                        {g.skill_level ? ` · ${SKILL_AR[g.skill_level] ?? g.skill_level}` : ""}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                        full ? "bg-muted text-muted-foreground" : "bg-success-ink/10 text-success-ink"
                      }`}
                    >
                      {full ? "اتمأت" : `${g.max_players - g.joined} أماكن فاضية`}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">التاريخ</dt>
                      <dd>{fmtDate(g.game_date)}</dd>
                      <Clock className="ms-2 h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">الوقت</dt>
                      <dd>{fmtTime(g.start_time)}</dd>
                    </div>
                    {place && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">المكان</dt>
                        <dd>{place}</dd>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <dt className="sr-only">اللاعبون</dt>
                      <dd>
                        {g.joined}/{g.max_players} لاعب
                        {g.gender !== "mixed" ? ` · ${GENDER_AR[g.gender] ?? ""}` : ""}
                      </dd>
                    </div>
                    {g.share_price != null && (
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 shrink-0" />
                        <dt className="sr-only">السهم</dt>
                        <dd className="font-semibold text-foreground">
                          سهم {g.share_price} ج.م
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-auto pt-4">
                    <JoinCta />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Cross-links keep crawlers (and users) moving between listings. */}
        <nav className="mt-12 border-t pt-6 text-center text-sm">
          <p className="mb-3 font-semibold text-muted-foreground">كمّل بحثك</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/academies" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              أكاديميات رياضية
            </Link>
            <Link href="/tournaments" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              بطولات
            </Link>
            <Link href="/solutions" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              حلول الأكاديميات
            </Link>
            <Link href="/faq" className="rounded-full border bg-background px-4 py-1.5 font-medium hover:bg-accent">
              أسئلة شائعة
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}

const SKILL_AR: Record<string, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

const GENDER_AR: Record<string, string> = {
  male: "رجالي",
  female: "بناتي",
  mixed: "مختلط",
};

function EmptyState({ sport }: { sport?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-10 text-center">
      <Volleyball className="mx-auto h-10 w-10 text-primary/40" />
      <p className="mt-4 font-semibold">
        {sport ? `مفيش ماتشات ${SPORT_AR[sport] ?? sport} مفتوحة حالياً` : "مفيش ماتشات مفتوحة حالياً"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        الماتشات بتظهر هنا أول ما اللاعبين ينشروها. كن أول من ينشر ماتش في منطقتك — سجّل وابدأ.
      </p>
    </div>
  );
}

/** Join requires an account — the CTA links to signup. */
function JoinCta() {
  return (
    <Button asChild className="w-full">
      <Link href="/signup">انضم للماتش</Link>
    </Button>
  );
}
