# Playza — Phase 4 Content SEO Report (implemented)

Status of this document: factual record of what was implemented in the codebase as of Phase 4, and what was deliberately left out. Nothing here describes future work as if it were done.

---

## 1. Existing content audit (what was found before changes)

- **Guides architecture was volleyball-only.** `/guides/*` served three volleyball articles (volleyball-guides.ts) while the platform actively runs five sports: Volleyball, Beach Volleyball, Basketball, Padel, Tennis (`src/lib/active-sports.ts`).
- **The basketball / padel / tennis discovery intents had no content at all.** Each sport's landing page (`/sports/<sport>`) only linked to `/games?sport=<sport>` — usable but thin.
- **Academy discovery had no editorial guidance.** `/academies` listed public academy cards; nothing answered "how do I actually choose an academy".
- **B2B pages were already strong** (built in earlier phases): `/list-your-court` and `/academy-management` ship FAQPage/Service/SoftwareApplication JSON-LD, honest-copy guardrails are test-enforced (`tests/list-your-court.cjs` rejects "eliminate cancellations"-style claims). The only gap was that they did not cross-link each other.
- **`seo-keywords.ts` was a big keyword list without an actionable page map** — no intent classes, conversion goals or page-status fields.
- **Location content already existed and already follows the inventory rule**: `/courts/<sport>/<location>` pages are generated only for sport+location combinations with real courts in the public directory, and `/play/volleyball-new-cairo`, `/play/beach-volleyball-new-cairo` follow verified New Cairo games. No new location pages were added; none were warranted.

## 2. Keyword-to-page mapping

`src/lib/seo-keywords.ts` was expanded into the required actionable schema. Every cluster now carries: intent category (`player-find-games` / `academy-discovery` / `venue-owner-b2b` / `academy-owner-b2b` / `local-discovery` / `educational`), primary + secondary keywords (English, Arabic, Egyptian colloquial), target audience, target URL, languages, geographic relevance, conversion goal, page status (`live` / `improved-in-phase4` / `new-in-phase4`), and qualitative priority. No fabricated volumes or difficulty metrics anywhere — prioritization is labeled qualitative. A `PAGE_KEYWORD_MAPPING` record covers `/`, `/games`, all five `/sports/<sport>` pages, `/academies`, both B2B pages and all nine guide URLs.

## 3. Existing pages improved

| Page | Change |
|---|---|
| `/sports/<sport>` (5 pages) | Player-discovery CTA ("Find <Sport> Games" / "لاقي ماتشات <الرياضة>") plus sport-matched, cross-linked guide links in the initial HTML of the SSR `SportDiscoveryPage`. |
| `/games` | Directory now links sport-matched discovery guides in SSR HTML so crawlers see the relationship from the directory itself. |
| `/academies` | Directory links the three academy guides in initial HTML. |
| `/list-your-court` | Added a genuine cross-link to `/academy-management` (same-owner audience) — tested single-H1, canonical/hreflang and honest-claims assertions unchanged and passing. |
| `/academy-management` | Reciprocal cross-link to `/list-your-court`. |
| `/guides` + `/guides/[slug]` + Arabic mirrors | Routes now serve the unified bilingual registry (`src/lib/guides.ts`); the old volleyball module re-exports it for compatibility. Hreflang pairs, canonicals and GA4 hooks untouched. |

## 4. New articles created (9 total; 3 migrated, 3+3 new)

Player-discovery (each bilingual, sport-specific, CTA to real listings):

1. `/guides/basketball-cairo` — "How to Find Basketball Games and Players in Cairo" / "عاوز تلعب باسكت ومش لاقي ناس؟" (half/full-court mechanics, group-forming, arrival logistics)
2. `/guides/padel-cairo` — "How to Find Padel Partners in Cairo" / "بتدور على شريك بادل؟" (always-2×2 partner mechanics, wall play vs tennis, racket/ball costs)
3. `/guides/tennis-cairo` — "How to Find Tennis Partners in Cairo" / "عاوز تلعب تنس ومش لاقي حد؟" (partner vs match vs lesson distinction, surfaces, format)

Academy-discovery:

4. `/guides/choose-sports-academy-child` — "How to Choose a Sports Academy for Your Child" / "إزاي تختار أكاديمية رياضية مناسبة لطفلك؟"
5. `/guides/start-volleyball-adult` — "How to Start Volleyball Training as an Adult" / "إزاي تبدأ تدريب طايرة وأنت كبير؟"
6. `/guides/padel-training-for-beginners` — "How to Find Beginner Padel Training" / "إزاي تختار تدريب بادل للمبتدئين؟"

