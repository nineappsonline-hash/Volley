export const COURT_REVIEW_FIELDS = {
  name: { en: "Court name", ar: "اسم الملعب", columns: ["name"] },
  photos: { en: "Court photos", ar: "صور الملعب", columns: ["photos", "cover_url"] },
  sport: { en: "Sport", ar: "الرياضة", columns: ["sport_id"] },
  address: { en: "Full address", ar: "العنوان التفصيلي", columns: ["address"] },
  location: { en: "Country, governorate and city", ar: "الدولة والمحافظة والمدينة", columns: ["country", "governorate", "area"] },
  directions: { en: "Map / directions link", ar: "رابط الموقع على الخريطة", columns: ["location_link"] },
  phone: { en: "Contact phone", ar: "رقم التواصل", columns: ["contact_phone"] },
  price: { en: "Rental price and duration", ar: "سعر ومدة الإيجار", columns: ["rental_cost", "rental_hours"] },
  courts: { en: "Number of courts", ar: "عدد الملاعب", columns: ["court_count"] },
  capacity: { en: "Player capacity", ar: "سعة اللاعبين", columns: ["capacity"] },
  hours: { en: "Court working hours", ar: "مواعيد عمل الملاعب", columns: ["court_availability", "working_hours"] },
} as const;
export type CourtReviewField = keyof typeof COURT_REVIEW_FIELDS;
export function courtReviewFields(fields: readonly string[] | null | undefined): CourtReviewField[] {
  return [...new Set(fields ?? [])].filter((key): key is CourtReviewField => Object.prototype.hasOwnProperty.call(COURT_REVIEW_FIELDS, key));
}
