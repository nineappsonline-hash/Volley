# Playza GA4 conversion tracking

## Configuration and audit

Measurement ID **G-XJPEX3WY2B**, existing root `src/app/layout.tsx`, one Google gtag.js script and one bootstrap, both `afterInteractive`. No GTM container, business events, attribution persistence, conversion deduplication, CMP or consent-mode defaults were present in the audited code. The 3D game analytics bridge remains unchanged: its DOM/dataLayer object events are separate from GA4 business conversions.

The existing tag and destination remain. `send_page_view:false` prevents its automatic initial page view; `BusinessAnalytics` sends one sanitized page view per pathname navigation. Configure the stream's enhanced measurement as described below to prevent a second automatic history page view. No bookings, prices, payments, signup requirements, database schema or server permissions were changed.

## Event definitions

| Event | Trigger and confirmation | Context |
| --- | --- | --- |
| `game_view` | Valid public/invite details render, authenticated invitation displays, or dashboard card details expand. Not every list impression. Once per game per loaded document. | Sport and curated location, where present |
| `join_game_click` | User activates a join/waitlist button, before authentication redirect or join dialog. Not the payment button. | Sport and curated location |
| `game_registration_completed` | Existing successful join mutation returns non-waitlisted, then a read confirms the current account has a saved non-waitlisted seat with a committed share (`pending`/`approved`, not `unpaid`). Card checkout return triggers the same verifier only after server-confirmed `paid` status. | Sport and curated venue location |
| `player_signup_completed` | New authenticated member and persisted profile with required phone, gender and birth date. Email-pending, missing profile fields, existing Google accounts, failed or obfuscated duplicate-account signup responses do not count. No profile field values are sent. | Method, intended sport/location |
| `academy_view` | Published academy details render or a training group's details expand. Once per academy per loaded document. | Academy/group sports and curated location |
| `academy_registration_click` | Academy join button or monthly/trial reservation button, including guest sign-in redirects. | Sport/location and registration type when available |
| `academy_registration_completed` | Membership RPC returns `true`, followed by a read confirming the account's academy, or a successful training reservation plus persisted booking read. New signup with a valid academy invite code also confirms membership after profile creation. | `registration_type=academy_membership` or `training_reservation`, sport/location |
| `venue_registration_started` | Court-owner registration form opens. Once per tab journey, including refresh/remount deduplication. | Last relevant intent |
| `venue_registration_completed` | New court-owner signup is authenticated and saved profile role is `playground_owner`. | Owner's selected location and sport context where available |
| `academy_owner_registration_started` | Academy-owner signup mode opens. Once per tab journey. | Last relevant intent |
| `academy_owner_registration_completed` | New academy-owner signup is authenticated with a saved admin profile linked to its academy. | Selected sports/location and method |

**Definitions matter:** game registrations count secured registrations, not revenue or payment approval. A waitlist is not a completed registration. Academy memberships and training reservations are separate genuine actions; always split the academy report by `registration_type` rather than interpreting their sum as distinct customers. A training reservation is not a paid conversion. Venue and academy owner completions count new owner-account registrations, not every later court/academy listing or subscription purchase. Venue listing is optional in the existing owner signup form.

## Attribution and privacy

