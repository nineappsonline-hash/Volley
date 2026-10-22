# Playza GA4 implementation plan and audit

Audit before edits (2026-10-22): root `src/app/layout.tsx` loads gtag.js once with measurement ID `G-XJPEX3WY2B`, afterInteractive, default configuration and automatic initial page view. No business conversion tracking, UTM persistence, conversion deduplication, consent banner or consent-mode configuration was found. `src/lib/game/analytics.ts` is a separate 3D game DOM/dataLayer bridge; its object pushes are not gtag GA4 event commands. Keep that bridge intact.

Plan:
1. Reuse the single existing gtag/dataLayer. Add a typed allowlisted helper, privacy-safe page context, journey attribution and persisted completion deduplication. Retain the measurement ID; turn off the automatic initial page view in favor of one sanitized SPA page-view sender.
2. Instrument game details/expansions and join intent, successful seat registrations, academy details and enrollment, and both owner signup journeys. Completion hooks follow existing successful Auth/RPC/read responses; never change booking/payment decisions.
3. Carry attribution through same-tab login, signup, OAuth and reloads; confirm pending signup only with a new authenticated account and persisted profile. Do not count existing-account login, failed attempts, waitlists, or form views as completions.
4. Test event timing, failures, privacy, attribution, reloads/navigation, and all audiences using mocked successful/failed APIs. Run TypeScript, lint, regression tests and production build. Document GA4 key-event/report setup; no GA4 admin credentials are connected.

No schema changes or payment/booking behavior changes are planned. Browser analytics necessarily undercount blocked/declined tracking, cross-device confirmation, and browsers with cleared/unavailable storage; GA4 is not the registration ledger.
