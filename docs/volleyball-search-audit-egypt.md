# Volleyball search visibility audit — Egypt

Audit date: 14 October 2026, Africa/Cairo. Production site: https://playza.nineapps.online.

The user confirmed Google Search Console is verified. Bing Webmaster Tools is not yet verified. This audit inspected public production responses, server-rendered HTML, repository code, sampled search results and current official Google/OpenAI guidance. It did not access private Search Console reports, analytics, DNS, hosting firewall logs or real crawler IP logs. Search-result samples are not a Google Egypt ranking report, and absence from a sample does not prove a page is unindexed.

## Conclusion

Playza already has much of the technical foundation. The main opportunity is to become a useful, trustworthy source for people looking for actual volleyball courts, training and games in Egypt. The next work should improve public court discovery, factual local information, indexing diagnostics and partner references. Additional keywords or animation alone will not establish that position.

Prioritize player intent in Cairo/New Cairo, where this audit found published inventory. Treat the wider Egypt opportunity as a growth plan, and add other areas when their information and opportunities are verified. Keep academy-management software content separate from player-facing court/training discovery.

## What is working

Direct production requests confirmed:

| URL | Result |
| --- | --- |
| `/` | HTTP 200; current Volleyball + Beach Volleyball title, new beach section, canonical; no observed noindex |
| `/sports/volleyball` and `/ar/sports/volleyball` | HTTP 200; distinct language pages, self-canonicals, server-rendered volleyball copy and public listings |
| `/sports/beach-volleyball` and `/ar/sports/beach-volleyball` | HTTP 200; separate beach-volleyball topics and public listings |
| `/games?sport=volleyball` | HTTP 200; sport-specific title, canonical and real upcoming activity |
| `/book-courts` | HTTP 200; public Arabic booking/participation guide |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | HTTP 200 |
| Public academy and two sampled `/p/<id>` profiles | HTTP 200, descriptive location titles and visible content |
| `/playgrounds` | HTTP 307 to `/login?redirectedFrom=%2Fplaygrounds` |

The sitemap contained 77 URLs: 56 bilingual sport-directory/guide URLs, one academy profile and six approved-venue profiles, plus other public pages. The six venue URLs are platform inventory, not a count of six volleyball courts.

