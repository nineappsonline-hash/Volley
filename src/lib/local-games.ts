import type { Metadata } from "next";
import type { PublicGame } from "@/lib/public-games";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

export type LocalLanguage = "en" | "ar";
type LocalCopy = { title: string; description: string; sections: [string, string][] };
export type LocalGameGuide = { slug: string; sport: string; sportSlug: string; en: LocalCopy; ar: LocalCopy };

/** Editorial coverage follows the verified New Cairo public game inventory. */
export const LOCAL_GAME_GUIDES: LocalGameGuide[] = [
  {
    slug: "volleyball-new-cairo", sport: "Volleyball", sportSlug: "volleyball",
    en: {
      title: "Volleyball Games in New Cairo (Tagamoa)",
      description: "Find volleyball games in New Cairo and Tagamoa. Compare upcoming dates, courts, playing levels and per-player prices, then join through Playza.",
      sections: [
        ["Find a volleyball group in Tagamoa", "Looking for people to play volleyball with in New Cairo? Start with an organized public game rather than renting a court before you have a group. Open a game below to check the date, venue, playing level and individual joining options. New Cairo is also commonly called Tagamoa or El Tagamoa; the venue's full address and saved map link are more useful than the area name alone."],
        ["Choose a game that fits your experience", "Volleyball games can differ in pace, team rotation and expected experience. Check the organizer's stated level and description before joining. A friendly match is not necessarily coached training, and an unspecified level is not a promise of beginner instruction. If you need lessons, explore academy profiles separately."],
        ["Plan your journey and confirm your place", "Compare each court's exact address with your route into New Cairo. Ask the organizer about the entrance, arrival time and equipment if these are not listed. Review the per-player cost before joining, then check whether your place is confirmed, awaiting payment approval or on a waitlist before travelling."],
      ],
    },
    ar: {
      title: "ماتشات كرة طائرة في التجمع والقاهرة الجديدة",
      description: "دور على ماتشات كرة طائرة في التجمع والقاهرة الجديدة. شوف المواعيد والملاعب والمستوى والتكلفة لكل لاعب، وانضم للماتش المناسب على بلايزا.",
      sections: [
        ["لاقي مجموعة تلعب معاها طايرة في التجمع", "عايز تلعب كرة طائرة في القاهرة الجديدة ومش معاك فريق؟ ابدأ بماتش عام منظّم بدل ما تحجز ملعب قبل ما تجمع لاعبين. افتح تفاصيل الماتش وراجع الميعاد والمكان والمستوى وطريقة الانضمام الفردي. اسم التجمع لوحده مش عنوان دقيق؛ راجع عنوان الملعب ورابط الخريطة عشان تحدد مكان الوصول."],
        ["اختار مستوى اللعب المناسب ليك", "ماتشات الطايرة بتختلف في سرعة اللعب ونظام تبديل الفرق والخبرة المطلوبة. اقرأ مستوى الماتش ووصف المنظم قبل المشاركة. الماتش الودي مش بالضرورة تدريب مع مدرب، وعدم تحديد المستوى مش معناه إنها للمبتدئين. لو بتدور على تعليم الأساسيات، راجع صفحات الأكاديميات بشكل منفصل."],
        ["رتّب مشوارك واتأكد من مكانك", "قارن عنوان الملعب بطريقك للتجمع، واسأل المنظم عن البوابة ووقت الوصول والأدوات المطلوبة لو مش مكتوبة. راجع تكلفة كل لاعب قبل الانضمام، وبعدها اتأكد إذا مكانك مؤكد أو الدفع تحت المراجعة أو أنت في قائمة الانتظار قبل ما تتحرك."],
      ],
    },
  },
  {
    slug: "beach-volleyball-new-cairo", sport: "Beach Volleyball", sportSlug: "beach-volleyball",
    en: {
      title: "Beach Volleyball in New Cairo — Sand-Court Games",
      description: "Explore beach volleyball in New Cairo, Cairo. Find published sand-court games, review dates, venue directions and prices, and prepare to join individually.",
      sections: [
        ["Play beach volleyball without leaving Cairo", "Beach volleyball takes place on sand and does not require a trip to the coast. For a game in New Cairo, look specifically for a Beach Volleyball listing rather than assuming every volleyball court has sand. The upcoming listings below show what is currently published; past games do not guarantee a regular weekly session."],
        ["Check the format before joining", "Ask how many players share the sand court, whether teams rotate and what experience is expected. Recreational games may use a different format from competitive pairs. You can review an individual joining option without bringing a whole team, but the organizer's capacity, age and participation requirements still apply."],
        ["Prepare for your sand-court session", "Confirm the exact venue entrance and map pin in New Cairo, plus changing and equipment arrangements with the organizer. Bring drinking water and ask what to wear for the actual sand and weather conditions. Check the session time and payment confirmation before setting off. Court rental and a place in an organized game are separate services with potentially different prices."],
      ],
    },
    ar: {
      title: "كرة طائرة شاطئية في التجمع والقاهرة الجديدة",
      description: "اكتشف ماتشات الطائرة الشاطئية على الرمل في التجمع والقاهرة الجديدة. راجع المواعيد وعنوان الملعب والتكلفة وطريقة الانضمام الفردي على بلايزا.",
      sections: [
        ["العب طائرة شاطئية من غير سفر من القاهرة", "الطائرة الشاطئية بتتلعب على الرمل ومش لازم تسافر للساحل عشان تلعبها. لو بتدور على ماتش في التجمع، اختار إعلان طائرة شاطئية بالتحديد؛ مش كل ملعب طايرة فيه أرضية رمل. قائمة الماتشات هنا بتوضح المنشور حاليًا، والماتشات القديمة مش دليل على وجود ميعاد أسبوعي ثابت."],
        ["راجع نظام اللعب قبل المشاركة", "اسأل عن عدد اللاعبين على الملعب الرملي وتبديل الفرق والخبرة المطلوبة. الماتش الترفيهي ممكن يختلف عن نظام الزوجي التنافسي. تقدر تراجع طريقة الانضمام الفردي من غير ما تجيب فريق كامل، لكن شروط المنظم والسن وعدد الأماكن المتاحة تفضل سارية."],
        ["استعد لميعادك على الرمل", "اتأكد من بوابة الملعب ورابط الخريطة في القاهرة الجديدة، واسأل المنظم عن غرف التغيير والأدوات المتوفرة. خُد مياه واسأل عن الملابس المناسبة للرمل والجو في ميعاد اللعب. راجع الميعاد وتأكيد الدفع قبل ما تتحرك؛ تأجير ملعب كامل والانضمام لماتش منظّم خدمتين مختلفتين وممكن يختلف سعرهم."],
      ],
    },
  },
];

