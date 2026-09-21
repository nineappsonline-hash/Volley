import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// App/auth surfaces that should never be indexed. Kept identical for every
// crawler: a named user-agent section overrides the wildcard section, so each
// AI bot must repeat these disallows itself or it would inherit a blanket allow.
const APP_DISALLOW = [
  "/dashboard/",
  "/api/",
  "/receipts/",
  "/login",
  "/signup",
  "/auth/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // General web crawlers.
      {
        userAgent: "*",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // ── AI / LLM discovery ─────────────────────────────────────────────
      // ChatGPT search results, links and citations.
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // OpenAI model training + legacy GPTBot traversal.
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // User-triggered fetches when someone asks ChatGPT to read the site.
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // Anthropic / Claude (training, search and user-initiated).
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "Claude-User",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "Claude-SearchBot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "anthropic-ai",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // Perplexity search. Bing/Copilot discovery uses the wildcard rule.
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "Perplexity-User",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // Gemini training and grounding; Google Search uses Googlebot via the wildcard rule.
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      // Community / aggregator LLM crawlers.
      {
        userAgent: "ccbot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "cohere-ai",
        allow: "/",
        disallow: APP_DISALLOW,
      },
      {
        userAgent: "Applebot",
        allow: "/",
        disallow: APP_DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}