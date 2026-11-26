# Playza — SEO + AIO Growth Master Plan
**Version:** 1.0 · **Baseline date:** 2026-11-26 · **Market:** Egypt · **Owners:** Product / Engineering / Growth
**Status:** Implementation started. Source of truth for the phased backlog.

## 0. Outcomes and guardrails

### North-star outcomes
1. **Players:** increase *confirmed game joins attributed to non-brand organic discovery*, not vanity pageviews.
2. **Venues:** increase *approved venue listings and first bookings attributable to organic discovery*.
3. **AIO:** improve *accurate, cited recommendations of Playza for local sports discovery and court-owner listing*, measured on repeatable prompts.
4. **Reliability:** never advertise cancelled/expired games as joinable, private games publicly, unverified availability, fabricated reviews or metrics, or overstate venues/markets supported.

### Scope
Egypt-first (Cairo / New Cairo first; other areas only when verified inventory exists). Primary verticals: volleyball, beach volleyball, basketball, padel, tennis. Two distinct intents: **join a game / find people**, **list a court / manage bookings**. Academy/tournament pages support discovery but should not distract from the primary funnels.

### Success attribution
Definitions:
- Organic player conversion = first session landing on an eligible public page with organic referrer/UTM, followed by verified participant payment approval or host-paid confirmed participation (attribution within agreed window).
- Organic venue conversion = first organic session / owner registration → complete venue submission → approved listing → first successful booking.
- Avoid recording names/emails, payment references or other PII in GA4 events; use aggregated IDs and consent-aware analytics.
- AI citation = accessible URL cited in independently repeated answer, not merely brand mention or model's unverifiable assertion.

**Constraints:** no mass doorway pages, no unverified search-volume claims, no indexable low-value filter duplicates; apply consent and privacy requirements; preserve application behavior and pricing; test production before claiming done.

## 1. Audit and baseline — P0
**1.1** Record GSC domain property for `playza.life`, verification status, sitemap ingestion, coverage, indexing anomalies, performance by page/query/device/country, and canonical decisions. Capture 28-day and 3-month trends. Inspect at least 15 canonical URLs (home, /games, 3 live games, 2 expired games, /sports/volleyball, local pages, court pages, owner pages, private game).
**1.2** Bing Webmaster Tools setup + sitemap submission and status.
**1.3** GA4/GTM verification: correct consent, event firing, no duplicate pageview, events below; exclude administrators/test payments. Baseline organic landing → game view → join → approved; owner landing → signup → application → approval → first booking.
**1.4** Crawl with a JS-capable crawler, including responsive 360px/768px/desktop; status, redirects, canonical, robots, headings, lazy load, internal linking, hreflang, orphan pages, non-200 in sitemap, pagination, query duplicates. Compare crawler rendered output to raw HTML.
**1.5** Core Web Vitals (CrUX if available; Lighthouse lab): mobile LCP/INP/CLS, CDN caching, image size, fonts, JS/hydration and third parties. Save baseline evidence.
**Gate:** an auditable baseline sheet with dates, source, screenshot/test URL, impact, owner, severity. Do not invent volume/ranking stats before connecting GSC or keyword data.

## 2. Technical SEO repair — P0 (first implementation phase)
- **2.1 Public games:** unify `/games/[id]` metadata with centralized `gameRobots`; canonical absolute URL, unique title, meaningful date/location/price, social share image; past published public games index/follow as discovery archives; cancelled noindex, private 404; eligible upcoming public games index/follow. Full/sold-out events must not be represented as joinable; review current policy and event Offer availability.
- **2.2 Sitemap parity:** include public, approved, applicable-sport games whether upcoming or historic; omit cancelled/private/unapproved; verify sitemap emits only 200 + indexable canonical pages. Dynamic pages cannot have metadata saying noindex but remain in XML. Remove parameter URLs with duplicate content or give them canonical to clean route.
- **2.3 Redirects/host:** enforce HTTPS, `www` decision, 301 old `playza.nineapps.online` → `playza.life` preserving path/query where valid; verify actual infra responses rather than assume domain routing.
- **2.4 Robots:** public crawlers can access useful landing pages; private/account/payment/API endpoints excluded; ensure Googlebot/OAI-SearchBot/PerplexityBot allowed for public content if policy permits. No disallow that prevents a crawler seeing a required noindex.
- **2.5 International:** audit Arabic/English self-canonicals, bidirectional hreflang `ar-EG` and `en`, x-default; avoid home-page automatic language redirects of Googlebot, ensure server-rendered meaningful language.
- **2.6 Structured data:** validate Event/ SportsEvent (real event time, actual venue, currency, status, availability), SportsActivityLocation (real venue), Organization, Breadcrumb; don't mark a court's rental price as a player's game price. Follow Google's structured data policies; rich results aren't guaranteed.
- **2.7 Technical hygiene:** 404/410 for deleted, redirect chains, security/caching of public listing vs auth, crawl budget, OG images, image alt/size, mobile usability, accessible navigational links.
**Gate:** smoke test 200/404, canonical, robots, sitemap, JSON-LD and SSR across >15 representative URLs; no regression in join or owner submission.