- The shared helper uses the existing gtag Arguments queue; no additional analytics script or SDK.
- Stores the first entry page and acquisition context for a same-tab journey (30-day expiry). Explicit new campaign tags start a new journey; ordinary internal navigation, login, signup, OAuth, email confirmation in the same tab, and reloads retain it. Campaign metadata is restored into the sanitized GA page location, without changing actual application/navigation URLs.
- Accepts operational `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_content` identifiers (letters/digits/underscore/hyphen, starting with a letter, max 64, rejecting contact-like strings). `utm_term` accepts recognized sports only; arbitrary user search terms are omitted. Campaign naming must never contain personal information. Rejected unsafe tags are intentionally not preserved to GA.
- Every custom event has `entry_page`, `journey_source`, `journey_medium`, optional `journey_campaign`, and a sanitized page location/title/referrer. GA's native session acquisition dimensions remain the source of truth for session reports; `journey_*` is the saved public-entry context for longer registration journeys.
- Only known sport categories and location suggestion values are sent. Free-form addresses, venue/academy/game/person names, coordinates, exact ages, profile values, user IDs, invite codes, redirect URLs, receipts, payment IDs, booking IDs, amounts and transaction data are excluded. Record IDs are used only as local deduplication inputs and SHA-256 hashes; not event payloads or GA `user_id`.
- Dynamic URLs are grouped as `/games/detail`, `/a/detail`, etc. This deliberately sacrifices per-record page reporting to avoid transmitting arbitrary slugs or identifiers. Page titles are generated from those safe paths, never read from the document title. Only the referrer origin is kept; OAuth and payment-provider referrers are excluded.
- Completion deduplication uses event + account + registration identity in hashed localStorage keys, with an in-memory guard and Web Locks where available. Refreshes, navigation, repeated callbacks, remounts and concurrent tabs in the same browser do not repeat a completion while storage is retained. Starts use a tab session key; views use document memory. Later leave/rejoin of the same game is deliberately not a new acquisition conversion.
- Respects `ga-disable-G-XJPEX3WY2B`, explicit `window.playzaAnalyticsConsent='denied'`, Do Not Track and Global Privacy Control. Does not grant consent or introduce a consent banner. A future CMP must set its existing Google consent state **before the bootstrap**, set `playzaAnalyticsConsent` consistently, and suppress/re-enable collection according to policy. Existing Google consent commands are not overridden. Default behavior follows the pre-existing tag setup; this implementation does not claim that a new consent policy was agreed.
- Browser collection can undercount ad blockers, offline failures, consent denial, cross-device/new-tab email confirmation, unavailable/cleared storage and people who finish checkout without returning. No claim of global exactly-once delivery: GA/network delivery is not a transaction, and local deduplication cannot replace database reporting. No historical conversions are backfilled. Existing sign-ins and browsing are never inferred to be new signups.

## Required GA4 property setup (manual)

No authenticated GA4 Admin/Data API connection is available in this workspace; these property settings and reports have **not** been changed remotely.

1. Select the property whose web stream measurement ID is **G-XJPEX3WY2B**. Admin → Data collection and modification → Data streams → select Playza web stream.
2. Enhanced measurement → settings gear: disable **Page views → Page changes based on browser history events**. The code owns initial and SPA page views. Disable **Form interactions**, **Outbound clicks**, **Site search** and **File downloads** unless separately reviewed: automated parameters may include user-entered text, contact URLs, receipt/file names or sensitive queries. This is essential to avoid duplicate automatic page views and independent enhanced-measurement collection outside this allowlisted helper.
3. In the same web stream, configure **Redact data**: enable email redaction and redact sensitive URL parameters used by the app (`email`, `phone`, `name`, `code`, `token`, `access_token`, `refresh_token`, `join`, `order`, `redirectedFrom`, `next`, `focus`). This is defense in depth; application events already sanitize URLs.
4. Google tag settings → **List unwanted referrals**: add the actual payment checkout domains (`payments.kashier.io` and any configured checkout subdomains) and `accounts.google.com`. Do not classify normal third-party referral traffic as unwanted.
5. Admin → Data display → **Custom definitions** → Create custom dimension, scope **Event**. Register `sport`, `country`, `governorate`, `city`, `registration_type`, `method`, `entry_page`, `journey_source`, `journey_medium`, `journey_campaign`. Display labels can be human readable. Do not register personal or high-cardinality account/booking identifiers. Sport values are canonical slugs; multi-sport selections are comma-separated sorted category combinations (do not add their filtered totals as unique people).
6. Admin → Data display → **Events**. For each completion event below, find it under Recent events and select its star to mark it as a key event. To pre-create one before traffic arrives, use **Create event**, enter the exact event name, enable **Mark as key event**, choose no default monetary value and **Once per event**, then click **Create**. Do not add a derived event that copies the same event name or deploy another tag. Where the UI offers a separate Key events/New key event control, entering the exact existing event name has the same purpose.
7. Mark **only these five**: `player_signup_completed`, `game_registration_completed`, `academy_registration_completed`, `venue_registration_completed`, `academy_owner_registration_completed`. Use **Once per event**, so multiple distinct game/training registrations within a session can be measured; application deduplication handles repeats. Do **not** mark `page_view`, views, clicks or registration starts as key events. Do not create Google Ads conversions unless separately requested.
8. Custom definitions/key-event changes are not retrospective. Allow standard processing (typically 24–48 hours) before expecting full custom-dimension reports; Realtime/DebugView are the immediate validation tools.

