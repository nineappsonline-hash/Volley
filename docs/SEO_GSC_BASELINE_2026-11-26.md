# Playza SEO baseline — Google Search Console (verified source)
**Collected:** 2026-11-26 · **Property:** `https://playza.life/` · **Window requested:** 2026-10-27 to 2026-11-23 (GSC data lag) · **Source:** Connected Search Console via OpenSEO, Arabic/Egypt market.

## Search performance
GSC `date` grouping returned data for 14 calendar dates in this window (including an empty first day). Across returned rows:
- **18 Google web search clicks**
- **355 impressions**
- **Approx. 5.07% overall CTR** (18 / 355); position must be weighted by impressions rather than averaged across page/query reports.
- Individual page or query grouping can omit anonymized/low-volume queries; **do not expect per-query totals to reconcile to the aggregate**.

## Observed landing pages (GSC by page)
| URL | Clicks | Impressions | Average position | Interpretation |
|---|---:|---:|---:|---|
| `/` | 7 | 27 | 4.9 | Branded/navigational intent likely mixed; separate non-brand in next report |
| `/sports/volleyball` | 0 | 51 | 8.5 | Strong exposure relative to other pages but zero clicks; prioritize title/snippet and relevant-game CTA |
| `/sports/basketball` | 2 | 16 | 9.4 | Existing discovery opportunity |
| `/sports/beach-volleyball` | 2 | 11 | 19.7 | Improving relevance and internal links may help |
| `/ar/guides/volleyball-cairo` | 1 | 15 | 9.8 | Connect to actual upcoming and historical volleyball games |
| `/ar/play/beach-volleyball-new-cairo` | 1 | 7 | 6.4 | Local landing already earns some search impressions |
| `/list-your-court` | 0 | 1 | 11 | Venue acquisition is a small current search footprint |
| `/games` | 0 | 2 | 6.5 | General games directory not yet receiving significant organic interest |
| `/courts?sport=basketball` | 0 | 38 | 14.9 | Evaluate canonical and intent competition with clean routes |
| `/games?sport=padel` | 0 | 30 | 38.7 | Improve taxonomy/targeting rather than make duplicate doorway pages |

## Keyword examples (query-grouped GSC)
- `playza`: 2 clicks, 7 impressions, avg position 5.
- `ملعب طايره`: 1 click, 1 impression (too small to generalize).
- `volleyball near me`: 0 clicks, 4 impressions, avg position 10.5.
- `basketball courts near me`: 0 clicks, 7 impressions, avg position 30.6.
- `tennis club near me`: 0 clicks, 7 impressions, avg position 6.9.
- `archery cairo`: 0 clicks, 5 impressions, avg position 7.4.

## Actions backed by the data
1. **Volleyball:** inspect `/sports/volleyball` search appearance and related queries. Improve click-worthy factual title/description, link to live games and archived games, then compare CTR after 4 weeks.
2. **Local player journey:** feature Arabic New Cairo volleyball/beach volleyball hubs from English/Arabic sport pages; maintain stable locale canonicals.
3. **Venue owners:** publish targeted, factual sport-specific owner pages; track organic owner signup. No prior Google demand implied by the two existing owner-page impressions.
4. **Canonical:** study `?sport=` URLs receiving exposure alongside clean /courts/[sport]/[location] routes. Avoid false assumptions that query parameter pages are always duplicates.
5. **Tracking:** inspect 15+ representative public URLs in Search Console; determine actual indexed and Google-selected canonical states. Track with source/time windows, not model-estimated rankings.
6. **AIO:** treat this GSC dataset as *traditional Google search*, NOT as a measurement of ChatGPT or Google AI citations.

## Access and caveats
OpenSEO project: https://app.openseo.so/p/61f15d32-23b4-4634-af4b-073c0c43e3a9
Search Console bound using the user's already-connected Google account with verified `https://playza.life/` property.
2026-11-26 code edits address the owner landing-page cluster; production deployment **dpl_GgLEUWuTzpu3giXzrBAqtRdUFJPe** reported READY.

This baseline measures outcomes observed *before* the new sport-specific owner pages were deployed; remeasure after indexing/crawling.
