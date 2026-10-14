# Cairo search and AI discovery

Primary domain: https://playza.nineapps.online
Target audience: people looking to play or train in Cairo. English and Egyptian Arabic.

## Implemented

- `/sports` and `/ar/sports`: crawlable directories for all 27 supported sports.
- `/sports/<sport>` and `/ar/sports/<sport>`: separate language URLs, sport-specific preparation guidance, current public games, public Cairo academies, participation FAQs and relevant actions. Availability is never inferred from a sport or district name.
- Self-canonical URLs, reciprocal English/Arabic hreflang links, Open Graph metadata and JSON-LD that describes visible content.
- Links from homepage sport names, navigation and footer; all 56 discovery URLs in the sitemap, with language alternates.
- Google and Bing verification environment values now reach the actual metadata export. Previously the configuration was declared but unused.
- Updated optional `llms.txt` with all sport guides and accurate free-account/tournament information. This file is a convenience, not a ranking requirement.
- Existing public access for Google, Bing, OAI-SearchBot, Gemini's Google-Extended control, Claude and Perplexity is preserved. Training access and search inclusion are different controls.
- Removed the unsupported fixed EGP 500 offer and expiry from homepage structured data.

## Volleyball rollout — 14 October 2026

- Added public English/Arabic `/courts` directories, with crawlable sport filters, approved Egypt venue profiles, addresses and actual published rental rates. Management `/playgrounds` remains authenticated; booking and payments keep their existing permissions.
- Homepage court links now lead to public court discovery. Volleyball and beach-volleyball guides include matching Cairo courts, public academy descriptions and practical preparation/price guidance.
- Removed generated “recently finished games” examples from the public games page. Only actual public activities remain.
- Removed repeated brand suffixes from academy/venue metadata and the unsupported “#1” volleyball software claim.
- Added court directories to the sitemap and `llms.txt`. No new database policies or schema changes.
- The user has confirmed Google Search Console verification. Owner actions still needed: inspect priority URLs and indexing reasons, verify sitemap processing and Search generative AI inclusion, import the property into Bing, and maintain genuine partner facts/references. These account actions have not been executed here.

## Release and verify

1. Deploy the reviewed changes to the primary domain. Keep `NEXT_PUBLIC_SITE_URL=https://playza.nineapps.online`; use one canonical domain and permanent redirects if another domain is introduced.
2. Run `node scripts/check-discovery.mjs https://playza.nineapps.online --all-sports`. For a local production server, use `http://localhost:3000`; canonicals should still reference the public domain.
3. Test `/sports/padel` and `/ar/sports/padel` in Search Console URL Inspection. Check the rendered HTML, canonical selection, mobile usability, robots status and indexing eligibility. Use Google's Rich Results Test for supported structured data; valid FAQ markup does not guarantee FAQ rich results.
4. Verify the domain in Google Search Console. For URL-prefix HTML verification, set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to the public meta tag's content value and redeploy. Domain-level verification instead requires the supplied DNS TXT record.
5. Verify/import the site in Bing Webmaster Tools. For HTML verification, set `NEXT_PUBLIC_BING_SITE_VERIFICATION` to the public `msvalidate.01` content value and redeploy.
6. Submit `https://playza.nineapps.online/sitemap.xml` in both consoles. Request indexing for the homepage, both sport directories and the strongest active sport pages. Submission is a discovery signal, not confirmation of indexing.
7. Review Vercel/CDN firewall and bot logs. A local user-agent test does not prove access from real crawler IPs. Allow legitimate published crawler ranges if logs show challenges or blocks; do not disable security globally.

Search-console credentials, verification values and DNS access are not included in this repository. No indexing submission or live deployment is implied by passing local tests.

## Real local content to maintain

- Keep public academy addresses, areas, sports and training details accurate. Ask participating academy owners to complete their own profiles and link to them from their real websites and social pages.
- Publish actual upcoming activities with clear time, location, skill requirements, player capacity and cost. Expire or cancel obsolete listings promptly.
- Prioritize sports with active Cairo supply before expanding to more cities. Add district landing pages only when they contain substantial distinct local information and real opportunities.
- Publish original venue guides based on first-hand visits or owner-confirmed information, with useful photos and factual accessibility/equipment details. Do not manufacture prices, reviews, activity counts or availability.
- Review any demo participation numbers or sample leaderboards on the homepage before promoting them as real community statistics.
- Pursue relevant links through actual venue and academy partnerships. Do not buy link packages or create fake directory/review profiles.

## Measure weekly

Record a baseline after release and review at 2, 4 and 8 weeks:

- Google/Bing indexed sport URLs, crawl failures and canonical exclusions.
- Cairo/Egypt impressions and clicks by sport and language, e.g. `play padel Cairo`, `volleyball Cairo`, `بادل القاهرة`, `لعب كرة طائرة القاهرة`.
- Visitors reaching activity details, starting signup and completing participation from sport pages, using the site's approved analytics setup.
- Referral visits from ChatGPT, Gemini, Perplexity and Copilot where referrers are available. Some AI visits do not carry a useful referrer.
- A small fixed set of Cairo sport questions in AI search, recording date, wording and cited URLs. Answers vary; a single mention is not a stable ranking.

If pages are indexed but not receiving relevant visits, improve real local listings and content before producing more landing pages. If pages are not indexed, investigate console diagnostics and crawler logs first.

## Official guidance

- Google AI search uses normal indexing and SEO requirements; no special AI file or schema guarantees inclusion: https://developers.google.com/search/docs/appearance/ai-features
- Google-Extended controls training and grounding in Gemini, separately from Google Search ranking: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended
- ChatGPT search uses OAI-SearchBot; crawler permission and published IP access matter: https://developers.openai.com/api/docs/bots
- Bing sitemap discovery: https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed
- Optional future URL change notifications: https://www.indexnow.org/documentation . IndexNow is not a guarantee of indexing and is not Google's indexing submission mechanism.
