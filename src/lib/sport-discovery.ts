import { sportToSlug } from "@/lib/sport-slugs";
import { ACTIVE_SPORTS } from "@/lib/active-sports";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

export type DiscoveryLanguage = "en" | "ar";

// Editorial guidance, not claims about local inventory or guaranteed availability.
// Each sport has its own preparation advice, rendered in HTML in both languages.
const guides: Record<string, [string, string, string]> = {
  football: ["كرة القدم", "Choose a small-sided or full-pitch game and check the surface before choosing your boots. Look at squad size, goalkeeper arrangements and whether teams are assigned by the organizer.", "اختار ماتش خماسي أو سباعي أو ملعب كامل، واتأكد من نوع الأرضية قبل اختيار الحذاء. راجع عدد اللاعبين ونظام حراسة المرمى وتقسيم الفرق مع المنظم."],
  volleyball: ["الكرة الطائرة", "Check whether the session is a coached practice or a friendly match. Ask about the playing level, team rotation and indoor or outdoor court so you can find a group that suits you.", "اتأكد إذا كان النشاط تدريب مع مدرب أو مباراة ودية. اسأل عن مستوى المجموعة وتبديل الفرق وهل الملعب مغلق أو مفتوح عشان تختار اللعب المناسب ليك."],
  "beach-volleyball": ["الكرة الطائرة الشاطئية", "Look for a sand court and confirm the team format before joining. A beach-volleyball session needs different footwear arrangements from an indoor game; ask the organizer what to bring.", "دور على ملعب رملي واتأكد من نظام الفرق قبل المشاركة. تجهيزات الكرة الطائرة الشاطئية مختلفة عن الصالات؛ اسأل المنظم عن المطلوب معاك."],
  basketball: ["كرة السلة", "Compare half-court and full-court games, player numbers and playing level. Ask whether the group rotates teams or follows a fixed match schedule, especially when joining on your own.", "قارن بين مباريات نصف الملعب والملعب الكامل، وعدد اللاعبين ومستوى اللعب. لو هتنضم لوحدك اسأل عن تبديل الفرق ونظام المباريات."],
  handball: ["كرة اليد", "Check whether the listing is team practice, an introductory session or a match. Confirm goalkeeper places, age group and court location with the organizer before registering.", "راجع إذا كان النشاط تدريب فريق أو حصة تعريفية أو مباراة. اتأكد من أماكن حراس المرمى والفئة العمرية ومكان الملعب قبل التسجيل."],
  tennis: ["التنس", "Choose singles, doubles or coaching and check the court surface. Confirm whether a racket and balls are provided, and compare the session level with your match experience.", "اختار فردي أو زوجي أو تدريب، وراجع نوع أرضية الملعب. اسأل إذا كان المضرب والكرات متوفرين وقارن مستوى الحصة بخبرتك."],
  swimming: ["السباحة", "Look for lessons or supervised swimming that match your ability and age group. Confirm pool access, lesson duration, changing facilities and the instructor's requirements directly with the academy.", "دور على دروس أو سباحة تحت إشراف تناسب مستواك وفئتك العمرية. اتأكد من دخول المسبح ومدة الدرس وغرف تغيير الملابس ومتطلبات المدرب مع الأكاديمية."],
  padel: ["البادل", "Check whether you are joining an existing group or booking with partners. Confirm the level, court time and racket rental so that the advertised participation cost is clear before you join.", "اتأكد إذا كنت هتنضم لمجموعة موجودة أو هتلعب مع أصحابك. راجع المستوى ووقت الملعب وتأجير المضرب عشان تعرف تكلفة المشاركة قبل الانضمام."],
  squash: ["الإسكواش", "Compare coaching and partner sessions, then confirm court access and racket availability. Ask about the ball used and the group's experience so your first session matches your level.", "قارن بين التدريب واللعب مع شريك، واتأكد من دخول الملعب وتوفر المضرب. اسأل عن الكرة المستخدمة وخبرة المجموعة عشان تختار حصة تناسب مستواك."],
  "table-tennis": ["تنس الطاولة", "Find a practice partner, coaching session or tournament. Check how tables are shared, whether bats and balls are supplied, and whether registration is for singles or doubles.", "دور على شريك تدريب أو حصة أو بطولة. راجع نظام مشاركة الطاولات وتوفر المضارب والكرات، وهل التسجيل فردي أو زوجي."],
  badminton: ["الريشة الطائرة", "Choose singles, doubles or coached practice and confirm an appropriate court is available. Ask whether rackets and shuttlecocks are included and how partners are matched.", "اختار فردي أو زوجي أو تدريب، واتأكد من توفر ملعب مناسب. اسأل إذا كانت المضارب والريش مشمولة وإزاي بيتم اختيار الشركاء."],
  gymnastics: ["الجمباز", "Look for coached classes organized by age and experience. Ask which apparatus is used, how introductory sessions work and what clothing the academy recommends.", "دور على حصص مع مدرب مقسمة حسب السن والخبرة. اسأل عن الأجهزة المستخدمة ونظام الحصص التعريفية والملابس اللي بتطلبها الأكاديمية."],
  karate: ["الكاراتيه", "Compare beginner and graded classes, age groups and the karate style taught. Confirm uniform requirements, grading arrangements and whether a trial class is offered.", "قارن بين حصص المبتدئين والأحزمة والفئات العمرية وأسلوب الكاراتيه. اتأكد من الزي المطلوب ونظام اختبارات الأحزمة وتوفر حصة تجريبية."],
  boxing: ["الملاكمة", "Distinguish fitness boxing, technical coaching and sparring sessions. Ask about gloves, wraps and the coach's experience requirements; joining a class does not necessarily include sparring.", "فرّق بين ملاكمة اللياقة والتدريب الفني وحصص السبارينج. اسأل عن القفازات واللفافات والمستوى المطلوب؛ الاشتراك في حصة مش معناه إنها تشمل سبارينج."],
  athletics: ["ألعاب القوى", "Choose the discipline you want to train: running, jumping or throwing. Confirm track or equipment access and whether the group focuses on introductory practice or competition preparation.", "اختار التخصص اللي عاوز تتمرن عليه: جري أو وثب أو رمي. اتأكد من توفر المضمار أو الأدوات، وهل المجموعة للمبتدئين أو للاستعداد للمنافسات."],
  "kung-fu": ["الكونغ فو", "Ask which style and training format the club offers, including forms or partner work. Compare age groups, beginner entry requirements and the equipment needed for each class.", "اسأل عن الأسلوب ونظام التدريب في النادي، سواء أساليب حركية أو تدريب مع شريك. قارن الفئات العمرية وشروط المبتدئين والأدوات المطلوبة لكل حصة."],
  taekwondo: ["التايكوندو", "Look for a class suited to your age and belt level. Ask whether sessions focus on forms, technique or competition practice and which protective equipment is required.", "دور على حصة مناسبة لسنك ومستوى الحزام. اسأل إذا كان التركيز على البومسي أو المهارات أو المنافسات، وإيه معدات الحماية المطلوبة."],
  crossfit: ["الكروس فيت", "Check whether new participants need an introductory class before joining group workouts. Ask the coach about experience groups, available equipment and how the session is adapted for newcomers.", "اتأكد إذا كان مطلوب حصة تعريفية قبل دخول التمرين الجماعي. اسأل المدرب عن مجموعات الخبرة والأدوات المتاحة وإزاي الحصة بتتناسب مع المشاركين الجدد."],
  judo: ["الجودو", "Compare beginner and experienced classes and confirm age groups. Ask about judogi requirements, introductory falling practice and how partners are assigned during training.", "قارن حصص المبتدئين وأصحاب الخبرة واتأكد من الفئة العمرية. اسأل عن بدلة الجودو وتدريب السقوط للمبتدئين ونظام اختيار شركاء التدريب."],
  kickboxing: ["الكيك بوكسينج", "Check whether the class is for fitness, technique, pad work or sparring. Confirm the level and required gloves and protective equipment with the coach before attending.", "راجع إذا كانت الحصة للياقة أو المهارات أو تدريب البادات أو السبارينج. اتأكد من المستوى والقفازات ومعدات الحماية المطلوبة مع المدرب قبل الحضور."],
  wrestling: ["المصارعة", "Ask which wrestling style is taught and whether the session accepts beginners. Confirm age and experience groupings, mat access and the club's clothing and footwear requirements.", "اسأل عن نوع المصارعة وهل الحصة بتقبل مبتدئين. اتأكد من تقسيم السن والخبرة وتوفر البساط ومتطلبات الملابس والأحذية في النادي."],
  archery: ["الرماية بالقوس", "Start by checking whether the venue offers supervised introductory sessions and equipment rental. Confirm the bow type, age requirements and the range's briefing before booking.", "ابدأ بالتأكد من توفر حصة تعريفية تحت إشراف وتأجير المعدات. راجع نوع القوس والسن المطلوب والتعليمات التعريفية في ميدان الرماية قبل الحجز."],
  fencing: ["المبارزة", "Ask which weapon is taught: foil, épée or sabre. Check beginner groups, protective equipment availability and whether the session includes footwork, individual lessons or partner practice.", "اسأل عن السلاح اللي بيتم تدريسه: الشيش أو سيف المبارزة أو السيف. راجع مجموعات المبتدئين وتوفر معدات الحماية ونوع التدريب في الحصة."],
  equestrian: ["الفروسية", "Compare introductory riding lessons with sessions for experienced riders. Confirm rider age and experience requirements, helmet availability, lesson length and the stable's meeting point.", "قارن دروس الركوب التعريفية بحصص أصحاب الخبرة. اتأكد من السن والخبرة المطلوبين وتوفر الخوذة ومدة الدرس ونقطة التجمع في الإسطبل."],
  cycling: ["ركوب الدراجات", "Check the ride's route, distance, pace and starting point. Ask whether you need your own bicycle and helmet and whether the group is suitable for your riding experience.", "راجع المسار والمسافة والسرعة ونقطة البداية. اسأل إذا كنت محتاج دراجتك وخوذتك، وهل المجموعة مناسبة لخبرتك في الركوب."],
  weightlifting: ["رفع الأثقال", "Look for coached technical sessions and distinguish weightlifting from general gym access. Confirm the experience level, equipment and whether an introductory assessment is needed.", "دور على حصص فنية مع مدرب وفرّق بين رفع الأثقال ودخول الجيم العام. اتأكد من المستوى والأدوات وهل محتاج تقييم تعريفي قبل البداية."],
  parkour: ["الباركور", "Look for coached sessions with a stated experience level and meeting point. Ask whether training takes place in a gym or outdoors, which obstacles are used and what newcomers should bring.", "دور على حصص مع مدرب بمستوى محدد ونقطة تجمع واضحة. اسأل إذا كان التدريب في صالة أو بره، وعن العوائق المستخدمة والمطلوب للمبتدئين."],
};

