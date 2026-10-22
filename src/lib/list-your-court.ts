import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

export const listYourCourtPath = (lang: "en" | "ar") =>
  `${lang === "ar" ? "/ar" : ""}/list-your-court`;

/**
 * Bilingual landing copy for venue owners. Every claim here is limited to what
 * the platform actually does: free court listing and no commission is deducted
 * from the court rental price. It deliberately avoids promising that advance
 * payment eliminates cancellations or quoting unverified prices.
 */
export const LIST_YOUR_COURT = {
  en: {
    title: "List Your Sports Court for Free in Egypt",
    description:
      "List your sports court on Playza for free. Reach players searching for padel, tennis, basketball, volleyball and beach volleyball courts, manage bookings and keep the full rental price with no commission deducted.",
    eyebrow: "FOR VENUE OWNERS",
    heading: "List your court for free. Keep the full rental price.",
    intro:
      "Playza helps sports venue owners in Egypt put their courts in front of players looking to book. Register your court, add photos and prices, set your available booking hours and manage bookings from one dashboard — with Arabic and English support.",
    cta: "Register your court",
    home: "Home",
    switch: "العربية",
    benefitTitle: "Why venue owners list on Playza",
    benefits: [
      ["Free to list", "Registering your sports court on Playza is free. There is no charge to publish your court and its details."],
      ["No commission on the rent", "Playza does not deduct a commission from the court rental price. You receive the full rental amount for your court."],
      ["Reach players online", "Approved courts appear in Playza discovery where players browse courts by sport and location."],
      ["Photos and videos", "Upload court photos so players can see the surface and facilities before they book."],
      ["Booking management", "Review and manage court bookings from your owner dashboard."],
      ["Availability control", "Set the hours your courts are open for booking and keep your listing accurate."],
      ["Multiple courts", "Manage more than one court or location from the same account."],
      ["Arabic and English", "The owner dashboard works in Arabic (right-to-left) and English (left-to-right)."],
    ],
    workflowTitle: "How to list your court on Playza",
    workflow: [
      "Create a venue owner account with your business and contact details.",
      "Add your court: sport, location, hourly rental price, court count and photos.",
      "Set your available booking hours and submit the court for review.",
      "Once approved, manage bookings and availability from your dashboard.",
    ],
    fitTitle: "For courts across Egypt",
    fit:
      "Playza supports padel, tennis, basketball, volleyball and beach volleyball courts. Whether you run a single court or several venues, you can list them from one account. Review the platform's terms in your account before you start.",
    sports: "Explore courts by sport",
    faqTitle: "Venue owner questions",
    faqs: [
      ["Is listing my court free?", "Yes. Registering and publishing your sports court on Playza is free. There is no listing charge to put your court online."],
      ["Does Playza take a commission from the court rental price?", "No. Playza does not deduct a commission from the court rental price. You receive the full rental amount for your court."],
      ["How do I get my court approved?", "After you register your court with its details, a Playza admin reviews the listing. Keep your name, sport, location, price and photos accurate to help the review."],
      ["Can I manage more than one court?", "Yes. You can add multiple courts and set each court's details, price and available booking hours from the same account."],
      ["Do players pay through Playza?", "The platform supports collecting payment according to the existing booking process. Advance payment does not remove every cancellation risk; review each booking and its payment status before you prepare the court."],
      ["How do I start?", "Create a venue owner account to add your first court. Review the available terms in the account before you begin; this page does not quote an unverified price."],
    ],
  },
  ar: {
    title: "ضيف ملعبك على بلايزا مجانًا ومن غير عمولة",
    description:
      "سجّل ملعبك الرياضي على بلايزا مجانًا. وصّل لملايين اللاعبين اللي بيدوروا على ملاعب بادل وتنس وباسكت وطايرة وطايرة شاطئية، وأدر حجوزاتك واحصل على قيمة الإيجار كاملة من غير خصم عمولة.",
    eyebrow: "لأصحاب الملاعب",
    heading: "ضيف ملعبك مجانًا واحصل على قيمة الإيجار كاملة.",
    intro:
      "بلايزا بتساعد أصحاب الملاعب الرياضية في مصر إن ملاعبهم توصل للاعبين اللي عاوزين يحجزوا. سجّل ملعبك، وأضف الصور والأسعار، وحدّد ساعات الحجز المتاحة، وأدر الحجوزات من لوحة واحدة بدعم العربية والإنجليزية.",
    cta: "سجّل ملعبك",
    home: "الرئيسية",
    switch: "English",
    benefitTitle: "ليه أصحاب الملاعب يسجّلوا على بلايزا؟",
    benefits: [
      ["التسجيل مجاني", "تسجيل ملعبك الرياضي على بلايزا مجاني، ومفيش رسوم لنشر الملعب وبياناته."],
      ["من غير عمولة على الإيجار", "بلايزا مش بتخصم عمولة من سعر إيجار الملعب، وبتستلم قيمة الإيجار كاملة."],
      ["وصول للاعبين أونلاين", "الملاعب المعتمدة بتظهر في بحث بلايزا حيث اللاعبين بيدوروا على الملاعب حسب الرياضة والمكان."],
      ["الصور والفيديو", "ارفع صور الملعب عشان اللاعبين يشوفوا الأرضية والتجهيزات قبل الحجز."],
      ["إدارة الحجوزات", "راجع وأدر حجوزات الملعب من لوحة تحكم صاحب الملعب."],
      ["التحكم في الإتاحة", "حدّد الساعات اللي الملعب متاح فيها للحجز، وخلي بيانات ملعبك محدّثة."],
      ["أكثر من ملعب", "أدر أكتر من ملعب أو فرع من نفس الحساب."],
      ["العربية والإنجليزية", "لوحة التحكم بتشتغل بالعربية (من اليمين لليسار) والإنجليزية (من اليسار لليمين)."],
    ],
    workflowTitle: "إزاي تضيف ملعبك على بلايزا؟",
    workflow: [
      "أنشئ حساب صاحب ملعب ببيانات النشاط والتواصل.",
      "أضف ملعبك: الرياضة والمكان وسعر الإيجار في الساعة وعدد الملاعب والصور.",
      "حدّد ساعات الحجز المتاحة وأرسل الملعب للمراجعة.",
      "بعد الموافقة، أدر الحجوزات والإتاحة من لوحة التحكم.",
    ],
    fitTitle: "لملاعب في كل مصر",
    fit:
      "بلايزا بتدعم ملاعب البادل والتنس والباسكت والطايرة والطايرة الشاطئية. سواء عندك ملعب واحد أو أكتر، تقدر تسجّلهم من حساب واحد. راجع شروط المنصة داخل حسابك قبل ما تبدأ.",
    sports: "اكتشف الملاعب حسب الرياضة",
    faqTitle: "أسئلة أصحاب الملاعب",
    faqs: [
      ["هل تسجيل الملعب مجاني؟", "نعم. تسجيل ونشر ملعبك الرياضي على بلايزا مجاني، ومفيش رسوم نشر عشان تحط ملعبك أونلاين."],
      ["هل بلايزا بتاخد عمولة من سعر إيجار الملعب؟", "لا. بلايزا مش بتخصم عمولة من سعر إيجار الملعب، وبتستلم قيمة الإيجار كاملة."],
      ["إزاي تتم الموافقة على ملعبي؟", "بعد ما تسجّل ملعبك ببياناته، فريق بلايزا يراجع الإعلان. خلّي الاسم والرياضة والمكان والسعر والصور دقيقة لتسهيل المراجعة."],
      ["هل أقدر أدر أكتر من ملعب؟", "نعم. تقدر تضيف أكتر من ملعب وتحدّد لكل ملعب بياناته وسعره وساعات الحجز المتاحة من نفس الحساب."],
      ["هل اللاعبون بيدفعوا من خلال بلايزا؟", "المنصة بتدعم تحصيل الدفع حسب نظام الحجز الحالي. الدفع المقدم مش معناه إلغاء كل المخاطر؛ راجع كل حجز وحالة دفعه قبل ما تجهّز الملعب."],
      ["إزاي أبدأ؟", "أنشئ حساب صاحب ملعب عشان تضيف ملعبك الأول. راجع الشروط المتاحة داخل الحساب قبل ما تبدأ؛ الصفحة دي مش بتعرض سعرًا غير مؤكّد."],
    ],
  },
} as const;

export function listYourCourtMetadata(lang: "en" | "ar"): Metadata {
  const c = LIST_YOUR_COURT[lang];
  const title = `${c.title} | Playza`;
  return {
    title: c.title,
    description: c.description,
    keywords:
      lang === "ar"
        ? ["تسجيل ملعب للإيجار", "إضافة ملعب على موقع حجز", "تسويق ملعب رياضي", "إدارة حجوزات الملاعب", "برنامج إدارة ملاعب", "نظام حجز ملاعب"]
        : ["list your sports court", "free sports court listing", "register sports court Egypt", "sports court booking management", "sports venue booking system", "sports court management software"],
    alternates: {
      canonical: listYourCourtPath(lang),
      languages: {
        en: listYourCourtPath("en"),
        "ar-EG": listYourCourtPath("ar"),
        "x-default": listYourCourtPath("en"),
      },
    },
    openGraph: {
      title,
      description: c.description,
      url: `${SITE_URL}${listYourCourtPath(lang)}`,
      type: "website",
      siteName: "Playza",
      locale: lang === "ar" ? "ar_EG" : "en_US",
      alternateLocale: [lang === "ar" ? "en_US" : "ar_EG"],
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description: c.description, images: [OG_IMAGE] },
  };
}
