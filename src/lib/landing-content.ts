/** Public copy shared by visible content and homepage search metadata. */
export const LANDING_TITLE = "Playza | Find Volleyball & Basketball Games in Egypt";
export const LANDING_DESCRIPTION = "Looking for volleyball or basketball games in Egypt? Join friendly matches, meet players, compare level, location and price, and play your next game with Playza.";
export const VOLLEYBALL_DESCRIPTION = {
  en: "Find volleyball games in Egypt and join a friendly match that fits your level. Check the court, date, price and spots left, then meet your next teammates on Playza.",
  ar: "لاقي ماتشات كرة طائرة في مصر وانضم لماتش ودي يناسب مستواك. راجع الملعب والميعاد والسعر والأماكن المتاحة، واتعرّف على زمايلك الجداد على بلايزا.",
} as const;
export const BASKETBALL_DESCRIPTION = {
  en: "Looking for basketball games in Egypt? Join pickup matches, compare the level and location, and check the final price before you hit the court with Playza.",
  ar: "بتدور على ماتشات كرة سلة في مصر؟ انضم لماتشات بيك أب، وقارن المستوى والمكان، وراجع السعر النهائي قبل ما تنزل الملعب مع بلايزا.",
} as const;
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
      { "@type": "Thing", name: "Volleyball", alternateName: "الكرة الطائرة" },
      { "@type": "Thing", name: "Basketball", alternateName: "كرة السلة" },
      { "@type": "Thing", name: "Beach Volleyball", alternateName: "الكرة الطائرة الشاطئية" },
      { "@type": "Thing", name: "Padel" },
      { "@type": "Thing", name: "Tennis" },
      { "@type": "Thing", name: "Archery", alternateName: "الرماية بالقوس" },
    ],
    hasPart: [
      { "@type": "WebPageElement", "@id": `${siteUrl}/#volleyball`, name: "Volleyball games in Egypt", description: VOLLEYBALL_DESCRIPTION.en, url: `${siteUrl}/#volleyball` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#basketball`, name: "Basketball games in Egypt", description: BASKETBALL_DESCRIPTION.en, url: `${siteUrl}/#basketball` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#beach-volleyball`, name: "Beach volleyball. Same rally. New rhythm.", description: BEACH_DESCRIPTION.en, url: `${siteUrl}/#beach-volleyball` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#tennis`, name: "Tennis in Egypt", description: TENNIS_DESCRIPTION.en, url: `${siteUrl}/#tennis` },
      { "@type": "WebPageElement", "@id": `${siteUrl}/#archery`, name: "Archery in Egypt", description: ARCHERY_DESCRIPTION.en, url: `${siteUrl}/#archery` },
    ],
  };
}

/** Copy for the homepage hero illustration and its three featured sports. */
export const SportsHeroSceneCopy = {
  en: {
    eyebrow: "VOLLEYBALL & BASKETBALL GAMES.",
    intro: "Looking for a volleyball or basketball game in Egypt? Join friendly matches near you, meet new players, and discover sports academies on Playza.",
    note: "Play with others. Make new friends.",
    artLabel: "Illustration of people playing volleyball and basketball together",
  },
  ar: {
    eyebrow: "",
    intro: "بتدور على ماتش كرة طائرة أو كرة سلة في مصر؟ انضم لماتشات ودية قريبة منك، واتعرّف على لاعبين جدد، واكتشف أكاديميات رياضية على بلايزا.",
    note: "العب مع ناس. اتعرف على صحاب جدد.",
    artLabel: "رسم لناس بيعبوا كرة طائرة وكرة سلة مع بعض",
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
  "volleyball games egypt",
  "basketball games egypt",
  "volleyball games cairo",
  "basketball games cairo",
  "find volleyball players cairo",
  "find basketball players cairo",
  "join volleyball game egypt",
  "join basketball game egypt",
  "pickup basketball games cairo",
  "volleyball near me",
  "basketball near me",
  "ماتشات كرة طائرة مصر",
  "ماتشات كرة سلة مصر",
  "ماتشات طائرة القاهرة",
  "ماتشات باسكت القاهرة",
  "ناس تلعب طائرة",
  "ناس تلعب باسكت",
];