// Featured editorial guides can exist before bookable sessions are published.
export const DISCOVERY_SPORTS = [...new Set<string>([...ACTIVE_SPORTS, "Archery"])].map(name => {
  const slug = sportToSlug(name);
  return { slug, name, arabic: guides[slug][0], advice: { en: guides[slug][1], ar: guides[slug][2] } };
});
export type DiscoverySport = (typeof DISCOVERY_SPORTS)[number];
export const findDiscoverySport = (slug: string) => DISCOVERY_SPORTS.find(sport => sport.slug === slug);
export const discoveryPath = (lang: DiscoveryLanguage, slug?: string) => `${lang === "ar" ? "/ar" : ""}/sports${slug ? `/${slug}` : ""}`;

export function discoveryMetadata(lang: DiscoveryLanguage, sport?: DiscoverySport): Metadata {
  const ar = lang === "ar";
  const title = sport
    ? ar ? `${sport.arabic} في القاهرة — لعب وتدريب وبطولات` : `${sport.name} in Cairo — Games, Training & Tournaments`
    : ar ? "العب رياضتك في القاهرة — مباريات وأكاديميات" : "Find Sports to Play in Cairo — Games & Academies";
  const description = sport
    ? ar ? `عاوز تلعب ${sport.arabic} في القاهرة؟ اعرف إزاي تختار النشاط المناسب، وراجع المباريات والأكاديميات المنشورة والمواعيد والتكلفة على Playza.` : `Want to play ${sport.name.toLowerCase()} in Cairo? Find out what to check before joining, explore published games and academies, and compare locations, dates and costs on Playza.`
    : ar ? "اختار رياضتك على Playza. اكتشف إرشادات للعب والتدريب في القاهرة وروابط المباريات والأكاديميات والبطولات، مع التسجيل المجاني." : "Explore volleyball, tennis, archery and beach volleyball on Playza, with practical guidance for playing in Cairo and links to public games, academies and tournaments. Free account registration.";
  const searchCopy = sport && SPORT_SEARCH_COPY[sport.slug]?.[lang];
  const searchTitle = searchCopy?.title || title;
  const searchDescription = searchCopy?.description || description;
  return {
    title: searchTitle, description: searchDescription,
    keywords: sport ? [...(SPORT_SEARCH_COPY[sport.slug]?.keywords || []), sport.name, sport.arabic, `${sport.name} Egypt`, `${sport.arabic} في مصر`] : undefined,
    alternates: {
      canonical: discoveryPath(lang, sport?.slug),
      languages: { en: discoveryPath("en", sport?.slug), "ar-EG": discoveryPath("ar", sport?.slug), "x-default": discoveryPath("en", sport?.slug) },
    },
    openGraph: { title: searchTitle, description: searchDescription, url: `${SITE_URL}${discoveryPath(lang, sport?.slug)}`, type: "website", siteName: "Playza", locale: ar ? "ar_EG" : "en_US", alternateLocale: [ar ? "en_US" : "ar_EG"], images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: searchTitle, description: searchDescription, images: [OG_IMAGE] },
  };
}

