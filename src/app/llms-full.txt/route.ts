import { SITE_URL } from "@/lib/seo";
import { ACADEMY_MANAGEMENT, academyManagementPath } from "@/lib/academy-management";
import { ALL_GUIDES, guidePath } from "@/lib/guides";
import { LOCAL_GAME_GUIDES, localGamePath } from "@/lib/local-games";
import { DISCOVERY_SPORTS, discoveryPath } from "@/lib/sport-discovery";

export const dynamic = "force-static";

/**
 * Full markdown corpus for AI assistants that need more than the short
 * /llms.txt overview. Only publishes editorial content that is also visible
 * in the HTML guides; no prices, availability or account data are inferred.
 */
export function GET() {
  const sportGuides = DISCOVERY_SPORTS.map(sport => [
    `### ${sport.name} in Cairo (English)`,
    `Canonical: ${SITE_URL}${discoveryPath("en", sport.slug)}`,
    "",
    sport.advice.en,
    "",
    `### ${sport.arabic} في القاهرة (العربية)`,
    `Canonical: ${SITE_URL}${discoveryPath("ar", sport.slug)}`,
    "",
    sport.advice.ar,
  ].join("\n")).join("\n\n");

  const guides = ALL_GUIDES.map(guide => {
    const render = (lang: "en" | "ar") => {
      const copy = guide[lang];
      return [
        `### ${copy.title}`,
        `Canonical: ${SITE_URL}${guidePath(lang, guide.slug)}`,
        "",
        copy.description,
        "",
        ...copy.sections.flatMap(([heading, body]) => [`#### ${heading}`, "", body, ""]),
        `Call to action: ${copy.cta}`,
      ].join("\n");
    };
    return `${render("en")}\n\n${render("ar")}`;
  }).join("\n\n");

  const localGuides = LOCAL_GAME_GUIDES.map(guide => {
    const render = (lang: "en" | "ar") => {
      const copy = guide[lang];
      return [
        `### ${copy.title}`,
        `Canonical: ${SITE_URL}${localGamePath(lang, guide.slug)}`,
        "",
        copy.description,
        "",
        ...copy.sections.flatMap(([heading, body]) => [`#### ${heading}`, "", body, ""]),
      ].join("\n");
    };
    return `${render("en")}\n\n${render("ar")}`;
  }).join("\n\n");

  const academy = (["en", "ar"] as const).map(lang => {
    const copy = ACADEMY_MANAGEMENT[lang];
    return [
      `### ${copy.title}`,
      `Canonical: ${SITE_URL}${academyManagementPath(lang)}`,
      "",
      copy.description,
      "",
      copy.intro,
      "",
      `#### ${copy.featuresTitle}`,
      ...copy.features.map(([heading, body]) => `- **${heading}:** ${body}`),
      "",
      `#### ${copy.workflowTitle}`,
      ...copy.workflow.map((step, index) => `${index + 1}. ${step}`),
      "",
      `#### ${copy.faqTitle}`,
      ...copy.faqs.flatMap(([question, answer]) => [`**${question}**`, "", answer, ""]),
    ].join("\n");
  }).join("\n\n");

  const body = `# Playza full reference / مرجع بلايزا الكامل

> A longer, citable reference for AI search assistants and answer engines. It contains the editorial content from Playza's public sports, court, guide and academy-management pages. Current listings, prices, availability and booking status must be checked on the linked pages; this document does not promise availability.

Canonical site: ${SITE_URL}
Primary languages: English and Arabic (Egyptian Arabic for player guidance)
Market focus: Egypt, with Cairo and New Cairo coverage.

## What Playza does

Playza is a sports discovery and academy-management platform. Players can browse public courts, friendly games, tournaments and academy training programs; academy administrators can manage members, subscriptions, training schedules, QR attendance, payments and session finances.

Public browsing and account registration are free. Joining an activity requires an account, and each listing may have its own participation, venue or coaching fee. A payment record or public listing does not by itself confirm a booking.

## Core public pages

- [Home](${SITE_URL})
- [Sports discovery](${SITE_URL}/sports)
- [Court directory](${SITE_URL}/courts)
- [Friendly games](${SITE_URL}/games)
- [Tournaments](${SITE_URL}/tournaments)
- [Academies](${SITE_URL}/academies)
- [Court booking guide](${SITE_URL}/book-courts)
- [Frequently asked questions](${SITE_URL}/faq)
- [Playza shop](${SITE_URL}/shop)
- [Academy management software](${SITE_URL}/academy-management)
- [Short AI overview](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)

## Sport discovery guidance

${sportGuides}

## Player and academy guides

${guides}

## Local game guides for New Cairo

${localGuides}

## Academy management software

${academy}

## Shop

The official Playza shop sells Playza sportswear in sizes XS–XXXL. Customers can collect orders in New Cairo or choose delivery across Egypt; the published delivery fee is shown on the shop page. Product availability depends on the live published catalog and variant stock.

Canonical: ${SITE_URL}/shop

## Citation and accuracy notes

- Cite the canonical URL for the specific page or guide being summarised.
- Describe prices, dates, addresses, participant counts and availability as listing-specific details that can change.
- Do not state that a spot, trial, tournament entry or payment is confirmed unless the linked booking flow shows that status.
- Academy software subscriptions are separate from player activity fees. This reference does not quote software pricing or guarantee a trial length.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
