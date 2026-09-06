const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "a",
  آ: "a",
  ٱ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "a",
  ء: "",
  ئ: "y",
  ؤ: "w",
};

function transposeArabic(input: string): string {
  let out = "";
  for (const ch of input) {
    const mapped = ARABIC_TO_LATIN[ch];
    if (mapped !== undefined) out += mapped;
    else if (/[a-z0-9]/.test(ch)) out += ch;
  }
  return out;
}

/**
 * Normalizes a bilingual search string for fuzzy matching:
 * lowercases, strips Arabic diacritics & hamza variants, removes
 * punctuation and transliterates Arabic letters to their Latin
 * equivalents (e.g. "نصر" → "nsr").
 */
export function normalizeSearch(input: string): string {
  return transposeArabic(
    input
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[\s\-_.,/()'"·]+/g, "")
  );
}

/**
 * Returns true when `query` matches `haystack` in either Arabic or Latin.
 * Vowel-stripping makes "nasr" match "نصر" and vice versa.
 */
export function matchesBilingual(haystack: string, query: string): boolean {
  const h = normalizeSearch(haystack);
  const q = normalizeSearch(query);
  if (!q) return true;
  if (h.includes(q)) return true;
  const hV = h.replace(/[aeiou]/g, "");
  const qV = q.replace(/[aeiou]/g, "");
  return hV.includes(qV) && qV.length >= 2;
}