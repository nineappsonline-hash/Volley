/** Normalize Arabic/Persian digits and whitespace without changing stored data. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? "").normalize("NFKC")
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .toLowerCase().trim().replace(/\s+/g, " ");
}

export function matchesAdminSearch(query: string, fields: unknown[], phones: unknown[] = []): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  // Phone searches ignore visual formatting, but preserve all entered digits.
  if (/^[+\d\s().-]+$/.test(normalized) && /\d/.test(normalized)) {
    const digits = normalized.replace(/\D/g, "");
    if (phones.some(phone => normalizeSearch(phone).replace(/\D/g, "").includes(digits))) return true;
  }
  const values = fields.map(normalizeSearch);
  return normalized.split(" ").every(term => values.some(value => value.includes(term)));
}
