# Playza — Technical SEO crawl and mobile performance work (26 November 2026)

**Property:** https://playza.life/ · **OpenSEO audit:** e5918996-1021-4c12-befe-78acc5b08627
**Audit link:** https://app.openseo.so/p/61f15d32-23b4-4634-af4b-073c0c43e3a9/audit?auditId=e5918996-1021-4c12-befe-78acc5b08627

## Verified audit results
- Crawl finished; 50 pages crawled of 137 URLs discovered, 87 omitted by the 50-page cap.
- The issue summary reported **0 critical issues**, **1 missing H1**, **4 thin-content notices**, **14 long meta descriptions**, **9 long titles**, and **1 crawl-page-limit notice**. Severity levels include warning and informational; these are heuristic tool reports, not necessarily ranking penalties.
- Affected H1: `/academies` (added server-rendered heading and accurate introduction).
- Pages noted as thin: `/games/beach-volleyball`, `/shop`, `/solutions`, `/tournaments`. The beach-volleyball page is a playable minigame rather than a normal match listing; treat text extraction carefully, inspect rendered functionality before noindex or consolidation.
- Search snippets longer than the tool's 160-character suggestion include `/list-your-court`, `/ar/list-your-court` and `/for-courts/padel`. Highest-value owner descriptions were shortened. Search engines may truncate or rewrite snippets; character count alone is not a quality score.
- Observed server response samples: `/games` ~658ms, `/sports/tennis` ~516ms, `/academies` ~502ms, `/sports/padel` ~501ms. These are single crawl fetch durations, NOT reproducible p75 TTFB or Core Web Vitals.

## Lighthouse measurement blocker
OpenSEO attempted 20 Lighthouse runs on mobile/desktop sample pages; all **20 failed** with `INSUFFICIENT_CREDITS`. The audit contains **no valid Lighthouse performance or CWV results**. Do not report score improvements or numeric LCP/CLS/INP until a comparable run succeeds.

## Code improvements implemented
1. `PublicGameJoin`: on-demand chunk for expensive join/payment dialog; do not render until opened.
2. `PublicPlaygroundPage`: on-demand chunk for expensive game-creation/booking dialog, including conditional rendering only after opening.
3. Venue hero photos: explicit dimensions, eager/high priority and async decode for above-the-fold media. Gallery lower on page remains lazy.
4. Court list and location card thumbnails: dimensions, async decoding, native lazy loading.
5. Game share-page thumbnail: stop lazy-loading above-the-fold small image, reserve dimensions.
6. Academy directory: visible SSR H1 and clear introduction.
7. Court-owner landing: concise truthful English and Arabic meta descriptions.

## Exit checklist
- Confirm Build/TypeScript pass and latest deployment READY.
- Browser-test opening both modal dialogs, player join/payment and court booking (staging/test orders only; no actual charge).
- Re-run Lighthouse with funded credits or alternative lab tooling and compare consistent mobile settings.
- Expand crawl page cap only when needed; prioritize orphan/deep pages and actual page conversion.