export const localGamePath = (lang: LocalLanguage, slug: string) => `${lang === "ar" ? "/ar" : ""}/play/${slug}`;
export const findLocalGuide = (slug: string) => LOCAL_GAME_GUIDES.find(guide => guide.slug === slug);
const areas = new Set(["new cairo", "القاهرة الجديدة", "التجمع", "التجمع الخامس", "التجمع الاول", "التجمع الأول", "التجمع الثالث", "tagamoa", "el tagamoa", "tagamo3", "fifth settlement"]);
export const isNewCairo = (area?: string | null) => areas.has(area?.trim().toLowerCase() || "");
export const matchesLocalGame = (game: PublicGame, guide: LocalGameGuide) => game.sport.toLowerCase() === guide.sport.toLowerCase() && isNewCairo(game.playground?.area ?? game.area);
export function localGameMetadata(lang: LocalLanguage, guide: LocalGameGuide): Metadata {
  const { title, description } = guide[lang];
  const languages = { en: localGamePath("en", guide.slug), "ar-EG": localGamePath("ar", guide.slug), "x-default": localGamePath("en", guide.slug) };
  return { title, description, alternates: { canonical: localGamePath(lang, guide.slug), languages }, openGraph: { title, description, url: `${SITE_URL}${localGamePath(lang, guide.slug)}`, type: "website", locale: lang === "ar" ? "ar_EG" : "en_US", alternateLocale: [lang === "ar" ? "en_US" : "ar_EG"], images: [OG_IMAGE] }, twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] } };
}