At the audit snapshot, the volleyball Cairo guide displayed Spike Nova and Aspire Friendly Game; the beach-volleyball guide displayed Spike Nova and Beach Volley event (Including Breakfast). Each showed an actual date, location and participation price. These are time-sensitive observations, not future availability promises. See [volleyball guide](https://playza.nineapps.online/sports/volleyball) and [beach-volleyball guide](https://playza.nineapps.online/sports/beach-volleyball).

Basic requests carrying Googlebot, OAI-SearchBot and PerplexityBot user-agent names returned 200 for the volleyball guide. Production robots rules permit public search access. This does not prove access from those companies' actual IP ranges; hosting/CDN logs must establish that separately.

The search tool showed an older cached homepage title, while fresh production HTTP responses showed the current title and beach section. The deployment is live; the sampled search copy has not caught up. Do not diagnose a failed deployment from that cached result.

## Prioritized work

| Priority | Work | Why / completion evidence |
| --- | --- | --- |
| P0 | Inspect the homepage and four volleyball/beach language pages in existing Google Search Console | Record indexed status, last crawl, Google-selected canonical, live-test rendering and exclusion reason. Confirm sitemap processing. A successful HTTP response is not proof of indexing. |
| P0 | Check Search Console → Settings → Search generative AI | Confirm the effective setting includes the site, including inherited settings. This control is distinct from training access. See [Google's control documentation](https://support.google.com/webmasters/answer/16908024). |
| P0 | Import the verified Search Console property into Bing Webmaster Tools; submit the sitemap | Establish Bing indexing diagnostics, then inspect the same four sport pages. Bing supports [importing verified Google properties](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b). This is an owner/account action, not a code-only fix. |
| P1 | Add a public, read-only court discovery directory and link the main landing-page court CTA to it | The current CTA points at the login-protected `/playgrounds` console. Keep owner management and booking/payment operations protected; publish only approved, public venue information, linking existing `/p/<id>` pages. Do not simply remove the console's authentication guard. |
| P1 | Remove generated recent-game examples from the indexable public listing, or separate them unmistakably as demonstrations | `src/app/games/page.tsx` creates sample scores/participants and dates relative to today. An example disclosure exists, but samples appear under “Recently finished games” and include other sports on the volleyball page. These must not become evidence of real local activity or feeds for event markup. |
| P1 | Enrich the existing volleyball and beach guides with owner-confirmed local information | Current guidance is short, and much of the district/FAQ text is shared across sports. Add court type, precise address, map, access restrictions, age/skill groups, coaching formats, published fees, what is included, photos and how to join. Use verified listings; mark uncertain information plainly. |
| P1 | Improve discovery links to real court, academy and activity details | Existing guides prominently link academies and activity listings, but lack a useful list of matching public courts. The client-driven `/academies` directory does not include its academy cards in initial HTML; ensure important public profiles are also reachable through server-rendered links. Sport guides already provide some of those links. |
| P1 | Build genuine partner references | Ask participating academies, venues and organizers to link their actual Playza profiles from their websites and social accounts. Seek first-hand coverage of real games and training, rather than purchased links or fabricated forum recommendations. |
| P2 | Clean up title duplication and entity information | Sample academy/venue titles end in `| Playza | Playza`: metadata adds the brand and the root template adds it again. Where known, include the sport in profile titles. Add verified official organization/social links and contact details; remove unsupported superlatives such as “#1” unless evidenced. |
| P2 | Add suitable structured data to real public activity details | Use Event/SportsEvent only where dates, place, organizer, fees and public participation details are accurate and visible; maintain cancelled/expired status. Existing WebPage/Breadcrumb/Organization/place markup is useful. No invented ratings, prices, events or private invite exposure. |
| P2 | Check real-user performance | Use Search Console Core Web Vitals and a mobile PageSpeed/Lighthouse check on homepage, sport guide and venue profile. No performance score or field-data conclusion was established in this audit. Preserve reduced-motion support and readable mobile layouts. |

## Content and query focus

These are proposed intent groups, not measured keyword volumes or guaranteed low-competition terms. Validate them against Search Console queries and bookings/signups.

| Intent | Example English queries | Example Arabic queries | Best destination |
| --- | --- | --- | --- |
| Find a court | volleyball courts Cairo; rent volleyball court New Cairo | ملاعب كرة طائرة القاهرة؛ حجز ملعب كرة طائرة التجمع | Public court directory and factual venue profiles |
| Join a game alone | join volleyball game Cairo; casual volleyball Egypt | عايز ألعب كرة طائرة؛ لعب كرة طايرة القاهرة | Volleyball guide and real open-game details |
| Start training | volleyball academy Cairo; beginner volleyball training New Cairo | أكاديمية كرة طائرة القاهرة؛ تدريب كرة طائرة للمبتدئين | Volleyball guide and actual academy/program profiles |
| Play on sand | beach volleyball Cairo; beach volleyball Egypt | كرة طائرة شاطئية القاهرة؛ بيتش فولي مصر | Beach-volleyball guide and verified sand-court/activity profiles |
| Compare participation | volleyball training prices Cairo; volleyball games near me | أسعار تدريب كرة الطائرة؛ لعب كرة طائرة قريب مني | Dated, source-backed comparisons using actual listed offers |

Start with existing `/sports/volleyball`, `/ar/sports/volleyball`, `/sports/beach-volleyball` and `/ar/sports/beach-volleyball` rather than manufacturing many similar pages. Distinct district pages should wait for substantive local supply and first-hand information. General “volleyball Egypt” searches can include national teams, news and competitions; Playza's strongest initial fit is play/train/book intent, not national sports news.

Sample results included [Wadi Degla's volleyball page](https://www.wadideglaclubs.com/Sports/16), which provides specific facilities, coaching and program information, and [AUC's facilities page](https://www.aucegypt.edu/student-life/athletics/sports-facilities), which describes facilities and reservation access. The lesson is factual detail and institutional trust, not copying their content or asserting their current rank.

Useful original additions include a first-visit guide to a participating court, beginner training explained by an identified coach, and a dated comparison of published offers. Where fees or operating hours change, update the facts from the source rather than repeatedly changing dates on unchanged articles. Add actual venue photos/video with permission alongside the existing decorative graphics.

## AI discovery

Google's current [AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) emphasizes original, useful content and normal search foundations. It says special AI files, forced content chunking and artificial mentions do not provide Google ranking shortcuts. `llms.txt` already exists; expanding it is lower priority than better public information and indexing.

For ChatGPT search, official OpenAI documentation distinguishes OAI-SearchBot from GPTBot. Permit OAI-SearchBot and check access from its published ranges. GPTBot training permission is independent and is not required to pursue search inclusion. See [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots). The repository already allows search crawlers; confirm that infrastructure does not counteract that policy.

Make Playza citeable through concrete, attributable facts: a public venue's location/access rules, a named academy's published training offer, and a real game's date, cost and participation conditions. Clear organization identity, verified partner references and consistent public profiles help users assess those facts. Formatting supports readability; it does not guarantee an AI citation. There is no evidence here that buying “GEO” packages or allowing every training bot would solve visibility.

## Owner actions in Search Console

Because Google verification already exists, do not restart verification based on a missing HTML verification tag. DNS verification and other methods can be valid. The live HTML lacks Google/Bing verification meta tags; that alone does not establish an account problem.

1. Inspect the homepage, four sport/language pages and strongest actual academy/venue profiles. Record indexed status, last crawl and selected canonical; inspect any “Crawled - currently not indexed” or “Discovered - currently not indexed” reason.
2. Confirm `/sitemap.xml` is submitted and successfully processed. Request indexing after meaningful updates, starting with the most useful pages.
3. Confirm Search generative AI inclusion. Review the [Generative AI performance report](https://support.google.com/webmasters/answer/16984139) when available; Google notes it may be absent when impressions are insufficient.
4. In Search results performance, use country Egypt, page filters for the volleyball hubs, and English/Arabic volleyball-related queries. Separate branded Playza searches from non-brand discovery. Compare impressions, clicks and CTR over consistent periods.
5. Import the property into Bing and inspect the same URLs. Review verified crawler requests and failures in hosting/CDN logs without globally disabling security.

## Suggested rollout and measurement

- First week: capture indexing/query baseline, verify AI inclusion, set up Bing, resolve the public court-discovery path and sample-results trust problem.
- Following two weeks: improve the four existing hubs and participating profiles with real information, photos and partner links. Prioritize New Cairo supply already observed, then expand when actual inventory supports it.
- Review weekly: indexed priority URLs, non-brand Egypt impressions/clicks, sport-page visits, views of real activity/venue details, signup/participation conversions, crawler errors and AI referrals where measurable.
- Maintain a small dated AI-search prompt set: “Where can I play volleyball in Cairo without a team?”, “Beginner volleyball training in New Cairo”, “أكاديميات كرة طائرة في القاهرة”, and “Where can I play beach volleyball in Cairo?”. Record the product, whether search was enabled, cited URLs and date. These prompts were not tested across ChatGPT/Gemini/Perplexity interfaces in this audit; changing answers are not stable rankings.

The next implementation should prioritize public court discovery, removal/separation of demo results, factual volleyball content and title cleanup. Console actions and partner facts need the account owner or participating organizations. No application functionality, permissions, indexing submissions or external accounts were changed during this audit.
