import type { Metadata } from "next";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

export type OwnerSportSlug = "padel" | "volleyball" | "basketball";
export type OwnerSportLanguage = "en" | "ar";
export type OwnerSportCopy = {
  title: string; description: string; heading: string; intro: string;
  audience: string; workflowTitle: string; steps: string[]; benefitsTitle: string;
  benefits: [string, string][]; faq: [string, string][]; disclaimer: string;
};

export const OWNER_SPORTS: Record<OwnerSportSlug, { en: OwnerSportCopy; ar: OwnerSportCopy }> = {
  padel: {
    en: {
      title: "Padel Court Booking & Management in Egypt",
      description: "List your padel courts on Playza for free, set court availability and hourly rental prices, and help players find your venue. No commission deducted from court rent.",
      heading: "Make your padel courts easier to discover and book",
      intro: "Players looking for padel courts need clear locations, court photos, prices and free slots. Give each of your courts an accurate listing, then manage booking requests and availability in one owner account.",
      audience: "For independent padel courts and venues with more than one playing court.",
      workflowTitle: "Set up your padel court",
      steps: ["Register as a court owner and enter the business contact details.", "Add each padel court's location, photos, rental rate and number of courts.", "Specify the days and hours available to book.", "Submit your details for approval, then review bookings from your dashboard."],
      benefitsTitle: "What matters for padel venues",
      benefits: [["Court-by-court clarity", "Show the number of courts and relevant venue details so players can check the setting before deciding."], ["Booking hours", "Keep the slots you offer aligned with the times your courts operate."], ["Visible pricing", "Publish the correct rental price and avoid sending every interested player a separate quotation."], ["No rent commission", "Playza does not deduct commission from the court rental amount. Check the published booking terms for payment handling."]],
      faq: [["Can I list several padel courts?", "Yes. A venue owner can manage multiple courts and their published details from one account."], ["Does registering my padel court cost money?", "Listing a sports court on Playza is free. There is no fee for publishing the court listing."], ["Will my court be displayed immediately?", "The standard process includes a listing review after you submit complete court details."], ["Does creating a court listing guarantee bookings?", "No. Listing makes the court discoverable to players, but bookings depend on demand, location, pricing, availability and other factors."]],
      disclaimer: "Court listing is free; published booking and payment terms still apply. No guaranteed booking volume is promised."
    },
    ar: {
      title: "إدارة وحجز ملاعب البادل في مصر | بلايزا",
      description: "ضيف ملعب البادل على بلايزا مجانًا، وحدد ساعات الإتاحة وسعر الإيجار، وساعد اللاعبين يلاقوا ملعبك من غير عمولة على قيمة الإيجار.",
      heading: "خلّي ملعب البادل بتاعك أسهل في البحث والحجز",
      intro: "اللي بيدور على ملعب بادل محتاج يعرف مكانه وسعره ويشوف صوره ومواعيده. اعرض بيانات ملعبك بوضوح وحدّد ساعات التشغيل، وتابع الحجوزات من حساب صاحب الملعب.",
      audience: "مناسبة لملاعب البادل المستقلة والمراكز اللي عندها أكتر من ملعب.",
      workflowTitle: "إزاي تسجّل ملعب البادل؟",
      steps: ["اعمل حساب صاحب ملعب ببيانات التواصل.", "ضيف الموقع والصور وسعر الإيجار وعدد الملاعب.", "حدد الأيام والساعات المتاحة للحجز.", "قدّم بياناتك للمراجعة، وبعد النشر تابع الحجوزات من لوحة الإدارة."],
      benefitsTitle: "المهم لصاحب ملعب البادل",
      benefits: [["تفاصيل كل ملعب", "وضح عدد ملاعب البادل وبيانات المكان علشان اللاعب يقدر يختار."], ["إدارة المواعيد", "اعرض الساعات اللي بتقبل فيها الحجوزات فعلًا."], ["سعر واضح", "اظهر تكلفة الإيجار بدل ما اللاعب يضطر يسأل عن السعر كل مرة."], ["بدون عمولة على الإيجار", "بلايزا مش بتخصم عمولة من قيمة إيجار الملعب. راجع شروط الحجز والدفع المنشورة."]],
      faq: [["ينفع أضيف أكتر من ملعب بادل؟", "أيوه، تقدر تدير أكتر من ملعب وبياناتهم من حساب واحد."], ["تسجيل ملعب البادل مجاني؟", "أيوه، إضافة ونشر الملعب على بلايزا بدون رسوم تسجيل."], ["الملعب بيظهر فورًا؟", "المسار المعتاد فيه مراجعة للبيانات بعد تقديمها."], ["هل التسجيل بيضمن حجوزات؟", "لا، عدد الحجوزات بيعتمد على الطلب والموقع والسعر والمواعيد، والتسجيل مش ضمان لحجم حجوزات معين."]],
      disclaimer: "تسجيل الملعب مجاني، وشروط الحجز والدفع المعلنة بتفضل سارية. مفيش وعد بعدد حجوزات مضمون."
    }
  },
  volleyball: {
    en: {
      title: "Volleyball Court Listing & Booking in Egypt",
      description: "Register your volleyball court on Playza for free. Show surface photos, location, rental price and available sessions to players and game organizers.",
      heading: "Help volleyball organizers find your court",
      intro: "Volleyball groups often need to coordinate a playing location with a fixed date and time. Let organizers review the court, understand the price and see your available booking hours before they arrange a game.",
      audience: "For indoor and outdoor volleyball venues, including multi-court operators.",
      workflowTitle: "Publish your volleyball court",
      steps: ["Create an owner account for your venue.", "Add the volleyball sport, complete address, court photos, court count and rental price.", "Set the hours you make available for bookings.", "Submit the venue for review and manage incoming bookings once approved."],
      benefitsTitle: "Built around group play",
      benefits: [["Location first", "Give organizers a real address and directions so an entire group can find the court."], ["Court details", "Show photos and venue information rather than relying on a name alone."], ["Scheduled sessions", "Configure available hours that fit the court's actual operating schedule."], ["Full rental amount", "Playza does not deduct commission from your stated court rental price."]],
      faq: [["Can indoor and outdoor volleyball courts join?", "Both can be described in their court listing; make sure the published photos and venue details accurately show the surface and setting."], ["Can players join public volleyball games without renting a whole court?", "Playza also lists public games. Joining an organized game and booking a complete court are separate services."], ["Can I change the court's available hours?", "The court owner dashboard supports availability management."], ["Is the listing free?", "Yes, listing the volleyball court is free. The booking process remains subject to the current platform terms."]],
      disclaimer: "Published venue information must reflect your real court. Public games are organized separately from court rental."
    },
    ar: {
      title: "تسجيل ملاعب كرة الطائرة وإدارة حجوزاتها | بلايزا",
      description: "ضيف ملعب الطايرة على بلايزا مجانًا، واعرض الصور والعنوان وسعر الإيجار والمواعيد علشان مجموعات اللاعبين والمنظمين يلاقوك.",
      heading: "وصّل ملعب الطايرة للناس اللي بتنظم ماتشات",
      intro: "منظّم ماتش الطايرة محتاج يتفق مع مجموعة كاملة على مكان وميعاد واضحين. لما بيانات ملعبك وصوره وسعره ومواعيده تكون ظاهرة، هيقدر يراجع التفاصيل قبل الحجز.",
      audience: "لملاعب الكرة الطائرة الداخلية والخارجية، بما فيها الأماكن اللي فيها أكتر من ملعب.",
      workflowTitle: "خطوات إضافة ملعب الطايرة",
      steps: ["سجّل حساب صاحب ملعب.", "ضيف رياضة الطايرة والعنوان الكامل والصور وعدد الملاعب وسعر الإيجار.", "حدد مواعيد التشغيل المتاحة للحجوزات.", "قدّم الملعب للمراجعة وبعد الموافقة تابع الحجوزات."],
      benefitsTitle: "مهم لماتشات المجموعات",
      benefits: [["عنوان دقيق", "ساعد مجموعة اللاعبين توصل لنفس الملعب من غير لخبطة."], ["صور وتفاصيل فعلية", "وضح نوع الملعب والتجهيزات بالصور والمعلومات الصحيحة."], ["مواعيد واضحة", "اعرض أوقات الحجز الحقيقية حسب جدول تشغيل الملعب."], ["قيمة الإيجار كاملة", "بلايزا مش بتخصم عمولة من سعر إيجار الملعب المعلن."]],
      faq: [["ينفع أضيف ملعب طايرة Indoor أو Outdoor؟", "تقدر توضح طبيعة الملعب في بياناته وصوره، ولازم التفاصيل تطابق الواقع."], ["هل اللعب في ماتش مفتوح نفس حجز الملعب؟", "لا، الاشتراك الفردي في ماتش منظم غير حجز ملعب كامل."], ["أقدر أعدل ساعات الحجز؟", "أيوه، لوحة إدارة صاحب الملعب بتسمح بالتحكم في الإتاحة."], ["هل نشر ملعب الطايرة مجاني؟", "أيوه، نشر الملعب مجاني، مع استمرار شروط الحجز والدفع المعمول بها."]],
      disclaimer: "اعرض بيانات الملعب الحقيقية. الانضمام لماتشات عامة خدمة مختلفة عن إيجار الملعب بالكامل."
    }
  },
  basketball: {
    en: {
      title: "Basketball Court Booking & Listing in Egypt",
      description: "List your basketball court for free on Playza. Add your venue details, court photos, rental rate, number of courts and bookable hours.",
      heading: "Get your basketball court discovered by players and groups",
      intro: "Basketball teams and casual groups need accurate court locations and reliable session times. Create a clear listing that helps them compare rental options before making a booking.",
      audience: "For dedicated basketball courts and multi-sport venues offering basketball sessions.",
      workflowTitle: "List a basketball court in four steps",
      steps: ["Sign up as a venue owner.", "Select basketball and add the address, photos, court count and rental fee.", "Enter the court's actual availability windows.", "Submit for review, then manage approved venue bookings in the owner dashboard."],
      benefitsTitle: "What basketball players need to see",
      benefits: [["Correct sport", "Make clear that the venue supports basketball so visitors are not sent to an unsuitable court."], ["Group logistics", "Publish a usable address and directions for everyone attending the game."], ["Reliable times", "Show bookable sessions and keep them current when schedules change."], ["Transparent rental", "Display a real rental rate; Playza does not deduct a court-rent commission."]],
      faq: [["Can multi-sport venues list their basketball court?", "Yes. List the court with the correct sport and accurate details about its availability."], ["Do I need multiple courts to register?", "No. A venue with one eligible court can register."], ["Do you promise a minimum number of new bookings?", "No. Results depend on real demand and your venue's location, pricing and availability."], ["Where do I review booking requests?", "After court approval, the owner dashboard provides booking management tools."]],
      disclaimer: "Playza helps players discover real court listings; it does not guarantee bookings or specific revenue."
    },
    ar: {
      title: "إضافة ملاعب الباسكت وإدارة حجوزات كرة السلة | بلايزا",
      description: "سجّل ملعب الباسكت بتاعك مجانًا على بلايزا، واعرض موقعه وصوره وسعر إيجاره والمواعيد المتاحة للاعبين والمجموعات.",
      heading: "خلّي مجموعات الباسكت تلاقي ملعبك بسهولة",
      intro: "فريق الباسكت أو المجموعة اللي بتلعب للمتعة محتاجين مكان مناسب وميعاد ثابت. ضيف ملعبك بتفاصيله الصحيحة وسعره وساعات الحجز، وساعدهم يختاروا قبل التواصل أو الحجز.",
      audience: "لملاعب الباسكت المتخصصة والملاعب متعددة الرياضات اللي فيها كرة سلة.",
      workflowTitle: "تسجيل ملعب كرة السلة",
      steps: ["اعمل حساب صاحب ملعب.", "اختار كرة السلة وضيف العنوان والصور وعدد الملاعب وسعر الإيجار.", "سجّل المواعيد المتاحة فعلًا.", "قدّم البيانات للمراجعة، وبعد الموافقة تابع الحجوزات من اللوحة."],
      benefitsTitle: "المعلومات اللي مجموعات الباسكت بتدور عليها",
      benefits: [["الرياضة الصحيحة", "وضح إن الملعب مناسب لكرة السلة علشان اللاعب يلاقي المكان المناسب."], ["عنوان للمجموعة", "خلي كل المشاركين يعرفوا طريق الوصول للملعب."], ["جدول واضح", "اعرض المواعيد المتاحة وحدّثها مع أي تغيير."], ["سعر إيجار شفاف", "اظهر السعر الحقيقي، ومن غير خصم عمولة من قيمة إيجار الملعب."]],
      faq: [["ينفع أضيف ملعب متعدد الرياضات؟", "أيوه، بشرط بيانات الرياضة وساعات الإتاحة تكون صحيحة."], ["هل لازم يكون عندي أكتر من ملعب؟", "لا، صاحب ملعب واحد يقدر يسجله."], ["هل بلايزا بتضمن حجوزات جديدة؟", "لا، الحجوزات تعتمد على الطلب الفعلي والموقع والسعر والمواعيد."], ["أتابع الحجوزات منين؟", "بعد الموافقة على الملعب، هتلاقي أدوات إدارة الحجوزات في حساب صاحب الملعب."]],
      disclaimer: "بلايزا بتساعد اللاعبين يكتشفوا الملاعب الفعلية، لكنها مش بتضمن عدد حجوزات أو دخل معين."
    }
  }
};

export function ownerSportPath(lang: OwnerSportLanguage, slug: OwnerSportSlug) {
  return `${lang === "ar" ? "/ar" : ""}/for-courts/${slug}`;
}

export function ownerSportMetadata(lang: OwnerSportLanguage, slug: OwnerSportSlug): Metadata {
  const text = OWNER_SPORTS[slug][lang];
  const url = `${SITE_URL}${ownerSportPath(lang, slug)}`;
  return {
    title: text.title,
    description: text.description,
    alternates: {
      canonical: ownerSportPath(lang, slug),
      languages: {
        en: ownerSportPath("en", slug),
        "ar-EG": ownerSportPath("ar", slug),
        "x-default": ownerSportPath("en", slug)
      }
    },
    openGraph: { title: text.title, description: text.description, url, type: "website", images: [OG_IMAGE], locale: lang === "ar" ? "ar_EG" : "en_US" },
    twitter: { card: "summary_large_image", title: text.title, description: text.description, images: [OG_IMAGE] }
  };
}
