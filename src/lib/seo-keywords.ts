/**
 * Playza SEO keyword mapping based on actual business model.
 *
 * Primary positioning: "Find people to play sports with, join games & discover sports academies in Egypt"
 *
 * Prioritization is QUALITATIVE (search intent × relevance × conversion potential).
 * No verified Google volumes or difficulty metrics are cited anywhere in this
 * file or in the docs derived from it.
 */

export type KeywordIntent =
  | "player-find-games"      // Find people to play with / join games (PRIMARY)
  | "academy-discovery"      // Find sports academies/training
  | "venue-owner-b2b"        // Venue owners listing facilities
  | "academy-owner-b2b"      // Academy owners needing management software
  | "local-discovery"        // Location-based searches
  | "educational";           // How-to guides

export type PageStatus = "live" | "improved-in-phase4" | "new-in-phase4";

export type KeywordCluster = {
  id: string;
  name: string;
  nameAr: string;
  intent: KeywordIntent;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  conversionPotential: "high" | "medium" | "low"; // estimated, qualitative
  primaryPage: string;
  keywords: {
    en: string[];
    ar: string[];
    arColloquial?: string[]; // Egyptian Arabic
  };
  /** Who the cluster is written for. */
  audience: string;
  /** Site languages that carry the intent. */
  languages: ("en" | "ar")[];
  /** Where the demand is geographically relevant. */
  geographicRelevance: string;
  /** What a successful visit converts to. */
  conversionGoal: string;
  /** Implementation state of primaryPage as of Phase 4. */
  pageStatus: PageStatus;
  notes: string;
};

