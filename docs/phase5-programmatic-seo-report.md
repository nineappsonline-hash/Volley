# Playza — Phase 5 Programmatic SEO Report (implemented)

Status of this document: factual record of what was implemented and validated in the codebase during Phase 5, distinguishing completed work from proposed future work. No claims of Google indexing or ranking improvements are made — those require Search Console evidence after deployment.

---

## 1. Existing implementation audit

Phase 4 and earlier work already covered the foundations, verified before any change:

- **Discovery routes exist and are inventory-gated**: `/games` (SSR directory), `/games/[id]` (dynamic detail, force-dynamic), `/sports` + `/sports/[sport]` (SSR per-sport pages with real games, courts and academies), `/play/[slug]` (New Cairo editorial pages, 2 slugs, `dynamicParams=false`), `/courts/<sport>/<location>` (location pages generated only for real court inventory), `/academies` (SSR directory), `/a/[slug]` (public academy profiles).
- **Sitemap already implements inventory gating**: upcoming games only (`status` open/full, `game_date >= today`), academies, tournaments with public hosts, court-location combos derived from real courts, guides, and hreflang alternates with independent per-source failure handling. No auth or private URLs.
- **Robots** already blocks auth/app surfaces for all crawlers and repeats them for AI user agents.
- **Structured data already correct in kind**: per-event `SportsEvent` on game detail only, `Article` on guides, FAQPage/WebPage on sport pages, Organization/WebSite/SoftwareApplication on home, SoftwareApplication/Service/FAQPage on B2B pages.
- **GA4 events** (`game_view`, `join_game_click`, `game_registration_completed`, etc.) are wired through shared components; untouched.
- **Gaps found**: no centralized indexability policy (robots decisions were implicit); game detail metadata always `index: true` regardless of lifecycle; expired games still emitted `SportsEvent` "EventScheduled" markup with registration-positioned metadata; game detail had no related-games links; academy profiles had no links back into public discovery.

## 2. Verified inventory availability

Inventory-driven features continue to key off real database rows only: `getPublicGames` (upcoming public games, scoped to `ACTIVE_SPORTS`), `getPublicGameIds` (sitemap), `getPublicAcademyIndex` / `getCairoSportAcademies`, `getPublicCourtDirectory` + `locationSlugsWithInventory`. Preview deploys without the service key render empty states instead of thin or fabricated content (`getAdmin()` returns null gracefully).

## 3. Routes reused / 4. New routes created

No new routes. All Phase 5 work reuses `/games/[id]`, `/sports/[sport]`, `/a/[slug]` and the existing sitemap/robots infrastructure. No competing URL structures were introduced; filter combinations remain canonicalized to their parent directories.

## 5. SEO eligibility rules (centralized)

New module `src/lib/seo-eligibility.ts` is the single source of truth for dynamic-page indexability. It owns `cairoGameStart` and `gameIsJoinable` (moved from `game-discovery.ts`, which re-exports them for compatibility so all existing imports and tests are unaffected) and adds:

- `gameLifecycle(game, now)` → `upcoming-open | upcoming-full | upcoming-cancelled | past`. A `completed` status is `past` even before its date; a past `game_date` is `past` regardless of status.
- `gameRobots(game, now)` → `index: true, follow: true` only while joining is possible; otherwise `noindex, follow`.
- `gameEventMarkupEligible(game, now)` → structured-data gate: expired pages must not present themselves as upcoming events; cancelled future games stay eligible with `EventCancelled`.

Rationale documented in the module: the gate is usefulness (can you still join?), not an arbitrary game-count threshold; removed/private/invalid games already 404 through `getPublicGame()`; no blanket redirects to `/games`.

## 6. Game detail improvements

`publicGameMetadata` now emits the dated title pattern `${game.title} — ${game.game_date} | Playza` (unique per game: the organizer-defined title carries the event; same-day games stay distinguishable), and `robots` comes from `gameRobots`. All other metadata, canonical and OG behavior preserved; registration tracking untouched.

## 7. Expired game lifecycle

- Upcoming open/full games: indexable, joinable CTA (existing behavior verified: the shared game page already suppresses joining and shows status text for non-joinable games).
- Full games: actual availability shown; event markup marks the offer `SoldOut` (pre-existing, re-verified).
- Completed games: page stays accessible (no redirect), shows "Completed", join CTA removed (pre-existing), now additionally `noindex,follow` via metadata and **no event JSON-LD at all** (previously they appeared as scheduled events).
- Cancelled upcoming games: keep accurate `EventCancelled` markup, no join CTA, `noindex,follow`.
- Removed/private/invalid IDs: 404 via `notFound()` (pre-existing, test-asserted).

