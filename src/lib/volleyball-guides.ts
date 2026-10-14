import type { Metadata } from "next";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";
export type GuideLanguage = "en" | "ar";
export const guidePath = (lang: GuideLanguage, slug?: string) => `${lang === "ar" ? "/ar" : ""}/guides${slug ? `/${slug}` : ""}`;
export const VOLLEYBALL_GUIDES = [
  {
    slug: "volleyball-cairo",
    sport: "volleyball",
    en: { title: "Where can I play volleyball in Cairo?", description: "Find volleyball courts, public games and academy training in Cairo, Egypt, and compare the details before joining.", sections: [
      ["Choose a court, a game or coaching", "Court rental suits a group organizing its own play. A public game lets you request a place in an organized activity. Academy training is a separate coached service; check its published sessions and fees."],
      ["Compare the actual location", "Browse published volleyball court profiles and the Cairo sport guide. Check the address, directions and journey time. A Cairo listing does not establish availability in every district, and rental prices do not necessarily include coaching or game participation."],
      ["Check the next session", "Open upcoming games to compare dates, times, organizer requirements, player counts and fees. If no suitable activity is listed, revisit the directory or review public academy profiles rather than assuming a court has a session running."],
      ["Before booking", "Confirm the playing surface, lighting, equipment arrangements and rental duration with the venue or organizer. Read booking and payment status before travelling; creating a Playza account is free and is separate from paid activities."],
    ] },
    ar: { title: "أين ألعب كرة طائرة في القاهرة؟", description: "اكتشف ملاعب الكرة الطائرة والمباريات العامة وتدريب الأكاديميات في القاهرة، وقارن التفاصيل قبل الانضمام.", sections: [
      ["اختار ملعب أو مباراة أو تدريب", "تأجير الملعب مناسب لمجموعة بتنظّم لعبها بنفسها. المباراة العامة تتيح طلب مكان في نشاط منظّم. تدريب الأكاديمية خدمة منفصلة مع مدرب؛ راجع المواعيد والرسوم المنشورة."],
      ["قارن المكان الفعلي", "راجع صفحات الملاعب المنشورة ودليل الكرة الطائرة في القاهرة. اتأكد من العنوان والاتجاهات ووقت الوصول. وجود إعلان في القاهرة لا يعني توفر جلسات في كل منطقة، وسعر التأجير لا يشمل بالضرورة التدريب أو المشاركة."],
      ["راجع الميعاد القادم", "قارن تواريخ المباريات وأوقاتها وشروط المنظم وأعداد اللاعبين والرسوم. لو مفيش نشاط مناسب، راجع الدليل لاحقاً أو صفحات الأكاديميات العامة؛ متفترضش وجود جلسة في كل ملعب."],
      ["قبل الحجز", "اتأكد من أرضية الملعب والإضاءة والأدوات ومدة التأجير مع المكان أو المنظم. راجع حالة الحجز والدفع قبل السفر. إنشاء حساب بلايزا مجاني ومنفصل عن رسوم الأنشطة."],
    ] },
  },
  {
    slug: "join-volleyball-without-team", sport: "volleyball",
    en: { title: "Can I join a volleyball game without a team?", description: "How to request an individual place in a Playza volleyball game, check your level and understand payment and waitlist status.", sections: [
      ["Start with an individual place", "Playza's game join flow accepts your individual account. You do not need to create a team to request a place. The organizer's entry requirements and team arrangements still apply; read the description and ask how players will be grouped."],
      ["Match the stated level", "A beginner label is shown only when the organizer lists that level. For other or unspecified levels, confirm suitability before joining. Do not assume every friendly game is a beginner training session."],
      ["Create your account and return to the game", "Choose a game and select Join. Sign in or create an account, confirm your email if required, then return to the same game and complete joining. Account creation does not reserve a place."],
      ["Check your final status", "Read whether you have joined, are waitlisted, or have payment awaiting verification. Follow the organizer's arrival instructions and confirm required equipment. Invite a friend only if the game's capacity and guest rules allow it."],
    ] },
    ar: { title: "هل أقدر أنضم لمباراة كرة طائرة بدون فريق؟", description: "اعرف إزاي تطلب مكان فردي في مباراة بلايزا وتراجع مستوى اللعب وحالة الدفع وقائمة الانتظار.", sections: [
      ["ابدأ بمكان فردي", "يمكنك طلب الانضمام بحسابك الفردي في بلايزا من غير إنشاء فريق. شروط المنظم ونظام توزيع الفرق يظلوا ساريين؛ اقرأ الوصف واسأل إزاي اللاعبين هيتقسموا."],
      ["اختار المستوى المناسب", "وصف مبتدئ بيظهر فقط لما المنظم يحدّد المستوى ده. لو المستوى مختلف أو غير محدد، اتأكد إنه مناسب قبل الانضمام. المباراة الودية مش بالضرورة تدريب للمبتدئين."],
      ["أنشئ حسابك وارجع لنفس المباراة", "اختار مباراة واضغط انضمام. سجّل الدخول أو أنشئ حساباً وأكد البريد لو مطلوب، وبعدها ارجع لنفس المباراة لإكمال الانضمام. إنشاء الحساب مش حجز مكان."],
      ["راجع حالتك النهائية", "راجع إذا كنت منضم أو على قائمة الانتظار أو دفعك منتظر التحقق. اتبع تعليمات الوصول واتأكد من الأدوات المطلوبة. ضيف صاحبك فقط لو السعة وقواعد الضيوف تسمح."],
    ] },
  },
  {
    slug: "beach-volleyball-beginners", sport: "beach-volleyball",
    en: { title: "How to find beach volleyball for beginners in Egypt", description: "Choose a suitable beach volleyball session, confirm sand-court facilities and prepare for your first session in Egypt.", sections: [
      ["Look for coaching or a suitable game", "Explore beach volleyball listings and academy profiles. Ask whether a session teaches introductory skills or expects match experience, how teams are formed and whether you can attend individually. A sand-court listing alone does not confirm beginner coaching."],
      ["Confirm the surface and facilities", "Beach volleyball uses a sand court; it does not have to be beside the sea. Check the published venue address, surface, lighting, changing facilities and access arrangements. Do not assume an indoor volleyball court also offers a sand court."],
      ["Prepare with the organizer", "Ask what to wear, whether a ball is provided and how early to arrive. Bring drinking water and confirm suitable footwear and sun protection for the actual conditions. Check weather or schedule changes before travelling to an outdoor session."],
      ["Understand the price and confirmation", "Court rental, game participation and coached training can have different fees. Review what your chosen listing includes and confirm booking and payment status. Availability comes from current listings, not from this guide."],
    ] },
    ar: { title: "كيف أجد تدريب كرة طائرة شاطئية للمبتدئين في مصر؟", description: "اختار جلسة طائرة شاطئية مناسبة واتأكد من تجهيزات الملعب الرملي واستعد لأول مشاركة في مصر.", sections: [
      ["اختار تدريب أو مباراة مناسبة", "راجع إعلانات الطائرة الشاطئية وصفحات الأكاديميات. اسأل إذا كانت الجلسة لتعليم الأساسيات أو تتطلب خبرة مباريات، وعن توزيع الفرق وإمكانية الحضور الفردي. وجود ملعب رملي لا يؤكد توفر تدريب للمبتدئين."],
      ["اتأكد من الأرضية والتجهيزات", "الطائرة الشاطئية تستخدم ملعباً رملياً ومش لازم يكون بجوار البحر. راجع عنوان المكان والأرضية والإضاءة وغرف التغيير ونظام الدخول. ملعب الكرة الطائرة العادي مش بالضرورة فيه ملعب رملي."],
      ["استعد بالتنسيق مع المنظم", "اسأل عن الملابس وتوفير الكرة ووقت الوصول. خُد مياه واتأكد من الأحذية والحماية من الشمس المناسبة للظروف الفعلية. راجع تغيرات الجو والمواعيد قبل الذهاب لجلسة خارجية."],
      ["افهم الرسوم والتأكيد", "تأجير الملعب والمشاركة في المباراة والتدريب مع مدرب ممكن تكون برسوم مختلفة. راجع ما يشمله الإعلان وحالة الحجز والدفع. التوفر يعتمد على الإعلانات الحالية وليس هذا الدليل."],
    ] },
  },
] as const;
export function guideMetadata(lang: GuideLanguage, slug?: string): Metadata {
  const guide = VOLLEYBALL_GUIDES.find(g => g.slug === slug);
  const title = guide ? guide[lang].title : lang === "ar" ? "دليل الكرة الطائرة والطائرة الشاطئية في مصر" : "Volleyball and Beach Volleyball Guides for Egypt";
  const description = guide ? guide[lang].description : lang === "ar" ? "إرشادات عملية لاختيار الملاعب والانضمام الفردي والاستعداد لأول جلسة." : "Practical guidance for finding courts, joining individually and preparing for your first session.";
  return { title, description, alternates: { canonical: guidePath(lang, slug), languages: { en: guidePath("en", slug), "ar-EG": guidePath("ar", slug), "x-default": guidePath("en", slug) } }, openGraph: { title, description, url: `${SITE_URL}${guidePath(lang, slug)}`, type: "website", locale: lang === "ar" ? "ar_EG" : "en_US", images: [OG_IMAGE] }, twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] } };
}
