/** Public copy shared by visible content and homepage search metadata. */
export const LANDING_TITLE = "Volleyball, Tennis & Archery in Egypt | Playza";
export const LANDING_DESCRIPTION = "Discover volleyball, tennis and archery in Egypt. Explore playing guides, published games, courts and academies, and plan your next activity with Playza.";
export const BEACH_DESCRIPTION = {
  en: "Discover beach volleyball in Egypt with Playza. Explore sand-court games, find people to play with, and discover academies that match your next move.",
  ar: "اكتشف الكرة الطائرة الشاطئية في مصر مع بلايزا. دور على مباريات على الملاعب الرملية، واتعرّف على لاعبين، واكتشف أكاديميات تناسب خطوتك الجاية.",
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
    intro: "Serve a volleyball, rally on the tennis court, or take aim with archery. Find your people, explore sessions in Egypt, and make your next move with Playza.",
    note: "Three sports. One community. Your next game.",
    artLabel: "Illustration of volleyball players at a net, a tennis racket and ball, and an archer aiming at a target",
  },
  ar: {
    eyebrow: "كرة طائرة. تنس. رماية بالقوس.",
    intro: "العب كرة طائرة، واتبادل الكرات على ملعب التنس، أو صوّب على الهدف في الرماية بالقوس. اتعرّف على ناس بتحب لعبتك، واكتشف المواعيد في مصر، وخُد خطوتك الجاية مع بلايزا.",
    note: "٣ رياضات. مجتمع واحد. ولعبتك الجاية.",
    artLabel: "رسم للاعبي كرة طائرة عند الشبكة، ومضرب وكرة تنس، ورامي بالقوس يصوّب نحو هدف",
  },
} as const;

export const ARCHERY_DESCRIPTION = {
  en: "Find your focus with archery. Discover a sport built around patience, precision and the satisfaction of a well-placed shot. Ask organizers about introductory coaching, equipment and the right session for your experience.",
  ar: "لاقي تركيزك مع الرماية بالقوس. رياضة بتجمع الصبر والدقة ومتعة إصابة الهدف. اسأل المنظم عن التدريب التعريفي والأدوات والحصة المناسبة لخبرتك.",
} as const;

export const TENNIS_DESCRIPTION = {
  en: "Looking for a tennis partner, tennis lessons or a court in Egypt? Explore tennis on Playza, compare published sessions and check the playing level, location and cost before joining.",
  ar: "بتدور على شريك تلعب معاه تنس، أو دروس تنس، أو ملعب في مصر؟ اكتشف التنس على بلايزا، وقارن المواعيد المنشورة وراجع المستوى والمكان والتكلفة قبل المشاركة.",
} as const;

/** Supporting topic tags; visible content, titles and links carry the search intent. */
export const LANDING_KEYWORDS = [
  "volleyball Egypt", "volleyball games Cairo", "volleyball courts Cairo",
  "tennis Egypt", "tennis courts Cairo", "tennis lessons Egypt", "tennis partners Cairo",
  "archery Egypt", "archery Cairo", "archery training Egypt", "archery for beginners",
  "beach volleyball Egypt", "sports activities Egypt",
  "كرة طائرة في مصر", "ماتشات كرة طائرة في القاهرة", "ملاعب تنس في القاهرة", "دروس تنس",
  "الرماية بالقوس في مصر", "الرماية بالقوس في القاهرة", "تدريب الرماية بالقوس", "كرة طائرة شاطئية",
];