## 3. Keyword and competitor evidence — P0–P1
**Competitor cohorts:** local court platforms (Courty, Matchena, E7GZ, Riadi — revalidate relevant pages), organized pickup games (Footy Addicts, OpenSports), racket sports (Playtomic), and indirect competition (Facebook/WhatsApp/Reddit communities). Track *intent, page types, CTA, indexable inventory, location granularity, title/heading patterns, owner proposition, internal links, structured data and content freshness*. Do not copy their prose.
**Keywords:** research 5–8 seeds in Egyptian Arabic, transliterated colloquial Arabic, English; segment by player, court booking, owner onboarding, informational, branded, place/sport/time. Pull monthly volume/KD/CPC where source supports them; 28-day GSC actual queries; 3–6-month seasonality and locale. Maintain one primary intent/URL per cluster and a cannibalization map. Examples:
- player: `ماتشات طايرة في التجمع`, `ناس تلعب طايرة القاهرة`, `جروبات كرة طائرة`, `volleyball games new cairo`, `pickup basketball cairo`, `find padel partner cairo`;
- courts: `ملاعب بادل التجمع`, `حجز ملعب طايرة القاهرة`, `volleyball court new cairo`;
- owners: `إضافة ملعب على موقع حجز`, `برنامج إدارة ملاعب`, `تسويق ملاعب بادل`, `sports court booking software Egypt`.
**Gate:** evidence-backed keyword matrix: query, audience, intent, locality, proposed URL, volume, KD, rank, priority, confidence/source and last checked. No published keyword volume without verified data.

## 4. Player acquisition landing pages — P0–P1
**Reuse before creating:** `/games`, `/sports/[sport]`, `/play/[slug]`, `/ar/play/[slug]`; add stable `/find-players` and `/ar/find-players` only if genuinely distinct from /games. 301/consolidate duplicate destinations.
**Default experience:** short above-the-fold answer + real game cards, date/time in Africa/Cairo, actual venue map, difficulty, price, available spots and direct join CTA. Explanation of joining solo vs renting a court, verified FAQ, group/host trust policy, linked nearby games. If none available, useful alternatives + user opt-in to notifications, not fabricated availability.
**Priority rollout:** Volleyball New Cairo (existing inventory) → Beach Volleyball New Cairo → Basketball and Padel where actual games exist. No sport × city page until inventory or substantial original evergreen value; prune thin pages.
**Game details:** public share URL, stable canonical; breadcrumbs to sport/local page and venue; event data matches product; related *upcoming* games; noindex after expiry, retained for users without incorrect event promise. Keep private invites out of indexing.
**Gate:** 3 representative player journeys (anon, signed in, shared link) working mobile/desktop, events recorded, clear next action on empty inventory.

## 5. Venue owner acquisition — P0–P1
Expand existing bilingual `/list-your-court` and `/ar/list-your-court` instead of duplicating. Show verified pricing/fees, no-fee listing, explain rental payout vs platform per-player service fee as implemented, how approval works, actual screenshots of owner dashboard, required fields, booking availability, who manages cancellation and payment status, FAQ with accurate terms, case studies only with consent and real data.
Create focused commercial pages for `padel court booking/management`, `volleyball court management`, `basketball court management`, and `sports venue booking system Egypt` only with differentiated copy/specific workflow/screenshots; link to owner registration and track every funnel stage.
**Gate:** owner signup from public landing, form completion, admin approval, venue published, first booking; no inflated 'millions of players' claim, zero fictitious social proof.

