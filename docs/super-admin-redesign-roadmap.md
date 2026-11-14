# Playza Super Admin — Implementation Roadmap

Branch: `feature/playza-ui-ux-overhaul`. Preview only. No production deployment or merge without approval.

Figma: https://www.figma.com/design/HvqSzeaQHkYvwaOWzjI68X

## Objectives
- Daily action queue first, analytics second; task counts backed by actual queries.
- Clear persistent sidebar navigation, global search, responsive tables and details.
- Preserve current booking, payment, approval, and permissions behavior.
- Arabic/English, RTL/LTR, keyboard accessibility, mobile responsive.

## Phase 0 — Baseline and contracts (started)
- [x] Audit dashboard, records, analytics, payment reviews, approvals, messages.
- [x] Editable Figma concept: desktop command center and mobile overview.
- [ ] Verify data definitions and APIs for pending payments, unread messages, approvals, reports.
- [ ] Baseline screenshots, accessibility, load times, and existing workflows.

## Phase 1 — Admin shell and navigation
- [ ] Shared admin layout with grouped sidebar: Overview, Operations, Business, People, Finance, Support, Settings.
- [ ] Dedicated URLs with backwards-compatible redirects from `/admin?tab=...`.
- [ ] Header with breadcrumbs, search entry, refresh timestamp, language and account controls.
- [ ] Mobile drawer, active states, badges, keyboard/focus support.
- Acceptance: existing sections remain reachable, deep links work, RTL and mobile verified.

## Phase 2 — Command center
- [ ] KPI cards with explicit definitions and data sources.
- [ ] Action queue: payments, venue approvals, unread messages, open reports, expiring academy trials.
- [ ] Direct links to filtered queues; empty/loading/error states.
- [ ] Short analytics overview, with full analytics on a separate page.
- Acceptance: no fabricated values; counts match detailed queues; all actions navigate correctly.

## Phase 3 — Finance center
- [ ] Dedicated unified payment review surface for game shares, rent, subscriptions and academy training.
- [ ] Preserve payment-specific review and Kashier refund semantics.
- [ ] Filter/search, receipt preview, confirm actions, rejection reason, review history when supported.
- [ ] Separate calculated fees, approved amounts and settled funds.
- Acceptance: each payment type works in preview without regressions.

## Phase 4 — Entity management
- [ ] Members and academies: searchable sortable responsive tables; detail views.
- [ ] Games, tournaments, venues: list/table modes, useful filters and direct actions.
- [ ] Venue schedule: verify event end-times before calendar occupancy calculation.
- [ ] Server-side pagination and scoped queries where needed; retire monolithic records payload gradually.

## Phase 5 — Support and reporting
- [ ] Approvals and moderation work queues, review reasons, audit metadata.
- [ ] Messages: distinguish unread from resolved; assignment/status require backend support.
- [ ] Analytics: date ranges, comparison periods and validated metrics.
- [ ] Audit log and granular roles only after backend authorization design and migration review.

## Release gates for every phase
1. Figma design and mobile/desktop behavior documented.
2. Code isolated on feature branch, no production writes.
3. Typecheck/lint/build and Vercel Preview READY.
4. Test access control, RTL, keyboard navigation and critical payment flows.
5. User approval before production merge/deploy.

Note: all figures shown in the initial Figma mockups are illustrative, not live Playza data.