## Reporting recipe

Set the property reporting timezone to the agreed Playza business timezone (Africa/Cairo), if it is not already set. Preserve the current setting unless explicitly approved. Use consistent date ranges; compare to the database's date/time boundaries.

**Organic traffic**: Reports → Acquisition → Traffic acquisition. Primary dimension **Session primary channel group** (some properties call it Session default channel group); filter **Organic Search**. Show Users, Sessions, Engaged sessions. Use **Session source / medium** as secondary dimension for Google/Bing breakdowns. Do not use First user source to describe current-session organic traffic.

**Five organic registration reports**: customize or create an Exploration using the same Organic Search session segment. Show Event count/Key events filtered to each exact completion event. These measure:

| Report | Event filter | Additional split |
| --- | --- | --- |
| Organic player registrations | `player_signup_completed` | method |
| Organic game registrations | `game_registration_completed` | sport |
| Organic academy registrations | `academy_registration_completed` | registration_type (membership vs training) |
| Organic venue owner registrations | `venue_registration_completed` | location |
| Organic academy owner registrations | `academy_owner_registration_completed` | sport/location |

**Conversion rates by landing page**: Reports → Engagement → Landing page, add Sessions, Key events and **Session key event rate**. Select one specific completion event in the key-event metric selector rather than All events. Explore by `Landing page + query string`, which is privacy-sanitized by this implementation. To measure the original entry across a longer public → signup journey, create an Exploration with `entry_page`, `journey_source` and `journey_medium`; do not equate this first-journey view with native per-session landing attribution.

**By acquisition source**: Traffic acquisition with **Session source / medium** and per-event Session key event rate. Use native GA session dimensions for organic reports, and `journey_source`/`journey_medium` as a separate saved-journey breakdown. Never mix first-user, session, and event attribution scopes as the same metric.

**By sport**: Explore → Funnel exploration. Closed funnel: `game_view` → `join_game_click` → `game_registration_completed`; academy funnel: `academy_view` → `academy_registration_click` → `academy_registration_completed` (split/filter registration_type). Breakdown by custom `sport`. Owner funnels: corresponding started → completed. Show completion and abandonment rates. Sport is an event-scoped context, not a session property; use funnel completion rates/unique users rather than dividing raw events by all site sessions. Multi-sport combinations are their own category; filter contains a sport for overlapping category analysis, without adding overlapping counts.

**Signup journeys**: Funnel `page_view` of landing → `page_view` of signup → `player_signup_completed`, with saved `entry_page` / `journey_medium` breakdowns. A signup is not the same as joining a game/academy: keep those later registrations separate.

Save these explorations/report customizations to the property's Library for the team. Choose the single event being evaluated when showing conversion rate. For a manual table, define rate explicitly as sessions with the selected key event ÷ eligible sessions, or unique funnel finishers ÷ unique funnel entrants; raw conversion event count ÷ sessions can exceed 100% and is not a session conversion rate.

## Files changed