## 6. Local inventory and internal linking — P1
- Derive sports × locality pages only from approved venues and active game inventory, not synthetic combinations; use canonical clean lowercase Latin slugs and explicit Arabic alternates.
- Standard geographic hierarchy with breadcrumb: sports → region → venue → active games; games link back to venue and sport/location.
- Locality aliases: Fifth Settlement/Tagamoa/New Cairo/التجمع/القاهرة الجديدة map to normalized location IDs; never create near-duplicate indexable pages for spelling variations.
- Enrich venue pages with opening hours, price per rental period, correct sport, photos, directions, accessibility, policy, true available booking slots; don't expose owner private contacts without consent.
- Google Business Profile should belong to actual eligible businesses/venues; never fabricate local Playza branches or maps listings.
**Gate:** inventory-backed routing, internal links, coverage audit and >90% correct data on sampled records.

## 7. Content and editorial — P1
Publish high-intent pages first (not generic mass articles). Calendar:
- Week 1–2: volleyball/new cairo hub, join-solo FAQ, owner landing improvements.
- Week 3–4: volleyball & beach-volleyball guides, owner onboarding walkthrough, booking-vs-joining.
- Weeks 5–8: basketball/padel discovery if active, beginner suitability, partner-finding, court-marketing guide, scheduling/cancellation guide.
- Weeks 9–12: localized venue comparisons with real data, owner success story only if verifiable, internal link optimization.
**Editorial QA:** field expert or organizer reviews accuracy; author/date/update stamp, fact sources, concise Egyptian Arabic and competent English, no invented prices, no scraped competitor content, no programmatic thin pages, no self-generated fake reviews. Link from articles to live products and the next conversion action.

## 8. AIO/AI discovery — P1
- Primary foundation: indexed, factual, crawlable text pages with clear Q&A and live data, stable organization identity, transparent policies, appropriate schema, internal links, external citations. `llms.txt` is optional / non-ranking guarantee.
- Correct actual coverage countries, venues, opening hours, prices and current game state; remove unsupported audience counts.
- Create 25–40 repeatable Arabic/English prompts (player-join, court availability, owner listings). Record answer, source URLs, accuracy, citation appearance, prompt date and platform; repeated non-personalized runs, trend rather than single-sample promises.
- Earn legitimate citations from actual partner venues, local sports publications, club/community directories, academy sites; no link schemes, fake profiles or paid links passing as editorial.
- Monitor AI Overviews/Search Console where available and Bing/Copilot/ChatGPT citation presence; distinguish generative answer from Search rankings.
**Gate:** cited-source corpus and reproducible monitoring, no fabricated 'AI ranking' guarantee.

## 9. Analytics and technical instrumentation — P0–P1
Event taxonomy (minimum):
`organic_landing`, `view_game`, `join_started`, `payment_started`, `payment_confirmed`, `join_confirmed`, `view_venue`, `owner_signup_started`, `owner_signup_completed`, `venue_submitted`, `venue_approved`, `first_venue_booking`.
Tag `sport`, `location_slug`, `page_type`, `auth_state`, `payment_method` (not payment identifiers), `traffic_source`, funnel/session ID respecting privacy. Ensure server-side confirmations are source of truth, events deduplicated, no PII in analytics. GSC + GA4 + Supabase aggregate dashboard by sport/locality, compare weekly cohorts; owner leads have distinct funnel from players.
**Gate:** one real sandbox/test journey and one observed production journey verified in GA4 debug view and backend counts without charging a real card for tests.

## 10. Performance and accessibility — P1
Measure mobile lab and field Core Web Vitals and fix high-impact LCP images, font loading, oversized JavaScript, waterfall, cache headers, fetch waterfalls, hydration and third-party cost. Validate 360px/768px/desktop, keyboard support, headings, links, RTL, contrast, alt text, lazy images below fold. Do not trade conversion reliability for Lighthouse.
**Gate:** no UX regression, improvement documented with repeatable before/after conditions and CWV when field data available.

## 11. Authority and distribution — P1–P2
Onboard verified partner venues with co-branded backlinks from their official sites, real events/community coverage, useful local guides, opt-in WhatsApp sharing and social cards, creator/organizer referral paths. Acquire backlinks by editorial merit, no purchased manipulative links. Track linking domains, relevant referral traffic and venue owner leads.

## 12. Monitoring, alerting and operations — P0 ongoing
Automated daily audits for sitemap HTTP 200, malformed JSON-LD, game indexability drift, 404/500 spike, empty live-game inventory, locale/canonical mismatch, payment/booking funnel errors. Weekly crawl/URL sample, GSC report, organic conversions; monthly keyword, competitor and AIO prompt refresh. Document rollback by commit; only publish validated pages, maintain release log.

## 13. Phases / milestones / exit checks