## 8. Academy discovery improvements

`/a/[slug]` academy profiles now link each published sport to its `/sports/<sport>` discovery page (only sports in `ACTIVE_SPORTS`; other published sports remain plain text so no unsupported claims are made), plus a short discovery nav linking `/academies` ("Explore sports academies") and `/games` ("Find games to join"). All links are crawlable SSR anchors using existing public routes; no inventories, schedules or ratings were invented; no review markup added (real review data exists only when academies collect it, and rating display was already honest).

## 9. Internal linking changes

- Game detail → up to 4 related upcoming games of the same sport (SSR `<nav aria-label="Related upcoming games">`, crawlable links with date/time labels).
- Academy detail → sport discovery pages + academy directory + games directory (above).
- Existing related links (directory → games, sport → guides, /play pages → local games/courts) verified intact by tests.

## 10. Conversion improvements

Primary path Visitor → Game Discovery → Game Details → Registration was already wired: every directory card and related link lands on a detail page whose `PublicGameJoin` CTA carries `data-return-to` preserving attribution into the registration flow. CTAs use existing registration functionality; no new matching system, no payment-logic changes. Completed games never show a registration CTA.

## 11. Sitemap changes

Source-of-truth alignment rather than structural change: `getPublicGameIds` already enumerated only upcoming (`open`/`full`, date ≥ today) public games, which now *by construction* matches the on-page indexability policy (an eligible sitemap URL is an indexed page; expired pages drop out of the sitemap and render noindex until URLs settle, without redirects or fake lastmod dates). All other sitemap sections audited unchanged; XML output validated by `tests/sitemap.cjs` (deduplication, public-only URLs, independent data-source failure handling).

## 12. Structured data changes

The only change: expired (completed/past) game pages no longer emit `SportsEvent` markup; cancelled future games keep accurate `EventCancelled`. No new schema types were added (audited and judged already correct); no ratings/reviews/prices/dates were fabricated; no promise of rich-result eligibility is made anywhere.

## 13. Performance improvements

Audited; no changes were warranted beyond existing practice: game detail and directories render server-side without data-JS payloads; `/sports/*`, `/play/*`, `/guides/*` are statically generated with 300s revalidation; the sitemap regenerates hourly at most; public reads use React `cache` and a scoped admin client. The only bundle-adjacent change this phase was adding one `<nav>` to the game detail page. No Lighthouse run was performed; therefore no Lighthouse numbers are claimed.

## 14. Tests and validation

- `tests/public-game-discovery.cjs` extended: lifecycle unit tests for every policy state, robots (`index` true for open/full, false for completed), event markup present for joining games and absent for completed pages, plus full coverage of the pre-existing behaviors (private 404s, roster minimization, Cairo DST, waitlists, join return path, bilingual local filtering). DB mock extended for `neq`/`limit` chain steps.
- `tests/sport-discovery.cjs` updated to load the new policy module in its loader map (registration order matters because of the loader's hand-rolled module graph).
- Full suite: **66/66 pass.** `tsc --noEmit` clean. `next lint --max-warnings=0` clean. `next build` succeeds. Arabic/English routes, full/expired/invalid game states, and both languages' sport discovery pages are covered by these tests through their SSR HTML.

## 15. Remaining risks / limitations

- Conversion tracking is list-level verified only; live event-stream confirmation still requires deployment and GA4 realtime testing (unchanged from Phase 4).
- The one-direction dependency (`game-discovery` ↔ `seo-eligibility`) was made cycle-free at the source, but module-resolution order matters in test loaders; a future import change reintroducing a cycle will fail loader-based tests loudly (acceptable).
- No live Google fetch was possible; SSR/indexability claims are backed by tests rendering the actual components.
- Performance scores unaudited by tooling (no fabricated numbers); recommendation below.

## 16. Recommended next steps (not implemented)

1. After deploy: submit `/sitemap.xml` in Search Console, then URL-inspect a sample of upcoming game detail pages and the noindex rendering of a completed game.
2. Run Lighthouse/CWV on `/`, `/sports/volleyball`, a game detail page and an academy profile; act on measured LCP/LCP-attributable images first.
3. If Arabic game titles are wanted in detail metadata (`ماتش طائرة في التجمع الخامس — [Date] | Playza`), add a bilingual sport-name map; left out to avoid inventing Arabic names not present in the data model.
4. When real review volume exists on academies, revisit aggregate-rating schema.