- `src/app/layout.tsx`: existing tag bootstrap, privacy-safe initial defaults and ordered event queue; mounts the shared client tracker.
- `src/lib/analytics/events.ts`: GA bridge, parameter allowlists, safe page context, UTM journey, opt-outs and durable completion deduplication.
- `src/lib/analytics/registrations.ts`: read-only signup/game/academy confirmation and saved registration intents.
- `src/components/analytics/business-analytics.tsx`: SPA page views, auth-session confirmation, detail views and owner-form starts.
- `src/lib/auth.ts`, `src/components/auth/complete-profile-form.tsx`: signup lifecycle and Google profile completion hooks.
- `src/components/auth/signup-form.tsx`, `src/components/auth/owner-signup-form.tsx`: academy-owner and venue-owner registration starts.
- `src/lib/queries.ts`: successful game/academy mutation hooks (existing inputs, outputs and business rules retained).
- `src/components/games/game-card-shell.tsx`, `games-client.tsx`, `public-game-join.tsx`, `shared-game-page.tsx`: views, expansions and join intent across public/invite/dashboard entry points.
- `src/app/payment-result/page.tsx`: read-only confirmation after the existing paid-status check.
- `src/app/a/[slug]/page.tsx`, `src/components/academies/join-academy-button.tsx`, `academies-directory.tsx`, `join-academy-suggestion.tsx`, `training-booking.tsx`: academy discovery, intent and successful reservation instrumentation.
- `tests/ga4-conversions.cjs`, `tests/ga4-registration-hooks.cjs`: event, timing, privacy and deduplication coverage. `tests/member-template-render.cjs`: add the new effect to its existing mocked React hook harness.
- `docs/ga4-implementation-plan.md` and this guide: audit, implementation plan, configuration, event contract, reporting and manual property setup.

## Validation

- `node tests/ga4-conversions.cjs`: all eleven events, privacy, UTM persistence, successful/failed confirmation, new/existing Google users, email confirmation, missing profile/academy, unpaid/waitlisted game seats, storage reload deduplication, opt-outs and one tag.
- `node tests/ga4-registration-hooks.cjs`: executes the existing Auth, academy membership and game mutation functions against mocked success/failure responses; verifies completion hooks run only after success without changing results.
- Regression suite: `tests/*.cjs`; TypeScript (`npx tsc --noEmit`), lint (`npm run lint:check`) and production build (`npm run build`). See the task's final report for results.
- Browser QA must block/intercept `googletagmanager.com` and GA collection endpoints while inspecting `window.dataLayer`, so automated test events are not sent to production GA. Check initial page view once, public game view, guest join → auth redirect, owner start events and navigation/refresh deduplication. Auth/payment success paths use mocks; no real paid bookings, accounts or receipts are generated by the tests.
- After the manual GA setup, use a QA browser with Google Tag Assistant/GA Debugger and granted analytics consent. Admin → Data display → DebugView: confirm the sequence and parameter allowlists. Failed signup, failed RPC, waitlist, unpaid seat, old Google login, failed/expired checkout and refresh of a completed journey must add **zero** completion events. Repeat a successful completion callback; confirm it is still one event. Validate Realtime acquisition with a non-personal tagged QA campaign. Do not treat a dataLayer assertion as proof of receipt in GA: live DebugView validation remains manual without property access.

Official references:
- https://developers.google.com/analytics/devguides/collection/ga4/events
- https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
- https://support.google.com/analytics/answer/13128484 (key events)
- https://support.google.com/analytics/answer/9216061 (enhanced measurement)
- https://support.google.com/analytics/answer/13544947 (data redaction)
- https://support.google.com/analytics/answer/14239696 (custom dimensions)

## Completed validation — 2026-10-22

- All **66** repository test scripts passed (`tests/*.cjs`), including both new GA4 suites and the updated inline-card render harness. Safe UTM campaign ID/content/sport-term retention also passed the targeted rerun.
- `npx tsc --noEmit`: passed after production build regenerated Next.js type artifacts.
- `npm run lint:check`: passed, zero warnings/errors.
- `npm run build`: passed, including production compilation and generated routes.
- Production-build browser smoke test at mobile width: passed single tag/configuration, one initial page view, actual public game detail view, guest Join → login redirect, saved UTM journey, both owner form starts, refresh deduplication, no false completions, and no JavaScript errors. Google scripts/collection endpoints were intercepted; no QA events were transmitted to the live GA4 property. Success/failure completion paths were validated with mocks, without creating accounts or paid bookings.
- GA4 Admin settings, report creation and actual DebugView receipt remain manual as described above; this report does not claim remote GA property configuration or network delivery verification.
- Final attribution safeguards: entity events do not borrow an unrelated prior entity's sport; member signup snapshots its intended context. Email signup requires the account ID returned by a successful signup response before authentication/profile checks may emit a completion. Both tracking suites, the production build, strict lint, TypeScript and intercepted browser QA passed again after these safeguards.
