/**
 * Playza SEO keyword mapping based on actual business model.
 * 
 * Primary positioning: "Find people to play sports with, join games & discover sports academies in Egypt"
 * 
 * Scoring is qualitative (search intent × relevance × conversion potential), not verified Google volumes.
 * All data labeled as estimated per requirements.
 */

export type KeywordIntent = 
  | "player-find-games"      // Find people to play with / join games (PRIMARY)
  | "academy-discovery"      // Find sports academies/training
  | "venue-owner-b2b"        // Venue owners listing facilities
  | "academy-owner-b2b"      // Academy owners needing management software
  | "local-discovery"        // Location-based searches
  | "educational";           // How-to guides

export type KeywordCluster = {
  id: string;
  name: string;
  nameAr: string;
  intent: KeywordIntent;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  conversionPotential: "high" | "medium" | "low"; // estimated
  primaryPage: string;
  keywords: {
    en: string[];
    ar: string[];
    arColloquial?: string[]; // Egyptian Arabic
  };
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
    notes: "Strong demand in Egypt"
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
        "ماتشات بيتش فولى",
        "ناس تلعب بيتش فولى",
        "طائرة شاطئية في التجمع"
      ]
    },
    notes: "Growing popularity, less competition"
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
        "تجمعات كرة سلة"
      ],
      arColloquial: [
        "عاوز ألعب باسكت",
        "ناس تلعب باسكت",
        "ماتشات باسكت",
        "باسكت في التجمع الخامس"
      ]
    },
    notes: "Strong youth and adult demand"
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
    notes: "High growth, court density increasing"
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
        "tennis for adults cairo"
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
    notes: "Established demand"
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
    notes: "Strong for parents and adults wanting to learn"
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
        "تسويق ملعب بادل"
      ]
    },
    notes: "B2B - Free listing, no commission (key selling points)"
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
    notes: "B2B - Management software focus"
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
    secondaryKeywordsAr: ["بيتس فولى", "ناس تلعب بيتش فولى"]
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

/**
 * Local SEO targets based on actual activity
 */
export const LOCAL_SEO_TARGETS = [
  "New Cairo", "Fifth Settlement", "Nasr City", "Heliopolis", 
  "Maadi", "6th of October", "Sheikh Zayed", "Alexandria"
];

export const LOCAL_SEO_TARGETS_AR = [
  "التجمع الخامس", "مدينة نصر", "مصر الجديدة", "المعادي", 
  "6 أكتوبر", "الشيخ زايد", "الإسكندرية"
];
