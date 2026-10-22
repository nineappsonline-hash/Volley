import { createAdminClient } from "@/lib/supabase/admin";

export type PublicSportAcademy = { name: string; slug: string; area: string | null; governorate: string | null; description: string | null };

/**
 * Crawlable index of every public academy for the /academies directory page.
 * The directory itself is an interactive client component, so this server
 * fetcher supplies real academy names + /a/<slug> links in the initial HTML
 * that search crawlers can follow without running JavaScript.
 */
export async function getPublicAcademyIndex(): Promise<PublicSportAcademy[]> {
  try {
    const { data, error } = await createAdminClient().from("academies")
      .select("name, slug, area, governorate, description")
      .eq("is_public", true)
      .not("slug", "is", null)
      .order("name")
      .limit(200);
    if (error) return [];
    return (data ?? [])
      .filter(a => a.slug?.trim())
      .map(a => ({ name: a.name, slug: a.slug, area: a.area, governorate: a.governorate, description: a.description ?? null }));
  } catch {
    return [];
  }
}

/** Public academy cards only; no member, contact or subscription data. */
export async function getCairoSportAcademies(sport: string): Promise<PublicSportAcademy[]> {
  try {
    const { data, error } = await createAdminClient().from("academies")
      .select("name, slug, area, governorate, description, sports!inner(name)")
      .eq("is_public", true)
      .not("slug", "is", null)
      .in("governorate", ["Cairo", "القاهرة"])
      .eq("sports.name", sport)
      .order("name")
      .limit(12);
    if (error) return [];
    return (data ?? []).filter(a => a.slug?.trim()).map(a => ({ name: a.name, slug: a.slug, area: a.area, governorate: a.governorate, description: a.description ?? null }));
  } catch {
    return [];
  }
}