Intent-deconfliction: each new guide targets one intent, verified against the existing pages — `padel-cairo` (finding partners/games) is distinct from `padel-training-for-beginners` (lessons), and `tennis-cairo` explicitly separates partner play from coached lessons to avoid colliding with academy intent.

## 5. Arabic content improvements

All nine guides are natively Egyptian-Arabic rewritten copy, not translated English: colloquial register ("لاقي ماتشات", "مش لاقي ناس", "بيتش فولى", "التجمع"), idiomatic titles matching Phase-4's specified Arabic headings. Guide index pages exist at `/ar/guides` and `/ar/guides/[slug]` with canonical + `ar-EG` hreflang. No machine-translation routes were added.

## 6. English content improvements

New per-sport titles/CTAs match the searches in §4 of the brief verbatim where supplied, and every guide follows the required structure: intro-equivalent first section, practical advice, what a Playza game/join flow actually does (including waitlist and payment-verification wording that matches the real join flow), safety/expectation notes, sport-specific information rather than sport-name swaps.

## 7. Academy SEO improvements

No fabricated fields were added anywhere; the public `/a/[slug]` pages and directory rendering were already correct (verified during audit — they display only published data and omit anything unpublished). The added value is the linking of the three academy guides into `/academies` SSR HTML and via /guides listing.

## 8. Venue owner SEO improvements

No copy sim changes beyond the cross-link (claims already limited to tested "free listing" + "no commission" language; financial guarantees remain absent by test assertion).

## 9. Local SEO implementation

No new pages. `/play/volleyball-new-cairo` and `/play/beach-volleyball-new-cairo` (New Cairo is the only district with verified published volleyball/beach inventory) remain the only `/play/*` pages in `dynamicParams=false` static generation; `/courts/<sport>/<location>` continues to render only actual sport+location court inventory. This satisfies the "no thin location pages" rule by construction.

## 10. Internal linking changes

Home → /sports → /games → game detail already complete. Added: /sports/<sport> → per-sport guides → /games?sport=/academies; /games → guides; /academies → academy guides; /list-your-court ↔ /academy-management. All with descriptive anchors ("لاقي ماتشات باسكت", "Find Basketball Games", anchor text from guide titles). No link farms — at most a short link list per page.

## 11. Structured data changes

Existing JSON-LD reviewed and left correct: game detail pages emit `Event` via `publicGameEvent` (per-event only, not on directories), guides emit `Article` + `BreadcrumbList` with SSR `articleBody` (asserted equal to the rendered section bodies), sports pages emit WebPage + breadcrumbs, home emits Organization + WebSite + SoftwareApplication, B2B pages emit FAQPage/Service/SoftwareApplication. No new schema types were needed.

## 12. Sitemap changes

`src/app/sitemap.ts` now enumerates the unified registry: 9 guides × 2 languages plus the two guide indexes = 20 guide URLs (previously 8), each with en/ar/x-default hreflang alternates and deduplication. Static paths match `generateStaticParams` of both `[slug]` routes.

## 13. Tests and validation

- `tests/volleyball-player-guides.cjs` extended to iterate all 9 unified guides in both languages, verifying SSR `articleBody` matches the registry content exactly and canonical paths are correct per language.
- `tests/sport-discovery.cjs` extended: per-sport landing pages must show the intended CTA text and link each sport's own player guide(s), for all five sports in both languages, in SSR HTML.
- `tests/sitemap.cjs` updated for the 20 guide URLs (9 guides + index per language).
- `tests/list-your-court.cjs` now loads the reciprocal cross-link module in its SSR case; single-H1, canonical/hreflang and honest-claims assertions all unchanged and passing.
- Full run: **66/66 tests pass.** `tsc --noEmit` clean. `next lint --max-warnings=0` clean. `next build` succeeds with `/guides/[slug]` and `/ar/guides/[slug]` prerendering 9 paths each.
- GA4 untouched: no script duplication, no event-name changes (`tests/ga4-conversions.cjs` passing).

## 14. Remaining issues

- GA4 is verification-only at list level; per-article conversion attribution to game registration depends on the existing signup/join event parameters (untouched by design).
- No review/rating schema on academies — there is no review data yet, so none was fabricated.
- Search volumes were not verified; cluster priority remains qualitative as instructed.

## 15. Recommended next actions (not implemented)

1. Add academy review/UGC data, then rating schema on `/a/[slug]` pages.
2. Publish real prices-rich data-driven articles once stable public price data exists.
3. Monitor Search Console for the six new guide slugs and iterate titles before expanding to `/play/*` for new districts when inventory exists.
4. Consider hreflang-cluster internal-link sub-sitemap for guides if the count grows beyond ~30.
