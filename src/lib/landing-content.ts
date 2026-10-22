/** Public copy shared by visible content and homepage search metadata. */
export const LANDING_TITLE = "Playza | Find Sports Players, Join Games & Discover Academies";
export const LANDING_DESCRIPTION = "Looking for people to play sports with in Egypt? Join volleyball, basketball, padel, tennis and beach volleyball games, meet players and discover sports academies on Playza.";
export const BEACH_DESCRIPTION = {
  en: "Discover beach volleyball in Egypt with Playza. Explore sand-court games, find people to play with, and discover academies that match your next move.",
  ar: "العب كرة طائرة شاطئية مع بلايزا. شوف الماتشات على الرمل، واتعرّف على ناس تلعب معاهم، ولاقي أكاديمية تتمرن فيها.",
} as const;

/** Describes visible landing content without inventing local events or inventory. */
export function landingPageJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/#webpage`,
    url: siteUrl,
    name: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    inLanguage: ["en", "ar-EG"],
    about: [
      { "@type": "Thing", name: "Volleyball" },
      { "@type": "Thing", name: "Beach Volleyball", alternateName: "الكرة الطائرة الشاطئية" },
      { "@type": "Thing", name: "Tennis" },
      { "@type": "Thing", name: "Archery", alternateName: "الرماية بالقوس" },
    ],
    hasPart: [
      { "@type": "WebPageElement", "@id": `${siteUrl}/#tennis`, name: "Tennis in Egypt", description: TENNIS_DESCRIPTION.en, url: `${siteUrl}/#tennis` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#archery`, name: "Archery in Egypt", description: ARCHERY_DESCRIPTION.en, url: `${siteUrl}/#archery` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#beach-volleyball`, name: "Beach volleyball. Same rally. New rhythm.", description: BEACH_DESCRIPTION.en, url: `${siteUrl}/#beach-volleyball` },
    ],
  };
}

/** Copy for the homepage hero illustration and its three featured sports. */
export const SportsHeroSceneCopy = {
  en: {
    eyebrow: "FIND PLAYERS. JOIN GAMES.",
    intro: "Looking for people to play sports with in Egypt? Join volleyball, basketball, padel, tennis or beach volleyball games, meet new players, and discover sports academies near you.",
    note: "Play with others. Make new friends.",
    artLabel: "Illustration of people playing sports together",
  },
  ar: {
    eyebrow: "لاقى ناس تلعب معاهم. انضم لماتش.",
    intro: "عاوز تلعب ومش لاقي ناس؟ انضم لماتشات كرة الطائرة، وكرة السلة، والبادل، والتنس، والطائرة الشاطئية، واتعرف على لاعبين جدد، واكتشف أكاديميات رياضية قريبة منك.",
    note: "العب مع ناس. اتعرف على صحاب جدد.",
    artLabel: "رسم لناس بيعبوا رياضة مع بعض",
  },
} as const;

export const ARCHERY_DESCRIPTION = {
  en: "Find your focus with archery. Discover a sport built around patience, precision and the satisfaction of a well-placed shot. Ask organizers about introductory coaching, equipment and the right session for your experience.",
  ar: "جرّب الرماية بالقوس وركّز على هدفك. اسأل المنظّم عن تدريب للمبتدئين، والأدوات المتاحة، والحصة المناسبة لمستواك.",
} as const;

export const TENNIS_DESCRIPTION = {
  en: "Looking for a tennis partner, tennis lessons or a court in Egypt? Explore tennis on Playza, compare published sessions and check the playing level, location and cost before joining.",
  ar: "بتدور على حد تلعب معاه تنس أو مكان تتمرن فيه؟ شوف المواعيد المتاحة على بلايزا، وراجع المستوى والمكان والسعر قبل ما تنضم.",
} as const;

export const LANDING_KEYWORDS = [
  "find people to play sports with egypt",
  "join sports games cairo",
  "find sports partners cairo",
  "volleyball games cairo",
  "basketball games cairo",
  "padel partners cairo",
  "tennis partners cairo",
  "beach volleyball games cairo",
  "sports academies cairo",
  "sports activities egypt",
  "ماتشات رياضية مصر",
  "ناس تلعب مع بعض",
  "جروبات رياضية القاهرة",
  "ماتشات طائرة القاهرة",
  "ماتشات باسكت القاهرة",
  "شريك بادل",
  "أكاديميات رياضية مصر",
];