export const KEYWORD_CLUSTERS: KeywordCluster[] = [
  {
    id: "players-find-games",
    name: "Find People to Play Sports With",
    nameAr: "عاوز ألعب مع ناس",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/games",
    keywords: {
      en: [
        "find people to play sports with egypt",
        "join sports games cairo",
        "find sports partners cairo",
        "meet people through sports egypt",
        "sports groups cairo",
        "casual sports games cairo"
      ],
      ar: [
        "ماتشات رياضية",
        "تجمعات رياضية",
        "جروبات رياضية",
        "ناس تلعب رياضية"
      ],
      arColloquial: [
        "عاوز ناس ألعب معاهم",
        "عاوز ألعب رياضة",
        "ناس بتلعب رياضة في القاهرة",
        "عاوز ألعب مع ناس"
      ]
    },
    audience: "Players without a regular group",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo and Alexandria; location pages only where real inventory exists",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Primary B2C audience - highest priority for conversion"
  },
  {
    id: "volleyball-players",
    name: "Volleyball Players",
    nameAr: "لاعبين كرة الطائرة",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/sports/volleyball",
    keywords: {
      en: [
        "find volleyball players cairo",
        "volleyball games cairo",
        "join volleyball games egypt",
        "volleyball partners cairo",
        "volleyball groups cairo",
        "volleyball for adults cairo"
      ],
      ar: [
        "ماتشات كرة طائرة",
        "جروبات كرة طائرة",
        "تجمعات كرة طائرة",
        "لاعبين كرة طائرة"
      ],
      arColloquial: [
        "عاوز ألعب طائرة",
        "ناس تلعب طائرة",
        "ماتشات طائرة في القاهرة",
        "ماتشات طائرة في التجمع الخامس"
      ]
    },
    audience: "Adult players looking for volleyball groups",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo (guides cover New Cairo/Tagamoa where inventory exists)",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Support /guides/volleyball-cairo and /play/volleyball-new-cairo; adult training covered by /guides/start-volleyball-adult"
  },
  {
    id: "beach-volleyball-players",
    name: "Beach Volleyball Players",
    nameAr: "لاعبين الكرة الطائرة الشاطئية",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/sports/beach-volleyball",
    keywords: {
      en: [
        "beach volleyball games cairo",
        "beach volleyball partners cairo",
        "join beach volleyball games egypt",
        "beach volleyball for beginners cairo"
      ],
      ar: [
        "كرة طائرة شاطئية",
        "ماتشات طائرة شاطئية"
      ],
      arColloquial: [
        "بيتس فولى",
        "ماتشات بيتس فولى",
        "ناس تلعب بيتس فولى",
        "طائرة شاطئية في التجمع",
        "تجمعات بيتس فولى"
      ]
    },
    audience: "Players looking for sand-court games",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo (New Cairo sand courts where published)",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Growing popularity, less competition; guides + New Cairo local page cover the intent"
  },
  {
    id: "basketball-players",
    name: "Basketball Players",
    nameAr: "لاعبين كرة السلة",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/sports/basketball",
    keywords: {
      en: [
        "find basketball players cairo",
        "basketball pickup games cairo",
        "join basketball games cairo",
        "basketball partners cairo",
        "basketball for adults cairo"
      ],
      ar: [
        "كرة سلة",
        "ماتشات كرة سلة",
        "جروبات كرة سلة",
        "تجمعات كرة سلة",
        "تجمعات باسكت"
      ],
      arColloquial: [
        "عاوز ألعب باسكت",
        "ناس تلعب باسكت",
        "ماتشات باسكت",
        "باسكت في التجمع الخامس"
      ]
    },
    audience: "Adult pickup basketball players",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Now supported by /guides/basketball-cairo (pickup format, level and arrival guidance)"
  },
  {
    id: "padel-players",
    name: "Padel Players",
    nameAr: "لاعبين البادل",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/sports/padel",
    keywords: {
      en: [
        "find padel partners cairo",
        "padel games cairo",
        "join padel games egypt",
        "padel players new cairo",
        "padel for beginners cairo"
      ],
      ar: [
        "بادل",
        "ماتشات بادل",
        "جروبات بادل",
        "تجمعات بادل",
        "شريك بادل"
      ],
      arColloquial: [
        "عاوز ألعب بادل",
        "ناس تلعب بادل",
        "ماتشات بادل في القاهرة",
        "لاعبين بادل في التجمع"
      ]
    },
    audience: "Doubles padel players seeking partners",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo and New Cairo",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Now supported by /guides/padel-cairo (2-on-2 partner mechanics) and /guides/padel-training-for-beginners"
  },
  {
    id: "tennis-players",
    name: "Tennis Players",
    nameAr: "لاعبين التنس",
    intent: "player-find-games",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/sports/tennis",
    keywords: {
      en: [
        "find tennis partners cairo",
        "tennis games cairo",
        "join tennis games egypt",
        "tennis partners egypt",
        "tennis for adults cairo",
        "tennis groups cairo"
      ],
      ar: [
        "تنس",
        "ماتشات تنس",
        "جروبات تنس",
        "تجمعات تنس",
        "شريك تنس",
        "لاعبين تنس"
      ],
      arColloquial: [
        "عاوز ألعب تنس",
        "ناس تلعب تنس",
        "لاعبين تنس في القاهرة"
      ]
    },
    audience: "Tennis players seeking partners and matches",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Game registration (signup → join)",
    pageStatus: "improved-in-phase4",
    notes: "Now supported by /guides/tennis-cairo (partner matching vs lessons distinction)"
  },
  {
    id: "sports-academies",
    name: "Sports Academies",
    nameAr: "الأكاديميات الرياضية",
    intent: "academy-discovery",
    priority: 2,
    conversionPotential: "high",
    primaryPage: "/academies",
    keywords: {
      en: [
        "sports academies cairo",
        "sports academies new cairo",
        "volleyball academy cairo",
        "basketball academy cairo",
        "tennis academy cairo",
        "padel academy cairo",
        "sports training cairo"
      ],
      ar: [
        "أكاديميات رياضية",
        "أكاديمية كرة طائرة",
        "أكاديمية كرة سلة",
        "أكاديمية تنس",
        "أكاديمية بادل",
        "تدريب رياضي"
      ],
      arColloquial: [
        "أكاديميات رياضية في التجمع",
        "أكاديمية باسكت للأطفال",
        "تدريب كرة طائرة للكبار",
        "تدريب باسكت للكبار",
        "تدريب تنس للكبار",
        "تدريب بادل للمبتدئين"
      ]
    },
    audience: "Parents choosing academies for children; adults seeking coaching",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo; /a/<slug> pages index only public academies with real published data",
    conversionGoal: "Academy enquiry/join (trial enquiry or join)",
    pageStatus: "improved-in-phase4",
    notes: "Directory now links the three academy guides; only verified profile data is displayed"
  },
  {
    id: "venue-owners-b2b",
    name: "Sports Venue Owners (B2B)",
    nameAr: "أصحاب الملاعب (عملاء تجاريين)",
    intent: "venue-owner-b2b",
    priority: 2,
    conversionPotential: "high",
    primaryPage: "/list-your-court",
    keywords: {
      en: [
        "list sports court free egypt",
        "sports court listing platform egypt",
        "sports venue booking management",
        "court booking software egypt"
      ],
      ar: [
        "إضافة ملعب",
        "تسجيل ملعب للإيجار",
        "إدارة حجوزات الملاعب",
        "برنامج إدارة ملاعب",
        "نظام حجز ملاعب"
      ],
      arColloquial: [
        "تسويق ملعب رياضي",
        "تسويق ملعب بادل",
        "إضافة ملعب مجانًا"
      ]
    },
    audience: "Court and venue owners",
    languages: ["en", "ar"],
    geographicRelevance: "Egypt nationwide",
    conversionGoal: "Venue owner signup",
    pageStatus: "improved-in-phase4",
    notes: "Claims limited to free listing and no commission; cross-linked with academy management in Phase 4"
  },
  {
    id: "academy-owners-b2b",
    name: "Academy Owners (B2B)",
    nameAr: "أصحاب الأكاديميات (عملاء تجاريين)",
    intent: "academy-owner-b2b",
    priority: 2,
    conversionPotential: "high",
    primaryPage: "/academy-management",
    keywords: {
      en: [
        "sports academy management software egypt",
        "academy attendance management system",
        "sports academy subscription software",
        "academy scheduling software"
      ],
      ar: [
        "برنامج إدارة أكاديمية رياضية",
        "نظام إدارة أكاديميات",
        "إدارة اشتراكات الأكاديميات",
        "برنامج حضور وغياب الأكاديميات",
        "برنامج إدارة تدريبات",
        "نظام تسجيل طلاب الأكاديمية"
      ],
      arColloquial: []
    },
    audience: "Academy owners, managers and coaches",
    languages: ["en", "ar"],
    geographicRelevance: "Egypt nationwide",
    conversionGoal: "Academy owner signup",
    pageStatus: "improved-in-phase4",
    notes: "Existing features only; cross-linked with venue listing in Phase 4"
  }
];