const SPORT_SEARCH_COPY: Record<string, { en: { title: string; description: string }; ar: { title: string; description: string }; keywords: string[] }> = {
  tennis: {
    en: { title: "Tennis in Cairo, Egypt — Courts, Games & Lessons", description: "Find tennis in Cairo: explore court profiles and published games, compare playing levels and prices, and learn what to check before choosing tennis lessons." },
    ar: { title: "التنس في القاهرة — ملاعب ومباريات ودروس تنس", description: "اكتشف التنس في القاهرة: راجع صفحات الملاعب والمباريات المنشورة ومستوى اللعب والتكلفة، واعرف إيه اللي تسأل عنه قبل اختيار دروس التنس." },
    keywords: ["tennis courts Cairo", "tennis lessons Cairo", "tennis partner Egypt", "ملاعب تنس في القاهرة", "دروس تنس في مصر"],
  },
  volleyball: {
    en: { title: "Volleyball in Cairo, Egypt — Courts & Friendly Games", description: "Discover volleyball in Cairo: explore published friendly games, court profiles and academies. Check the venue, playing level, schedule and cost before joining." },
    ar: { title: "الكرة الطائرة في القاهرة — ملاعب وماتشات ودية", description: "اكتشف الكرة الطائرة في القاهرة: راجع الماتشات الودية المنشورة والملاعب والأكاديميات، واتأكد من المكان والمستوى والميعاد والتكلفة قبل الانضمام." },
    keywords: ["volleyball games Cairo", "volleyball courts Egypt", "join volleyball without a team", "ماتشات كرة طائرة", "ملاعب كرة طائرة في القاهرة"],
  },
  archery: {
    en: { title: "Archery in Cairo, Egypt — Beginner & Training Guide", description: "Looking for archery in Cairo? Learn how to choose introductory coaching, check bow rental and range access, and explore published academy profiles on Playza." },
    ar: { title: "الرماية بالقوس في القاهرة — دليل التدريب والمبتدئين", description: "بتدور على الرماية بالقوس في القاهرة؟ اعرف إزاي تختار تدريب مناسب، وتسأل عن تأجير القوس وتجهيزات الميدان، وتراجع صفحات الأكاديميات المنشورة على بلايزا." },
    keywords: ["archery Cairo", "archery Egypt", "archery training Egypt", "archery for beginners", "الرماية بالقوس في القاهرة", "تدريب الرماية بالقوس", "تعلم الرماية بالقوس"],
  },
};
