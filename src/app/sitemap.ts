import { LOCAL_GAME_GUIDES, localGamePath } from "@/lib/local-games";
import { publicGamePath } from "@/lib/game-discovery";
import { VOLLEYBALL_GUIDES, guidePath } from "@/lib/volleyball-guides";
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { getPublicGameIds, getPublicGameSports, getPublicTournamentSports } from "@/lib/public-games";
import { DISCOVERY_SPORTS, discoveryPath } from "@/lib/sport-discovery";
import { sportToSlug } from "@/lib/sport-slugs";

export const revalidate = 3600; // refresh at most hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/book-courts`, changeFrequency: "weekly", priority: 0.9 },
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
      url: `${SITE_URL}/games/beach-volleyball`,
      changeFrequency: "weekly",
      priority: 0.8,
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

  for (const slug of [undefined, ...DISCOVERY_SPORTS.map(sport => sport.slug)]) {
    for (const lang of ["en", "ar"] as const) {
      staticPages.push({
        url: `${SITE_URL}${discoveryPath(lang, slug)}`,
        changeFrequency: "weekly",
        priority: slug ? 0.8 : 0.9,
        alternates: { languages: {
          en: `${SITE_URL}${discoveryPath("en", slug)}`,
          "ar-EG": `${SITE_URL}${discoveryPath("ar", slug)}`,
          "x-default": `${SITE_URL}${discoveryPath("en", slug)}`,
        } },
      });
    }
  }

  for (const sport of [undefined, "volleyball", "beach-volleyball"]) {
    const suffix = sport ? `?sport=${sport}` : "";
    for (const lang of ["en", "ar"]) staticPages.push({
      url: `${SITE_URL}${lang === "ar" ? "/ar" : ""}/courts${suffix}`,
      changeFrequency: "weekly", priority: 0.8,
      alternates: { languages: { en: `${SITE_URL}/courts${suffix}`, "ar-EG": `${SITE_URL}/ar/courts${suffix}`, "x-default": `${SITE_URL}/courts${suffix}` } },
    });
  }

  for (const lang of ["en", "ar"]) staticPages.push({
    url: `${SITE_URL}${lang === "ar" ? "/ar" : ""}/academy-management`,
    changeFrequency: "monthly", priority: 0.9,
    alternates: { languages: { en: `${SITE_URL}/academy-management`, "ar-EG": `${SITE_URL}/ar/academy-management`, "x-default": `${SITE_URL}/academy-management` } },
  });

  for (const slug of [undefined, ...VOLLEYBALL_GUIDES.map(g => g.slug)]) {
    for (const lang of ["en", "ar"] as const) staticPages.push({ url: `${SITE_URL}${guidePath(lang, slug)}`, changeFrequency: "monthly", priority: 0.8, alternates: { languages: { en: `${SITE_URL}${guidePath("en", slug)}`, "ar-EG": `${SITE_URL}${guidePath("ar", slug)}` } } });
  }
  for (const guide of LOCAL_GAME_GUIDES) {
    for (const lang of ["en", "ar"] as const) staticPages.push({
      url: `${SITE_URL}${localGamePath(lang, guide.slug)}`, changeFrequency: "daily", priority: 0.8,
      alternates: { languages: { en: `${SITE_URL}${localGamePath("en", guide.slug)}`, "ar-EG": `${SITE_URL}${localGamePath("ar", guide.slug)}`, "x-default": `${SITE_URL}${localGamePath("en", guide.slug)}` } },
    });
  }
  // Query independently so a failed source does not remove other public pages.
  const results = await Promise.allSettled([
    academyEntries(),
    playgroundEntries(),
    getPublicGameSports(),
    getPublicTournamentSports(),
    getPublicGameIds(),
  ]);
  const academyPages = results[0].status === "fulfilled" ? results[0].value : [];
  const playgroundPages = results[1].status === "fulfilled" ? results[1].value : [];
  const gameSports = results[2].status === "fulfilled" ? results[2].value : [];
  const tournamentSports = results[3].status === "fulfilled" ? results[3].value : [];
  const gamePages: MetadataRoute.Sitemap = (results[4].status === "fulfilled" ? results[4].value : []).map(id => ({ url: `${SITE_URL}${publicGamePath(id)}`, changeFrequency: "daily", priority: 0.8 }));
  const sportPages: MetadataRoute.Sitemap = [
    ...gameSports.map(sport => `/games?sport=${encodeURIComponent(sportToSlug(sport))}`),
    ...tournamentSports.map(sport => `/tournaments?sport=${encodeURIComponent(sportToSlug(sport))}`),
  ].map(path => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily", priority: 0.7 }));

  // Avoid duplicate URLs when sports use equivalent spellings or slugs.
  return [...new Map([...staticPages, ...academyPages, ...playgroundPages, ...sportPages, ...gamePages].map(page => [page.url, page])).values()];
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

async function playgroundEntries(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();
  const pages: MetadataRoute.Sitemap = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await admin.from("venues")
      .select("id")
      .eq("approval_status", "approved")
      .order("id")
      .range(offset, offset + batchSize - 1);
    // Keep completed batches if a later request fails.
    if (error) break;
    for (const venue of data ?? []) {
      if (venue.id) pages.push({
        url: `${SITE_URL}/p/${encodeURIComponent(venue.id)}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    if (!data || data.length < batchSize) break;
  }
  return pages;
}
