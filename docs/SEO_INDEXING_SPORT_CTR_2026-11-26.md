# Playza Search Console indexing inspection and sports CTR release — 2026-11-26

## Sources
Google Search Console through the connected Playza OpenSEO property (`https://playza.life/`). URL Inspection reads Google's **stored last crawl** rather than a fresh live test. Search-performance window 2026-10-27 to 2026-11-23.

## Google index inspection (2026-11-26)
| URL | GSC index verdict | Last crawl | Canonical comparison |
| --- | --- | --- | --- |
| `/sports/volleyball` | Submitted and indexed | Nov 18 | Google and declared canonical match |
| `/ar/sports/volleyball` | Submitted and indexed | Nov 21 | Match |
| `/list-your-court` | Submitted and indexed | Nov 12 | Match |
| `/ar/play/beach-volleyball-new-cairo` | Submitted and indexed | Nov 12 | Match |
| `/courts?sport=basketball` | Submitted and indexed | Nov 11 | Match |
| `/for-courts/padel` | Unknown to Google | No crawl yet | Newly launched; cannot assess yet |
| `/ar/for-courts/volleyball` | Unknown to Google | No crawl yet | Newly launched; cannot assess yet |

Google reported mobile crawler and allowed robots for the five indexed pages; breadcrumb rich results verdict PASS for those pages. No live HTTP proof is implied.

## Implemented code changes
- Improve English volleyball page search title to directly address joining without a team; rewrite both English and Arabic snippets to be accurate and clickable.
- Correct malformed Arabic snippets for volleyball, basketball, padel and beach volleyball. Avoid misleading promises like being able to play 'today' without inventory.
- Extend indexable sport discovery pages with a **verified published past-games** section, when there are past approved games in Cairo, and prominent link to truly upcoming listings.
- Existing game detail archives retain historical dates and link to upcoming sport/locality games.

## Next measurable checks
- Compare `/sports/volleyball` impressions/clicks/CTR after Google crawls updated text; do not interpret 51 impressions and 0 clicks as a statistically significant CTR baseline.
- Inspect sport snippet query/page matches and title rendering, then decide whether to add further intent-specific wording.
- Reinspect the six new owner-sport URLs for discovery and sitemap; include real owner registrations as the conversion outcome.
- Validate actual production HTML status, metadata, canonical, and sitemap plus signup/booking journeys in a browser or site crawler.
