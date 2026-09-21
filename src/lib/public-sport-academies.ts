import { createAdminClient } from "@/lib/supabase/admin";

export type PublicSportAcademy = { name: string; slug: string; area: string | null; governorate: string | null };

/** Public academy cards only; no member, contact or subscription data. */
export async function getCairoSportAcademies(sport: string): Promise<PublicSportAcademy[]> {
  try {
    const { data, error } = await createAdminClient().from("academies")
      .select("name, slug, area, governorate, sports!inner(name)")
      .eq("is_public", true)
      .not("slug", "is", null)
      .in("governorate", ["Cairo", "القاهرة"])
      .eq("sports.name", sport)
      .order("name")
      .limit(12);
    if (error) return [];
    return (data ?? []).filter(a => a.slug?.trim()).map(a => ({ name: a.name, slug: a.slug, area: a.area, governorate: a.governorate }));
  } catch {
    return [];
  }
}
