import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicTeamDirectoryEntry } from "@/lib/types";

export type PublicSportAcademy = { name: string; slug: string; area: string | null; governorate: string | null; description: string | null };

/**
 * Crawlable index of every public academy for the /academies directory page.
 * The directory itself is an interactive client component, so this server
 * fetcher supplies real academy names + /a/<slug> links in the initial HTML
 * that search crawlers can follow without running JavaScript.
 *
 * A successful query with zero rows returns an empty array (genuinely no
 * public academies). A failed query throws so the page surfaces an error
 * instead of silently emitting an empty, indexable SEO page.
 */
export async function getPublicAcademyIndex(): Promise<PublicSportAcademy[]> {
  const { data, error } = await createAdminClient()
    .from("academies")
    .select("name, slug, area, governorate, description")
    .eq("is_public", true)
    .not("slug", "is", null)
    .order("name")
    .limit(200);
  if (error) throw new Error(`academy index query failed: ${error.message}`);
  return (data ?? [])
    .filter(a => a.slug?.trim())
    .map(a => ({ name: a.name, slug: a.slug, area: a.area, governorate: a.governorate, description: a.description ?? null }));
}

/**
 * Public teams of public academies, including their training playground.
 * Uses the service-role client because teams are not readable anonymously;
 * only rows belonging to public academies are returned.
 */
export async function getPublicTeams(): Promise<PublicTeamDirectoryEntry[]> {
  type TeamRow = Omit<PublicTeamDirectoryEntry, "venue"> & {
    venue_id?: string | null;
    academy: PublicTeamDirectoryEntry["academy"] & { is_public?: boolean; slug?: string | null };
  };
  const client = createAdminClient();
  const [{ data, error }, { data: venues, error: venueError }] =
    await Promise.all([
      client
        .from("teams")
        .select(`
          *,
          sport:sports(id, name),
          academy:academies!inner(id, name, slug, logo_url, country, governorate, area, is_public)
        `)
        .order("name")
        .limit(500),
      client
        .from("venues")
        .select("id, name, address, country, governorate, area, location_link")
        .limit(2000),
    ]);
  if (error) throw new Error(`public team query failed: ${error.message}`);
  if (venueError) throw new Error(`public team venue query failed: ${venueError.message}`);

  const venueMap = new Map<string, NonNullable<PublicTeamDirectoryEntry["venue"]>>();
  for (const venue of (venues ?? []) as NonNullable<PublicTeamDirectoryEntry["venue"]>[]) {
    venueMap.set(venue.id, venue);
  }

  return ((data ?? []) as unknown as TeamRow[])
    .filter(
      (team) => !!team.academy?.slug
    )
    .map(({ venue_id, academy, sport, ...team }) => ({
      id: team.id,
      name: team.name,
      gender: team.gender,
      min_age: team.min_age,
      max_age: team.max_age,
      skill_level: team.skill_level,
      sport,
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug,
        logo_url: academy.logo_url,
        country: academy.country,
        governorate: academy.governorate,
        area: academy.area,
      },
      venue: venue_id ? venueMap.get(venue_id) ?? null : null,
    }));
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
