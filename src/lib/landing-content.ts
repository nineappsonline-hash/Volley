/** Public copy shared by visible content and homepage search metadata. */
export const LANDING_TITLE = "Volleyball, Tennis, Padel, Basketball & Archery in Egypt | Playza";
export const LANDING_DESCRIPTION = "Discover volleyball, tennis, padel, basketball and archery in Egypt. Explore playing guides, published games, courts and academies, and plan your next activity with Playza.";
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
    eyebrow: "VOLLEYBALL. TENNIS. ARCHERY.",
    intro: "Serve a volleyball, rally in tennis or padel, shoot hoops in basketball, or take aim with archery. Find your people, explore sessions in Egypt, and make your next move with Playza.",
    note: "Three sports. One community. Your next game.",
    artLabel: "Illustration of volleyball players at a net, a tennis racket and ball, and an archer aiming at a target",
  },
  ar: {
    eyebrow: "كرة طائرة. تنس. رماية بالقوس.",
    intro: "العب كرة طائرة، أو تنس وبادل، أو كرة سلة، أو جرّب الرماية بالقوس. اتعرّف على ناس بتحب نفس رياضتك، وشوف المواعيد اللي تناسبك، ويلا نلعب مع بلايزا.",
    note: "رياضتك. صحابك. وماتشك الجاي.",
    artLabel: "رسم للاعبي كرة طائرة عند الشبكة، ومضرب وكرة تنس، ورامي بالقوس يصوّب نحو هدف",
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

/** Supporting topic tags; visible content, titles and links carry the search intent. */
export const LANDING_KEYWORDS = [
  "volleyball Egypt", "volleyball games Cairo", "volleyball courts Cairo",
  "basketball games Egypt", "basketball courts Cairo", "كرة سلة مصر", "ملاعب كرة السلة", "padel Egypt", "padel courts Cairo", "padel games Egypt", "بادل مصر", "ملاعب بادل", "tennis Egypt", "tennis courts Cairo", "tennis lessons Egypt", "tennis partners Cairo",
  "archery Egypt", "archery Cairo", "archery training Egypt", "archery for beginners",
  "beach volleyball Egypt", "sports activities Egypt",
  "كرة طائرة في مصر", "ماتشات كرة طائرة في القاهرة", "ملاعب تنس في القاهرة", "تمارين تنس",
  "الرماية بالقوس في مصر", "الرماية بالقوس في القاهرة", "تدريب الرماية بالقوس", "كرة طائرة شاطئية",
];