/* ---------------- Guide clusters (Phase 4 new content) ---------------- */

export const GUIDE_KEYWORD_CLUSTERS: KeywordCluster[] = [
  {
    id: "guide-basketball-cairo",
    name: "How to Find Basketball Games and Players in Cairo",
    nameAr: "عاوز تلعب باسكت ومش لاقي ناس؟",
    intent: "educational",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/guides/basketball-cairo",
    keywords: {
      en: ["basketball pickup games cairo", "find basketball players", "basketball groups cairo"],
      ar: ["ماتشات كرة سلة", "تجمعات باسكت"],
      arColloquial: ["عاوز تلعب باسكت ومش لاقي ناس", "ناس تلعب باسكت", "تجمعات باسكت"]
    },
    audience: "Pickup basketball players who play without a fixed group",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Signup → join a basketball game",
    pageStatus: "new-in-phase4",
    notes: "No prior guide covered non-volleyball sports; this is the first basketball article — no duplicate intent"
  },
  {
    id: "guide-padel-cairo",
    name: "How to Find Padel Partners in Cairo",
    nameAr: "بتدور على شريك بادل؟",
    intent: "educational",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/guides/padel-cairo",
    keywords: {
      en: ["find padel partners cairo", "padel partners egypt", "padel groups cairo"],
      ar: ["شريك بادل", "تجمعات بادل"],
      arColloquial: ["بتدور على شريك بادل", "شريك بادل", "تجمعات بادل"]
    },
    audience: "Padel players needing a doubles partner",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Signup → join a padel game",
    pageStatus: "new-in-phase4",
    notes: "Distinct from the beginner-training guide (this one targets organized play)"
  },
  {
    id: "guide-tennis-cairo",
    name: "How to Find Tennis Partners in Cairo",
    nameAr: "عاوز تلعب تنس ومش لاقي حد؟",
    intent: "educational",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/guides/tennis-cairo",
    keywords: {
      en: ["tennis partners cairo", "find tennis players", "tennis groups cairo"],
      ar: ["شريك تنس", "ناس تلعب تنس"],
      arColloquial: ["عاوز تلعب تنس ومش لاقي حد", "شريك تنس", "ناس تلعب تنس"]
    },
    audience: "Tennis players seeking matches and partners",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Signup → join a tennis game",
    pageStatus: "new-in-phase4",
    notes: "Explicitly separates partner/played matches from coached lessons to avoid intent collision with academies"
  },
  {
    id: "guide-choose-academy-child",
    name: "How to Choose a Sports Academy for Your Child",
    nameAr: "إزاي تختار أكاديمية رياضية مناسبة لطفلك؟",
    intent: "academy-discovery",
    priority: 1,
    conversionPotential: "high",
    primaryPage: "/guides/choose-sports-academy-child",
    keywords: {
      en: ["sports academy for kids cairo", "basketball academy for kids", "volleyball academy for kids"],
      ar: [        "أكاديمية طائرة للأطفال", "أكاديميات رياضية للأطفال"],
      arColloquial: ["أكاديمية رياضية لطفلي", "أكاديميات في التجمع للأطفال"]
    },
    audience: "Parents evaluating academies",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo and greater Egypt",
    conversionGoal: "Trial enquiry → academy join",
    pageStatus: "new-in-phase4",
    notes: "Links to /academies directory and real academy pages; no rankings claimed"
  },
  {
    id: "guide-start-volleyball-adult",
    name: "How to Start Volleyball Training as an Adult",
    nameAr: "إزاي تبدأ تدريب طايرة وأنت كبير؟",
    intent: "academy-discovery",
    priority: 2,
    conversionPotential: "medium",
    primaryPage: "/guides/start-volleyball-adult",
    keywords: {
      en: ["volleyball training for adults cairo", "beginner volleyball training egypt"],
      ar: ["تدريب كرة طائرة للكبار"],
      arColloquial: ["تدريب طايرة للكبار", "أتعلم طايرة وأنا كبير"]
    },
    audience: "Adults starting volleyball without school experience",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Academy enquiry or game join",
    pageStatus: "new-in-phase4",
    notes: "Bridges academy coaching and friendly games; no duplicate of /guides/volleyball-cairo (finding courts/games)"
  },
  {
    id: "guide-padel-beginner-training",
    name: "How to Find Beginner Padel Training",
    nameAr: "إزاي تختار تدريب بادل للمبتدئين؟",
    intent: "academy-discovery",
    priority: 2,
    conversionPotential: "medium",
    primaryPage: "/guides/padel-training-for-beginners",
    keywords: {
      en: ["padel lessons cairo", "padel lessons egypt", "beginner padel training"],
      ar: ["تدريب بادل"],
      arColloquial: ["تدريب بادل للمبتدئين", "دروس بادل"]
    },
    audience: "Adults and teens starting padel",
    languages: ["en", "ar"],
    geographicRelevance: "Cairo",
    conversionGoal: "Trial enquiry → academy join",
    pageStatus: "new-in-phase4",
    notes: "Distinct intent from /guides/padel-cairo (finding partners/games)"
  }
];