| Phase | Workstream | Target window | Exit check |
|---|---|---|---|
| P0-A | Audit + metadata/sitemap/indexing/host | Weeks 1–2 | 15 URL matrix passes; production build + 404/robots checks |
| P0-B | GSC/Bing/GA4 baseline + event taxonomy | Weeks 1–2 | dashboard of player and owner funnels, no PII |
| P1-A | Join-game pages and local volleyball hub | Weeks 2–4 | live inventory + links + mobile join tests |
| P1-B | Owner conversion pages and proof | Weeks 3–5 | owner signup/submission/approval journey |
| P1-C | Local venue schema + inventory pages | Weeks 4–7 | eligible region routes, no thin duplicates |
| P1-D | Editorial, AIO Q&A, schema testing | Weeks 5–10 | factual source checks, prompt baseline |
| P2-A | Outreach, digital PR, community links | Weeks 7–12 | real partner citations/referrals |
| P2-B | Content iteration, CWV, CRO and scaling | Weeks 8–12+ | improved tracked funnel metrics |

**Dependencies:** GSC property + authorized analytics data access (for real baselines), representative actual venues and game inventory; review owner terms/pricing, no automation of external Google properties without authorized integration. Improvements that can be safely made in code proceed independently.

## 14. Phase-1 implementation ledger

- [x] Confirm public game page used a standalone `generateMetadata` that omitted central lifecycle robots + canonical; replace with shared helper preserving OG preview.
- [x] Strategy amendment (2026-11-26): approved archived games remain indexable in the dynamic sitemap, even after their dates have passed.
- [x] Filter expired games from upcoming listings (but retain their indexable archived pages).
- [x] Mark shared `?join=` game URLs `noindex,follow`, retaining their share previews.
- [ ] Inspect verified HTTP response and redirect behavior for retired domain, www, canonical and sitemap (external domain/DNS access required if misconfigured).
- [ ] Test public/private/ended/full game live metadata, structured data and all sitemap entries on deployed build.
- [x] Bind verified playza.life Google Search Console via OpenSEO and record baseline in docs/SEO_GSC_BASELINE_2026-11-26.md (18 clicks, 355 impressions for requested 28-day period, data returned for 14 dates). Bing remains unverified.
- [ ] Inventory current landing pages and compare intent-to-URL mapping, then launch player/owner phase.
- [x] Verify Vercel production build READY for SEO phase-1 source commit `21e40c88b588ab5faa374d89491b7e34012e4be2` (deployment `dpl_9RrFCXwKfj3qDoXkrDvsdGzMRaHR`).
- [ ] Validate actual live HTTP metadata / robots / sitemap / redirects in production: external fetch was inconclusive due to runtime network access; validate with browser or crawl tool.

### External references (not a basis for invented ranking statistics)
- Google Search Central: AI features — https://developers.google.com/search/docs/appearance/ai-features
- Google Search Central: Event markup — https://developers.google.com/search/docs/appearance/structured-data/event
- Google structured-data rules — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Courty — https://www.courty.io/ and https://www.courty.io/partners/
- Matchena — https://matchena.com/en/help
- OpenSports pickup groups — https://opensports.net/blog/meetup-for-sports-how-to-create-and-join-pickup-sports-groups

## 14A. Historical game discovery SEO amendment — 2026-11-26

**Decision:** Keep published, genuine games indexable after finishing, since short-lived games often expire before Google indexes them. History pages link to new games.

- Only real public, approved games using supported sports appear in the historical sitemap; never private, cancelled, deleted or unapproved games.
- Completed pages have an unambiguous finished-game message, real date/sport/location, and prominent links to future games from the same sport and preferably area.
- Do not advertise a past game as upcoming or give it an active join button. Keep archived event structured data omitted.
- Keep the archive canonical stable. The sitemap includes old and upcoming approved game URLs.
- Monitor archive quality in Search Console; indexing is permission, not guaranteed ranking. Improve duplicate/thin archives and split large sitemaps before XML limits.
- Test actual completed, future, cancelled, private and invite URL robots/metadata and related-game navigation.

## Phase 2 implementation ledger — local search and archived-game conversion

