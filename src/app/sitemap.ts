import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { getPublicGameSports, getPublicTournamentSports } from "@/lib/public-games";
import { sportToSlug } from "@/lib/sport-slugs";

export const revalidate = 3600; // refresh at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/solutions`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/academies`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/solutions/football`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/volleyball`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/basketball`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/padel`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/swimming`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/games`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tournaments`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Public academy profiles are the highest-value local pages
  // ("أكاديمية كرة قدم في القاهرة" style queries).
  try {
    const admin = createAdminClient();
    const { data: academies } = await admin
      .from("academies")
      .select("slug, created_at")
      .eq("is_public", true)
      .not("slug", "is", null);

    const academyPages: MetadataRoute.Sitemap = (academies ?? []).map((a) => ({
      url: `${SITE_URL}/a/${a.slug}`,
      lastModified: a.created_at ? new Date(a.created_at) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    // Sport-filtered listing variants (e.g. /games?sport=football) are
    // indexable landing pages for "ماتشات بادل" style queries.
    const [gameSports, tournamentSports] = await Promise.all([
      getPublicGameSports(),
      getPublicTournamentSports(),
    ]);
    const gamePages: MetadataRoute.Sitemap = gameSports.map((s) => ({
      url: `${SITE_URL}/games?sport=${sportToSlug(s)}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }));
    const tournamentPages: MetadataRoute.Sitemap = tournamentSports.map((s) => ({
      url: `${SITE_URL}/tournaments?sport=${sportToSlug(s)}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...staticPages, ...academyPages, ...gamePages, ...tournamentPages];
  } catch {
    // If the database is unreachable at build/runtime, still ship the static
    // pages rather than failing the whole sitemap.
    return staticPages;
  }
}