/**
 * Page-to-keyword mapping for optimization
 */
export const PAGE_KEYWORD_MAPPING: Record<string, {
  primaryCluster: string;
  primaryKeywordEn: string;
  primaryKeywordAr: string;
  secondaryKeywordsEn: string[];
  secondaryKeywordsAr: string[];
}> = {

  "/": {
    primaryCluster: "players-find-games",
    primaryKeywordEn: "Find people to play sports with Egypt",
    primaryKeywordAr: "عاوز ناس ألعب معاهم",
    secondaryKeywordsEn: ["join sports games Cairo", "sports partners Egypt"],
    secondaryKeywordsAr: ["ماتشات رياضية مصر", "جروبات رياضية القاهرة"]
  },
  "/games": {
    primaryCluster: "players-find-games",
    primaryKeywordEn: "Find sports games to join in Egypt",
    primaryKeywordAr: "ماتشات رياضية للانضمام مصر",
    secondaryKeywordsEn: ["join volleyball games Cairo", "basketball games Cairo"],
    secondaryKeywordsAr: ["ماتشات طائرة", "ماتشات باسكت", "ماتشات بادل"]
  },
  "/sports/volleyball": {
    primaryCluster: "volleyball-players",
    primaryKeywordEn: "Find volleyball players and games in Cairo",
    primaryKeywordAr: "ماتشات كرة طائرة في القاهرة",
    secondaryKeywordsEn: ["volleyball partners Cairo", "join volleyball games"],
    secondaryKeywordsAr: ["ناس تلعب طائرة", "شريك طائرة"]
  },
  "/sports/beach-volleyball": {
    primaryCluster: "beach-volleyball-players",
    primaryKeywordEn: "Find beach volleyball games and players in Cairo",
    primaryKeywordAr: "ماتشات طائرة شاطئية في القاهرة",
    secondaryKeywordsEn: ["beach volleyball partners", "beach volleyball games"],
    secondaryKeywordsAr: ["بيتس فولى", "ناس تلعب بيتس فولى"]
  },
  "/sports/basketball": {
    primaryCluster: "basketball-players",
    primaryKeywordEn: "Find basketball players and pickup games in Cairo",
    primaryKeywordAr: "ماتشات كرة سلة في القاهرة",
    secondaryKeywordsEn: ["basketball partners Cairo", "pickup basketball games"],
    secondaryKeywordsAr: ["ناس تلعب باسكت", "شريك باسكت"]
  },
  "/sports/padel": {
    primaryCluster: "padel-players",
    primaryKeywordEn: "Find padel partners and games in Cairo",
    primaryKeywordAr: "ماتشات بادل في القاهرة",
    secondaryKeywordsEn: ["padel partners Egypt", "join padel games"],
    secondaryKeywordsAr: ["شريك بادل", "ناس تلعب بادل"]
  },
  "/sports/tennis": {
    primaryCluster: "tennis-players",
    primaryKeywordEn: "Find tennis partners and games in Cairo",
    primaryKeywordAr: "ماتشات تنس في القاهرة",
    secondaryKeywordsEn: ["tennis partners Egypt", "tennis games"],
    secondaryKeywordsAr: ["شريك تنس", "ناس تلعب تنس"]
  },
  "/academies": {
    primaryCluster: "sports-academies",
    primaryKeywordEn: "Find sports academies and training in Egypt",
    primaryKeywordAr: "أكاديميات رياضية في مصر",
    secondaryKeywordsEn: ["volleyball academy Cairo", "basketball academy Cairo"],
    secondaryKeywordsAr: ["أكاديمية كرة طائرة", "أكاديمية كرة سلة"]
  },
  "/list-your-court": {
    primaryCluster: "venue-owners-b2b",
    primaryKeywordEn: "List your sports court for free in Egypt",
    primaryKeywordAr: "ضيف ملعبك مجانًا",
    secondaryKeywordsEn: ["no commission court listing", "sports venue management"],
    secondaryKeywordsAr: ["تسجيل ملعب مجانًا", "بدون عمولة"]
  },
  "/academy-management": {
    primaryCluster: "academy-owners-b2b",
    primaryKeywordEn: "Sports academy management software Egypt",
    primaryKeywordAr: "برنامج إدارة أكاديمية رياضية",
    secondaryKeywordsEn: ["academy attendance", "subscription management"],
    secondaryKeywordsAr: ["إدارة اشتراكات الأكاديمية", "حضور وغياب"]
  }
};

// Guide URLs (Phase 4)
for (const cluster of GUIDE_KEYWORD_CLUSTERS) {
  PAGE_KEYWORD_MAPPING[cluster.primaryPage] = {
    primaryCluster: cluster.id,
    primaryKeywordEn: cluster.name,
    primaryKeywordAr: cluster.nameAr,
    secondaryKeywordsEn: cluster.keywords.en,
    secondaryKeywordsAr: [...cluster.keywords.ar, ...(cluster.keywords.arColloquial ?? [])],
  };
}

/**
 * Local SEO targets based on actual activity. Location landing pages are only
 * produced at /courts/<sport>/<location> when the public court directory has
 * real inventory for that sport+location combination; city game guides
 * (/play/*) are editorial and follow the verified public game inventory.
 */
export const LOCAL_SEO_TARGETS = [
  "New Cairo", "Fifth Settlement", "Nasr City", "Heliopolis",
  "Maadi", "6th of October", "Sheikh Zayed", "Alexandria"
];

export const LOCAL_SEO_TARGETS_AR = [
  "التجمع الخامس", "مدينة نصر", "مصر الجديدة", "المعادي",
  "6 أكتوبر", "الشيخ زايد", "الإسكندرية"
];
