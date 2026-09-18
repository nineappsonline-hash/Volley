import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { getPublicGameSports, getPublicTournamentSports } from "@/lib/public-games";
import { sportToSlug } from "@/lib/sport-slugs";

export const revalidate = 3600; // refresh at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/solutions`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/academies`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/solutions/football`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/volleyball`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/basketball`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/padel`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/solutions/swimming`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/games`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tournaments`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/faq`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Query independently so a failed source does not remove other public pages.
  const results = await Promise.allSettled([
    academyEntries(),
    getPublicGameSports(),
    getPublicTournamentSports(),
  ]);
  const academyPages = results[0].status === "fulfilled" ? results[0].value : [];
  const gameSports = results[1].status === "fulfilled" ? results[1].value : [];
  const tournamentSports = results[2].status === "fulfilled" ? results[2].value : [];
  const sportPages: MetadataRoute.Sitemap = [
    ...gameSports.map(sport => `/games?sport=${encodeURIComponent(sportToSlug(sport))}`),
    ...tournamentSports.map(sport => `/tournaments?sport=${encodeURIComponent(sportToSlug(sport))}`),
  ].map(path => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily", priority: 0.7 }));

  // Avoid duplicate URLs when sports use equivalent spellings or slugs.
  return [...new Map([...staticPages, ...academyPages, ...sportPages].map(page => [page.url, page])).values()];
}

async function academyEntries(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();
  const pages: MetadataRoute.Sitemap = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await admin.from("academies")
      .select("id, slug")
      .eq("is_public", true)
      .not("slug", "is", null)
      .order("id")
      .range(offset, offset + batchSize - 1);
    // Keep completed batches if a later request fails.
    if (error) break;
    for (const academy of data ?? []) {
      if (academy.slug?.trim()) pages.push({
        url: `${SITE_URL}/a/${encodeURIComponent(academy.slug)}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    if (!data || data.length < batchSize) break;
  }
  return pages;
}
