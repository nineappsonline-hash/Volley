import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

/**
 * Playza's bilingual guide registry. volleyball-guides.ts re-exports this
 * module for compatibility.
 *
 * Every guide targets one search intent. Content states only what the
 * platform actually offers — published games, court listings and academy
 * profiles. Availability, prices and schedules are never invented; guides
 * point readers at current listings instead.
 */

export type GuideLanguage = "en" | "ar";
export type GuideCategory = "player" | "academy";
export type GuideCopy = { title: string; description: string; cta: string; sections: [string, string][] };
export type Guide = { slug: string; sport: string; category: GuideCategory; en: GuideCopy; ar: GuideCopy };

export const guidePath = (lang: GuideLanguage, slug?: string) =>
  `${lang === "ar" ? "/ar" : ""}/guides${slug ? `/${slug}` : ""}`;

/* ------------------------------------------------------------------ */
/* Volleyball player-discovery guides (previously volleyball-guides).  */
/* ------------------------------------------------------------------ */

export const VOLLEYBALL_GUIDES: Guide[] = [
  {
    slug: "volleyball-cairo",
    sport: "volleyball",
    category: "player",
    en: {
      title: "Where can I play volleyball in Cairo?",
      description: "Find volleyball courts, public games and academy training in Cairo, Egypt, and compare the details before joining.",
      cta: "Find Volleyball Games",
      sections: [
        ["Choose a court, a game or coaching", "Court rental suits a group organizing its own play. A public game lets you request a place in an organized activity. Academy training is a separate coached service; check its published sessions and fees."],
        ["Compare the actual location", "Browse published volleyball court profiles and the Cairo sport guide. Check the address, directions and journey time. A Cairo listing does not establish availability in every district, and rental prices do not necessarily include coaching or game participation."],
        ["Check the next session", "Open upcoming games to compare dates, times, organizer requirements, player counts and fees. If no suitable activity is listed, revisit the directory or review public academy profiles rather than assuming a court has a session running."],
        ["Before booking", "Confirm the playing surface, lighting, equipment arrangements and rental duration with the venue or organizer. Read booking and payment status before travelling; creating a Playza account is free and is separate from paid activities."],
      ],
    },
    ar: {
      title: "أين ألعب كرة طائرة في القاهرة؟",
      description: "اكتشف ملاعب الكرة الطائرة والماتشات العامة وتدريب الأكاديميات في القاهرة، وقارن التفاصيل قبل الانضمام.",
      cta: "لاقي ماتشات طايرة",
      sections: [
        ["اختار ملعب أو ماتش أو تدريب", "تأجير الملعب مناسب لمجموعة بتنظّم لعبها بنفسها. الماتش العامة تتيح طلب مكان في نشاط منظّم. تدريب الأكاديمية خدمة منفصلة مع مدرب؛ راجع المواعيد والرسوم المنشورة."],
        ["قارن المكان الفعلي", "راجع صفحات الملاعب المنشورة ودليل الكرة الطائرة في القاهرة. اتأكد من العنوان والاتجاهات ووقت الوصول. وجود إعلان في القاهرة لا يعني توفر جلسات في كل منطقة، وسعر التأجير لا يشمل بالضرورة التدريب أو المشاركة."],
        ["راجع الميعاد الجاي", "قارن تواريخ الماتشات وأوقاتها وشروط المنظم وأعداد اللاعبين والرسوم. لو مفيش نشاط مناسب، راجع الدليل بعدين أو صفحات الأكاديميات العامة؛ متفترضش وجود جلسة في كل ملعب."],
        ["قبل الحجز", "اتأكد من أرضية الملعب والإضاءة والأدوات ومدة التأجير مع المكان أو المنظم. راجع حالة الحجز والدفع قبل السفر. إنشاء حساب بلايزا مجاني ومنفصل عن رسوم الأنشطة."],
      ],
    },
  },
  {
    slug: "join-volleyball-without-team",
    sport: "volleyball",
    category: "player",
    en: {
      title: "Can I join a volleyball game without a team?",
      description: "How to request an individual place in a Playza volleyball game, check your level and understand payment and waitlist status.",
      cta: "Join Volleyball Games",
      sections: [
        ["Start with an individual place", "Playza's game join flow accepts your individual account. You do not need to create a team to request a place. The organizer's entry requirements and team arrangements still apply; read the description and ask how players will be grouped."],
        ["Match the stated level", "A beginner label is shown only when the organizer lists that level. For other or unspecified levels, confirm suitability before joining. Do not assume every friendly game is a beginner training session."],
        ["Create your account and return to the game", "Choose a game and select Join. Sign in or create an account, confirm your email if required, then return to the same game and complete joining. Account creation does not reserve a place."],
        ["Check your final status", "Read whether you have joined, are waitlisted, or have payment awaiting verification. Follow the organizer's arrival instructions and confirm required equipment. Invite a friend only if the game's capacity and guest rules allow it."],
      ],
    },
    ar: {
      title: "هل أقدر أنضم لماتش كرة طائرة بدون فريق؟",
      description: "اعرف إزاي تطلب مكان فردي في ماتش بلايزا وتراجع مستوى اللعب وحالة الدفع وقائمة الانتظار.",
      cta: "انضم لماتشات طايرة",
      sections: [
        ["ابدأ بمكان فردي", "تقدر تطلب تنضم بحسابك الفردي في بلايزا من غير إنشاء فريق. شروط المنظم ونظام توزيع الفرق يظلوا ساريين؛ اقرأ الوصف واسأل إزاي اللاعبين هيتقسموا."],
        ["اختار المستوى المناسب", "وصف مبتدئ بيظهر فقط لما المنظم يحدّد المستوى ده. لو المستوى مختلف أو غير محدد، اتأكد إنه مناسب قبل الانضمام. الماتش الودي مش بالضرورة تدريب للمبتدئين."],
        ["أنشئ حسابك وارجع لنفس الماتش", "اختار ماتش واضغط انضمام. سجّل الدخول أو أنشئ حساباً وأكد البريد لو مطلوب، وبعدها ارجع لنفس الماتش لإكمال الانضمام. إنشاء الحساب مش حجز مكان."],
        ["راجع حالتك النهائية", "راجع إذا كنت منضم أو على قائمة الانتظار أو دفعك منتظر التحقق. اتبع تعليمات الوصول واتأكد من الأدوات المطلوبة. ضيف صاحبك فقط لو السعة وقواعد الضيوف تسمح."],
      ],
    },
  },
  {
    slug: "beach-volleyball-beginners",
    sport: "beach-volleyball",
    category: "player",
    en: {
      title: "How to find beach volleyball for beginners in Egypt",
      description: "Choose a suitable beach volleyball session, confirm sand-court facilities and prepare for your first session in Egypt.",
      cta: "Find Beach Volleyball Games",
      sections: [
        ["Look for coaching or a suitable game", "Explore beach volleyball listings and academy profiles. Ask whether a session teaches introductory skills or expects match experience, how teams are formed and whether you can attend individually. A sand-court listing alone does not confirm beginner coaching."],
        ["Confirm the surface and facilities", "Beach volleyball uses a sand court; it does not have to be beside the sea. Check the published venue address, surface, lighting, changing facilities and access arrangements. Do not assume an indoor volleyball court also offers a sand court."],
        ["Prepare with the organizer", "Ask what to wear, whether a ball is provided and how early to arrive. Bring drinking water and confirm suitable footwear and sun protection for the actual conditions. Check weather or schedule changes before travelling to an outdoor session."],
        ["Understand the price and confirmation", "Court rental, game participation and coached training can have different fees. Review what your chosen listing includes and confirm booking and payment status. Availability comes from current listings, not from this guide."],
      ],
    },
    ar: {
      title: "كيف أجد تدريب كرة طائرة شاطئية للمبتدئين في مصر؟",
      description: "اختار جلسة طائرة شاطئية مناسبة واتأكد من تجهيزات الملعب الرملي واستعد لأول مشاركة في مصر.",
      cta: "لاقي ماتشات بيتش فولى",
      sections: [
        ["اختار تدريب أو ماتش مناسبة", "راجع إعلانات الطائرة الشاطئية وصفحات الأكاديميات. اسأل إذا كانت الجلسة لتعليم الأساسيات أو تتطلب خبرة ماتشات، وعن توزيع الفرق وإمكانية الحضور الفردي. وجود ملعب رملي لا يؤكد توفر تدريب للمبتدئين."],
        ["اتأكد من الأرضية والتجهيزات", "الطائرة الشاطئية تستخدم ملعباً رملياً ومش لازم يكون بجوار البحر. راجع عنوان المكان والأرضية والإضاءة وغرف التغيير ونظام الدخول. ملعب الكرة الطائرة العادي مش بالضرورة فيه ملعب رملي."],
        ["استعد بالتنسيق مع المنظم", "اسأل عن الملابس وتوفير الكرة ووقت الوصول. خُد مياه واتأكد من الأحذية والحماية من الشمس المناسبة للظروف الفعلية. راجع تغيرات الجو والمواعيد قبل الذهاب لجلسة خارجية."],
        ["افهم الرسوم والتأكيد", "تأجير الملعب والمشاركة في الماتش والتدريب مع مدرب ممكن تكون برسوم مختلفة. راجع ما يشمله الإعلان وحالة الحجز والدفع. التوفر يعتمد على الإعلانات الحالية وليس هذا الدليل."],
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Player-discovery guides for the remaining active sports.            */
/* ------------------------------------------------------------------ */

export const PLAYER_GUIDES: Guide[] = [
  {
    slug: "basketball-cairo",
    sport: "basketball",
    category: "player",
    en: {
      title: "How to Find Basketball Games and Players in Cairo",
      description: "Find basketball pickup games in Cairo. Compare full-court and half-court games by date, venue, level and spots left, and join as an individual player.",
      cta: "Find Basketball Games",
      sections: [
        ["Start with a published game, not an empty court", "Pickup basketball lives on its players: without a confirmed group, a well-known court can stay empty the whole evening. Start with the basketball games published on Playza — each shows the date, time, venue area, player count and spots left, so you can see whether a game is really happening before you travel."],
        ["Check the format: half-court or full-court", "Basketball games in Cairo range from 3-on-3 on half a court to 5-on-5 on a full court. Half-court suits fewer players and shorter sessions; a full-court game usually needs at least ten confirmed players, so check the available places before joining. Ask the organizer how teams are formed — fixed captains, open rotation or shirt colours at the door — and whether every player rotates in."],
        ["Match the level and the group", "A friendly run is a different game from a competitive league. Read the stated skill level, age expectations and whether the game is men's, women's or mixed, then join where you can genuinely contribute. If a game does not state a beginner level, do not assume beginners are being coached — coached training is an academy service, separate from friendly games."],
        ["Plan arrival and confirm your place", "Getting across Cairo often takes longer than the game itself: check the venue's exact area and map link, and confirm what to bring — indoor shoes, a light and dark shirt, drinking water. Request your place, complete the per-player fee if there is one, and check whether your status is confirmed or waitlisted; a place is only real once the organizer approves it."],
      ],
    },
    ar: {
      title: "عاوز تلعب باسكت ومش لاقي ناس؟",
      description: "لاقي ماتشات باسكت في القاهرة، وقارن ماتشات نص الملعب والملعب الكامل بالميعاد والمكان والمستوى والأماكن الفاضية، وانضم بمفردك على بلايزا.",
      cta: "لاقي ماتشات باسكت",
      sections: [
        ["ابدأ بماتش منشور، مش بملعب فاضي", "الباسكت بيقوم على اللاعبين اللي بيتجمّعوا: من غير مجموعة مؤكدة، ملعب مشهور ممكن يفضل فاضي الليلة كلها. ابدأ بماتشات الباسكت المنشورة على بلايزا — كل ماتش بيعرض الميعاد والساعة ومنطقة الملعب وعدد اللاعبين والأماكن الفاضية، عشان تتأكد إن اللعب حقيقي قبل ما تتحرك."],
        ["راجع النظام: نص ملعب ولا ملعب كامل؟", "ماتشات الباسكت في القاهرة بتتراوح بين 3 ضد 3 على نص الملعب و5 ضد 5 على الملعب الكامل. النص ملعب مناسب لعدد أقل وجلسات قصيرة؛ أما الملعب الكامل فيحتاج عادة 10 لاعبين مؤكدين على الأقل، فراجع الأماكن المتاحة قبل الانضمام. واسأل المنظم إزاي الفرق بتتقسم — كباتن ثابتين، تبديل مفتوح، ولا ألوان عند البوابة — وهل كل اللاعبين بيدخلوا بالتبديل."],
        ["اختار المستوى والمجموعة اللي تناسبك", "الشوط الودي لعبة مختلفة تماماً عن دوري تنافسي. اقرأ المستوى المذكور وفئة السن، وهل الماتش للرجالة أو النساء أو مختلط، وانضم في الماتش اللي تقدر تشارك فيها فعلاً. لو الماتش مش محدد إنها للمبتدئين، متفترضش إن فيه تدريب؛ التدريب مع مدرب خدمة أكاديمية منفصلة عن الماتشات الودية."],
        ["رتّب مشوارك وتأكد من مكانك", "الزحمة في القاهرة بتاخد وقت أكتر من اللعب نفسه: راجع منطقة الملعب بالظبط ورابط الخريطة، واتأكد من المطلوب معاك — حذاء indoor وشيرت فاتح وغامق ومياه. اطلب مكانك واكمل الدفع لو فيه رسوم على اللاعب، وراجع إن حالتك مؤكدة أو على قائمة الانتظار؛ مكانك مش مضمون إلا لما المنظم يوافق."],
      ],
    },
  },
  {
    slug: "padel-cairo",
    sport: "padel",
    category: "player",
    en: {
      title: "How to Find Padel Partners in Cairo",
      description: "Padel is always played 2-on-2, so you need a partner or a group. Find padel games in Cairo, match your level, check what the fee covers and join your next game.",
      cta: "Find Padel Games",
      sections: [
        ["Padel always needs two", "Unlike football or basketball, you cannot organize padel alone: every game needs a partner on your side of the net and an opposing pair on the other. You have two routes — book a court with your own three friends, or join a published padel game that accepts individual registrations and lets the organizer pair you up with other joiners."],
        ["Know the game you are joining", "Padel is a doubles game on an enclosed glass-and-mesh court, and most rallies work through the walls, which makes it tactically different from tennis. A tennis background helps, but it is not padel experience. Check the game's stated level before joining a competitive group, and ask how pairs are formed if that matters to you."],
        ["Compare court time, equipment and cost", "Padel courts follow a standard build, but Cairo venues differ in surface, lighting and number of courts; check the venue's published photos and address before travelling. Padel rackets and padel balls (which are not tennis balls) are usually personal or rented — ask whether they are included in the participation fee, and how the court cost splits between the four players."],
        ["Reserve early and confirm payment", "Padel games with a per-player fee fill quickly in Cairo. Check the spots left, request your place early, complete the payment and confirm that your status is confirmed rather than waitlisted — an unpaid or pending place can go to another player."],
      ],
    },
    ar: {
      title: "بتدور على شريك بادل؟",
      description: "البادل بيتلعب دايماً 2 ضد 2، فمحتاج شريك أو مجموعة. لاقي ماتشات بادل في القاهرة على بلايزا، قارن مستوى اللعبة وتكلفة المشاركة، وانضم لماتشك الجاية.",
      cta: "لاقي ماتشات بادل",
      sections: [
        ["البادل محتاج شريك مرة كل لعبة", "عكس كرة القدم والباسكت، مش تقدر تنظم بادل لوحدك: كل جويلة محتاجة شريك على جنبك من الشبكة، وزوج الخصم على الجنب التاني. عندك طريقتين — تحجز الملعب بثلاثة أصحاب معاك، أو تنضم لماتش بادل منشورة بيقبل فيها اللاعبين الفردي، والمنظم بيرتب اللاعبين في أزواج."],
        ["اعرف اللعبة اللي هتنضمها", "البادل زوجي على ملعب متغلف بالزجاج والشبك، وأغلب التبادلات بتتلعب من على الحيط، وده بيخليها مختلفة تكتيكياً عن التنس. الخلفية في التنس تساعد، بس مش بديل عن خبرة بادل. اقرأ المستوى المذكور قبل ما تنضم لمجموعة تنافسية، واسأل عن طريقة تقسيم الأزواج لو بتفرق معاك."],
        ["قارن وقت الملعب والأدوات والتكلفة", "ملاعب البادل مواصفاتها متقاربة، بس أماكن القاهرة بتختلف في الأرضية والإضاءة وعدد الملاعب، فراجع صور الملعب المنشورة وعنوانه قبل ما تتحرك. مضرب البادل وكورته (اللي مش كور تنس) عادة ملك اللاعب أو بتتأجر؛ اسأل المنظم إذا كانت مشمولة في رسوم المشاركة، وإزاي تكلفة الملعب بتتقسم بين الأربعة."],
        ["احجز بدري واتأكد من الدفع", "ماتشات بادل المدفوعة بتملى بسرعة في القاهرة. راجع الأماكن الفاضية واطلب مكانك بدري، واكمل رسوم اللاعب من خلال نظام الدفع، واتأكد إن حالتك مؤكدة مش على قائمة الانتظار — المكان غير المدفوع ممكن يروح للاعب تاني."],
      ],
    },
  },
  {
    slug: "tennis-cairo",
    sport: "tennis",
    category: "player",
    en: {
      title: "How to Find Tennis Partners in Cairo",
      description: "Find tennis partners and games in Cairo. Compare courts, playing levels and session prices, then request a place in an upcoming game on Playza.",
      cta: "Find Tennis Games",
      sections: [
        ["Decide what kind of session you actually want", "Tennis sessions come in three shapes: a rally partner at a matching pace, a competitive match, or a coached lesson. A partner found through a game listing is a fellow player, not a coach — if you are learning the game from the start, academy training is the better first stop."],
        ["Compare the courts before you commit", "Cairo tennis courts differ in surface (clay, hard or artificial grass), lighting, and whether play runs indoors or outdoors, so check the venue's published profile, photos and address before choosing a time. Confirm with the organizer whether the evening's court is reserved, how long the session lasts and whether the court cost is per player or shared."],
        ["Match the level honestly", "Tennis levels vary enormously between a relaxed Sunday rally and a match with proper service games and tie-breaks. Read the stated level and format — singles or doubles — and if the game does not list one, ask the organizer what standard the group plays at. Joining far above your level helps nobody; the game only works when both players can hold their end of the court."],
        ["Request your place and check the status", "Open the game's details, check the date, time and price, then request your place. Sign in or create a free account if you are not registered, complete payment if the game charges one, and verify that your status is confirmed before you travel to the court; booking and payment status are shown on each game."],
      ],
    },
    ar: {
      title: "عاوز تلعب تنس ومش لاقي حد؟",
      description: "لاقي شريك تنس وماتشات في القاهرة. قارن الملاعب ومستويات اللعب وأسعار الحصص، واطلب مكانك في ماتش قريب على بلايزا.",
      cta: "لاقي ماتشات تنس",
      sections: [
        ["حدد الأول الترس اللي عايزه", "حصص التنس ليها 3 أنواع: شريك بتجري معاه في نفس الوتيرة، ماتش تنافسي، أو حصة مع مدرب. الشريك اللي هتلاقيه من إعلان ماتش لاعب زيّك، مش مدرب — لو بتتعلم اللعبة من الأول، تدريب الأكاديمية هو أول محطة أنسب ليك."],
        ["قارن الملاعب قبل ما تلتزم", "ملاعب التنس في القاهرة بتختلف في الأرضية (تراب أو هارد أو نجيلة صناعية) والإضاءة، وهل اللعب داخلي أو مكشوف، فراجع صفحة الملعب المنشورة وصورها وعنوانها قبل ما تختار ميعاد. اتأكد مع المنظم إن ملعب الحصة محجوز، ومدة اللعب، وهل تكلفة الملعب على اللاعب لوحده أو متقسمة."],
        ["طابق المستوى بصدق", "مستوى التنس بيفرق جداً بين مجموع يوم جمعة هادي وماتش بخدمة وتايبريك عدل. اقرأ المستوى والنظام المذكور — فردي ولا زوجي — ولو الماتش مش كاتب مستوى، اسأل المنظم عن مستوى المجموعة. ماتش فوق مستواك بكتير مش هيفيدك ولا حد؛ التجربة بتنجح بس لما الطرفين الاتنين يقدروا يلعبوا بثبات."],
        ["اطلب مكانك وراجع الحالة", "افتح تفاصيل الماتش، راجع الميعاد والساعة والسعر، واطلب مكانك. سجّل دخولك أو اعمل حساب مجاني لو لسه مش مسجل، واكمل الدفع لو الماتش بياخد رسوم، واتأكد إن حالتك مؤكدة قبل ما تروح للملعب؛ حالة الحجز والدفع ظاهرة في كل ماتش."],
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Academy-discovery guides.                                           */
/* ------------------------------------------------------------------ */

export const ACADEMY_GUIDES: Guide[] = [
  {
    slug: "choose-sports-academy-child",
    sport: "volleyball",
    category: "academy",
    en: {
      title: "How to Choose a Sports Academy for Your Child",
      description: "Compare sports academies in Egypt by sport, age groups, location, schedule and published fees, then book a trial session before you commit.",
      cta: "Explore Sports Academies",
      sections: [
        ["Start from the sport and your child's age", "Choose based on what your child wants to play and their age, not on advertising. Academy profiles on Playza list each academy's sports, location and description. Whether an academy publishes age groups, coach details or trial sessions varies from one academy to another: the profile shows what the academy has published, and anything not shown is worth asking about directly."],
        ["Check the schedule you can realistically keep", "In Cairo traffic, how far the academy is matters as much as how good it is: an excellent academy you cannot reach twice a week is a subscription you will not use. Compare locations against your home and school routes, and confirm your child's age-group session times with the academy — public profiles may not list every schedule."],
        ["Understand what the fee covers", "Academy fees sometimes cover coaching sessions only, with registration, kit or equipment billed separately. Training prices published on an academy's profile show what that academy chose to disclose; ask about anything else before you commit, and do not assume a fee you see is monthly or annual — confirm the billing period as well as the first session."],
        ["Judge with a trial session, not a brochure", "Most comparisons settle in one visit: how the coach communicates with children, whether the group level fits your child, and whether the facilities are safe and supervised. Ask for a trial session through the enquiry option on the academy's page. A trial is an introduction — it does not guarantee admission, level placement or timetable changes."],
      ],
    },
    ar: {
      title: "إزاي تختار أكاديمية رياضية مناسبة لطفلك؟",
      description: "قارن الأكاديميات الرياضية في مصر حسب الرياضة والمجموعات العمرية والمكان والمواعيد والأسعار المنشورة، وجرّب حصة تجريبية قبل ما تلتزم.",
      cta: "اكتشف الأكاديميات الرياضية",
      sections: [
        ["ابدأ من الرياضة وسن طفلك", "اختار على أساس اللي طفلك عايز يلعبه وعمرك، مش على أساس الدعاية. صفحات الأكاديميات على بلايزا بتعرض رياضات كل أكاديمية ومكانها ووصفها. النشر بتاع المجموعات العمرية وتفاصيل المدربين والحصص التجريبية بيختلف من أكاديمية للتانية؛ الصفحة بتعرض اللي نشرته الأكاديمية، وأي حاجة مش مكتوبة اسأل عنها مباشرة."],
        ["راجع مواعيد تنفع تكمل عليها فعلاً", "في زحمة القاهرة، المسافة مهمة زي جودة الأكاديمية بالظبط: أكاديمية ممتازة تقدر تروح لها مرتين في الأسبوع مش هتكمل عليها. قارن الأماكن مع بيتك ومدرسة طفلك، واتأكد من ميعاد حصص مجموعة سن طفلك مع الأكاديمية — الصفحات العامة ممكن ما تعرضش كل المواعيد."],
        ["افهم اللي بيشمله السعر", "أسعار الأكاديميات ممكن تشمل حصص التدريب بس، ويبقى التسجيل أو الزي أو الأدوات منفصلين. أسعار التدريب المنشورة في صفحة الأكاديمية بتوضح اللي اختارت الأكاديمية إنها تعلنو؛ اسأل عن أي حاجة تانية قبل ما تلتزم، ومتفترضش إن السعر اللي شفته شهري أو سنوي — اتأكد من نظام الدفع ومن أول حصة."],
        ["اتخذ قرارك بحصة تجريبية، مش بكتيّب", "معظم المقارنة بتتحسم في زيارة واحدة: إزاي المدرب بيتعامل مع الأطفال، وهل مستوى المجموعة مناسب لطفلك، وهل المكان آمن ومُتابَع. اطلب حصة تجريبية من خيار الاستفسار في صفحة الأكاديمية. الحصة التجريبية تعريف — مش ضمان قبول أو تحديد مستوى أو تغيير مواعيد."],
      ],
    },
  },
  {
    slug: "start-volleyball-adult",
    sport: "volleyball",
    category: "academy",
    en: {
      title: "How to Start Volleyball Training as an Adult",
      description: "Learn the difference between coached sessions and friendly games, find adult and beginner volleyball groups in Egypt and compare fees before you enrol.",
      cta: "Find Volleyball Groups",
      sections: [
        ["Coached training and friendly games are different services", "Adult volleyball comes in two forms: academy training that builds skills and fitness week by week with a coach, and friendly games where you learn by playing. If you have never played — or last played at school years ago — starting in a training group is a smoother path than arriving cold at a game."],
        ["Look for adult and beginner groups", "Some academies mainly coach children and juniors, so check each academy's published groups for adult sessions; if age groups are not shown, ask the academy directly. Also do not assume that joining an academy gives you a place in every session — group ages, sizes and times are decided academy by academy."],
        ["Know what the first weeks involve", "Adult beginner volleyball normally starts with ball contact, footwork and simple passing before spiking or organized play, and usually includes fitness work alongside skills. Bring indoor court shoes, comfortable sportswear and drinking water, and confirm with the academy which equipment is provided."],
        ["Compare the cost against your schedule", "Compare the price per session or monthly rate against how many of the announced times you can actually attend, and check whether additional fees such as membership or kit apply. Once your basics are in place, friendly games — including volleyball games published on Playza — are a natural next step."],
      ],
    },
    ar: {
      title: "إزاي تبدأ تدريب طايرة وأنت كبير؟",
      description: "اعرف الفرق بين الحصص المدربة والماتشات الودية، واقف مجموعات طايرة للكبار والمبتدئين في مصر، وقارن الأسعار قبل ما تشترك.",
      cta: "لاقي مجموعات طايرة",
      sections: [
        ["التدريب مع مدرب خدمة مختلفة عن الماتش الودي", "طايرة للكبار ليها شكلين: تدريب أكاديمية بيبني المهارات واللياقة أسبوع ورا أسبوع مع مدرب، وماتشات ودية بتتعلم فيها وأنت بتلعب. لو عمرك ما لعبت، أو آخر مرة كانت في المدرسة من سنين، البدء بمجموعة تدريب أهدى بكتير من إنك تنزل ماتش على طول."],
        ["دوّر على مجموعات للكبار والمبتدئين", "بعض الأكاديميات بتركّز على الأطفال والناشئين، فراجع المجموعات المنشورة في كل أكاديمية للتأكد من وجود حصص للكبار؛ لو المجموعات العمرية مش مكتوبة، اسأل الأكاديمية نفسها. ومتفترضش إن اشتراكك في أكاديمية معناه مكان في كل حصة — عمر المجموعات وعددها ومواعيدها بيتحدد من كل أكاديمية."],
        ["اعرف الأسابيع الأولى شكلها إيه", "تدريب الطايرة للمبتدئين الكبار بيبدأ عادة بلمسة الكرة وحركة القدم والتمرير البسيط قبل الهجوم والتنظيم، وممكن فيه تمارين لياقة جنب المهارات. خُد حذاء indoor وملابس رياضية مريحة ومياه، واسأل الأكاديمية عن الأدوات اللي بتتم توفيرها."],
        ["قارن التكلفة مع مواعيدك", "قارن سعر الحصة أو الاشتراك الشهري بعدد المواعيد اللي تقدر تحضرها فعلاً، واتأكد من وجود رسوم إضافية زي العضوية أو الزي. ولما يثبت عندك الأساسيات، ماتشات الطايرة الودية — من ضمنها اللي منشورة على بلايزا — تلاقي خطوة تالية طبيعية."],
      ],
    },
  },
  {
    slug: "padel-training-for-beginners",
    sport: "padel",
    category: "academy",
    en: {
      title: "How to Find Beginner Padel Training",
      description: "Choose beginner padel lessons in Egypt: what a good starter program covers, questions to ask the academy, and how to compare fees and locations.",
      cta: "Explore Padel Academies",
      sections: [
        ["Lessons teach the game; games test it", "Padel looks simple to watch but has techniques of its own — hitting off the glass, controlling pace on a small court and doubles positioning. A beginner program teaches grip, racket control, movement on the enclosed glass-and-mesh court and basic doubles play. A published friendly game usually expects you to be able to rally already; jumping into competitive games without lessons is frustrating for you and your partners."],
        ["Ask what the beginner track covers and who coaches it", "Padel is one of the fastest-growing sports in Egypt and coaching offerings vary widely. Before paying, ask how many sessions the beginner track runs, whether equipment (racket and padel balls) is included, how many players share the court and what the coach's padel experience is. Answers vary between academies; the profile page shows what the academy has published, and the rest is worth asking about directly."],
        ["Compare locations and the full cost", "Compare academies by location — travel across Cairo is a real factor — plus session length, players per court and what the published training prices include. Buy-in costs add up: racket rental, court time outside the lesson and kit can be billed separately, so confirm what the quoted price covers."],
        ["Move from lessons to real games", "Once you can rally and know the scoring and doubles positions, look for games labelled for beginners or explicitly open to new players, and check the game's stated level before joining. A few relaxed games after a solid beginner course are the quickest way to turn lessons into actual play."],
      ],
    },
    ar: {
      title: "إزاي تختار تدريب بادل للمبتدئين؟",
      description: "اختار دروس بادل للمبتدئين في مصر: الأحداث المهمة في برنامج بداية كويس، وأسئلة تسألها للأكاديمية قبل الدفع، وإزاي تقارن الأسعار والأماكن.",
      cta: "اكتشف أكاديميات البادل",
      sections: [
        ["الدروس بتعلم اللعبة، والماتشات بتختبرها", "البادل شكله سهل وأنت بتتفرج، بس عنه تكنيك خاص — الضرب من على الزجاج، التحكم في الوتيرة على ملعب صغير، وترتيب الزوجي. برنامج المبتدئين بيدرس القبض على المضرب والتحكم والحركة على ملعب الزجاج والشبك وأساسيات اللعب الزوجي. الماتش المنشورة عادة بتتوقع منك إنك واحد تبادل وصل؛ دخول ماتشات تنافسية من غير دروس محبط ليك ولشركائك."],
        ["اسأل عن محتوى برنامج المبتدئين ومين المدرب", "البادل من أسرع الرياضات نمواً في مصر، وعروض التدريب متنوعة جداً. قبل الدفع، اسأل عدد حصص برنامج للمبتدئين، وهل الأدوات (مضرب وكرات بادل) مشمولة، وكم عدد اللاعبين في الملعب، والخبرة بتاعت المدرب في البادل. الإجابات مختلفة من أكاديمية؛ الصفحة بتعرض اللي الأكاديمية نشرته، والباقي الأحسن تسأل عنه مباشرة."],
        ["قارن الأماكن والتكلفة الكاملة", "قارن الأكاديميات حسب المكان — السفر في القاهرة عامل ملحوظ — ومدة الحصة وعدد اللاعبين في الملعب واللي أسعار التدريب المنشورة بتشمله. التكلفة بتتراكم: تأجير المضرب ووقت الملعب خارج الحصة والزي ممكن يتحاسبوا منفصلين — اتأكد من اللي السعر المعلن بيغطيه."],
        ["انتقل من الدروس للعب الحقيقي", "لما تقدر تجري وتعرف النقاط وترتيب الزوجي، دور على ماتشات معنونة للمبتدئين أو اللي بتقبل صراحة لاعبين جدد، وراجع المستوى المذكور قبل الانضمام. شوية ماتشات هادئة بعد برنامج مبتدئين متكامل أسرع وسيلة تخلي الدروس تتحول للعب حقيقي."],
      ],
    },
  },
];

export const ALL_GUIDES: Guide[] = [...VOLLEYBALL_GUIDES, ...PLAYER_GUIDES, ...ACADEMY_GUIDES];

export const findGuide = (slug: string) => ALL_GUIDES.find(g => g.slug === slug);
/** Player-discovery guides for one sport slug, e.g. "basketball". */
export const playerGuidesForSport = (sportSlug: string) => ALL_GUIDES.filter(g => g.category === "player" && g.sport === sportSlug);

export function guideMetadata(lang: GuideLanguage, slug?: string): Metadata {
  const guide = findGuide(slug ?? "");
  const title = guide?.[lang].title ?? (lang === "ar" ? "أدلّة بلايزا الرياضية — لاقي ماتشات وشركاء وأكاديميات" : "Playza Sports Guides — Games, Partners & Academies in Egypt");
  const description = guide?.[lang].description ?? (lang === "ar" ? "إرشادات عملية لاختيار الماتشات والشركاء والأكاديميات من الإعلانات الحالية في مصر." : "Practical guidance for finding players and games and choosing sports academies from current listings in Egypt.");
  return { title, description, alternates: { canonical: guidePath(lang, slug), languages: { en: guidePath("en", slug), "ar-EG": guidePath("ar", slug), "x-default": guidePath("en", slug) } }, openGraph: { title, description, url: `${SITE_URL}${guidePath(lang, slug)}`, type: "website", locale: lang === "ar" ? "ar_EG" : "en_US", images: [OG_IMAGE] }, twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] } };
}