- [x] Add privacy-safe public historical game lookup limited to approved, noncancelled entries for valid sports.
- [x] Update New Cairo evergreen sport/location pages to show real archived matches separately from upcoming games, with explicit expired state and no registration promise.
- [x] Link past New Cairo game detail pages to their Arabic evergreen local sport pages, while preserving upcoming-game CTAs.
- [x] Add visible bilingual New Cairo hub navigation to /games so visitors and crawlers can discover both English and Arabic pages.
- [x] Remove the unsupported Arabic claim that Playza already reaches millions of players from the venue-owner registration landing.
- [ ] Verify the deployed pages and crawlable HTML on production; inspect sample old game, sport/local archive, /ar/list-your-court, and sitemap.
- [ ] Expand to basketball and padel location pages after confirming real matching inventory; avoid empty location doorway pages.
- [ ] Implement consent-aware funnel tracking and establish Search Console baseline; external account data still required.
- [ ] Complete accurate owner onboarding conversion content/screenshots, marketing variants and paid-vs-organic measurement.
- [ ] Record successful release state and first post-deploy crawl measurements.

## Phase 3 implementation ledger — venue-owner search intent (2026-11-26)

- [x] Add original differentiated pages for padel, volleyball and basketball court owners, in Arabic and English (6 indexable routes).
- [x] Include each page in the sitemap with self-canonical and bilingual hreflang alternates.
- [x] Include factual service information, transparent registration process, sport-specific questions, no unverifiable traffic/booking promises, and direct owner signup CTA.
- [x] Link the three categories from the existing /list-your-court funnel page in both languages; cross-link related sport owner pages.
- [x] Vercel production build passed and deployment dpl_GgLEUWuTzpu3giXzrBAqtRdUFJPe reported READY for all six sport-owner routes.\n- [ ] Validate all six production URLs return HTTP 200, contain correct HTML lang/hreflang, structured data, CTA and indexable canonical (external HTTP fetch from this runtime was not available).
- [ ] Verify owner signup → submission → approved court journey and GA4 funnel in production using safely marked test data.
- [ ] Review existing analytics taxonomies for owner signup and complete owner conversion attribution.
- [x] Bind verified Search Console property to a new Playza OpenSEO project and document source-backed performance by page/query.\n- [ ] Compare with competitors' verified positions and prioritize page changes from Search Console metrics.

## Phase 4 implementation ledger — GSC-driven sport page optimization (2026-11-26)

- [x] Verify five key public URLs are indexed in Google and use the intended canonical: English/Arabic volleyball, English owner landing, Arabic beach-volleyball local hub, filtered basketball courts.
- [x] Inspect newly created venue owner URLs: Google has not discovered tested examples yet; allow for crawl lag, do not report them as indexed.
- [x] Improve volleyball title/description to speak to individual game-join intent; repair unnatural Arabic sports snippets (volleyball, basketball, padel, beach volleyball).
- [x] Add honest archived-games sections to sport discovery pages, linking visitors to genuine past games and current joining options without making past games bookable.
- [x] Save inspection evidence in docs/SEO_INDEXING_SPORT_CTR_2026-11-26.md.
- [ ] Re-run Search Console performance after Google recrawls to measure CTR, clicks and ranking shifts without assuming a guaranteed uplift.
- [ ] Test production HTTP responses and crawlable HTML across archived, private, owner and sport pages; run booking/signup regression checks.
- [ ] Prioritize additional neighborhoods/owner sport routes only when verified game/court inventory or differentiated service evidence exists.

## Phase 5 implementation ledger — court directory search/conversion (2026-11-26)

**Evidence:** GSC /courts?sport=basketball had 38 impressions and 0 clicks, avg position 14.9 in the recent baseline. GSC inspection confirmed indexed, allowed and self-canonical. Small sample; not evidence of any guaranteed uplift.

- [x] Refresh bilingual filtered court-directory search titles/descriptions to highlight actual inventory, locations, rental pricing and booking details.
- [x] Add SSR navigation from sport-filtered court directories to sport×area pages only for localities with real approved court listings, avoiding empty programmatic pages.
- [x] Cross-link court discovery to owner registration, with accurate free-listing proposition.
- [x] Replace hardcoded tennis/volleyball-only court filters in XML sitemap with sport filters that actually have approved court inventory (including basketball and padel when available).
- [ ] Recheck production HTML/metadata, local links and sitemap with a live crawl.
- [ ] Measure new clicks/CTR after Google recrawls; compare identical page/query windows.
- [ ] Inspect actual owner signup flow and attribution tracking after arriving from directory.
- [ ] Evaluate mobile court-card image LCP and direct booking conversion via performance tools.

## 15. Release discipline
Every phase: source review → implementation PR/commit → typecheck/build → route and regression smoke tests → production deploy → production check → analytics/SEO monitor → mark complete. **Never mark a phase fully done when only the code has been committed.**
