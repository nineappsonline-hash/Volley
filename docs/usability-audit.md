# Playza usability audit — 9 September 2026

## Scope and evidence

Code-based review of the role navigation, dashboard layouts, member/parent profile, academy management entry points, public academy discovery, games/community, and shared dialog/tab components. Reviewed route/component inventory for members, teams, coaches, schedule, attendance, costs, reports, analytics, tournaments, playgrounds, rentals, events, marketplace, scouting, leaderboard, settings, subscriptions and platform administration. This is a navigation and usability review, not a security audit or a claim that every authenticated workflow was exercised in a browser.

## Implemented

| Finding | Change |
| --- | --- |
| Long flat menus made daily tasks compete with occasional configuration | Grouped academy navigation into daily operations, academy/training, finance/insights and settings. Grouped member navigation into training, discovery, community and membership. |
| Short screens could hide the bottom of the menu | The navigation region scrolls independently while the logo and account footer stay available. |
| Mobile drawer stayed open after choosing a page | Links close the controlled drawer, including same-page links. Arabic opens the drawer from the right. Added accessible menu/account names and active-page semantics. |
| Super-admin games entry was labelled Community | It now uses the Friendly games label. |
| Friendly games had two competing browsing/creation interfaces | Community now focuses on players and the discovery map, with a direct link to the dedicated Games page. The legacy component remains in source but is no longer mounted by Community. |
| Parents had to hunt through a long profile for family controls | My profile & family is an explicit navigation entry. Family controls moved ahead of evaluations; section shortcuts link to family, feedback, QR, payments and attendance. The member dashboard links directly to common tasks. |
| Academy operating cost appeared next to a member's subscription/payment information | Removed the internal cost figure and its query from the member profile and dashboard; personal payment values remain. This is a presentation change, not a database-permission change. |
| Destructive account controls competed with everyday profile content | Placed account deletion in a collapsed, clearly labelled account-management section. Confirmation behavior remains in the existing component. |
| Game cards repeated the full cost calculation | Cards keep the estimate visible with an expandable breakdown. Creation forms still show the calculation expanded. |
| Long forms could extend beyond the viewport | Shared dialogs have a viewport height limit and scrollable content. Shared tab bars wrap instead of forcing a single row. |
| Expired academy trial blocked the renewal pages too | Academy admins can reach Upgrade and Checkout and have a renewal button on the expired screen. Other gated routes retain the existing gate. |
| The standalone academy directory lacked an obvious return route | Signed-in visitors have a dashboard button; the logo links back to dashboard or the public home page. |

## Placement decisions

Reports and Analytics remain separate: financial reporting and attendance/performance analysis serve different tasks, but are grouped together. Playground inventory and rental transactions remain separate and adjacent. Academy Profile and Settings remain accessible because both currently contain live configuration workflows; merging their forms should account for their different save operations. Events (tournaments) remain distinct from Friendly games. Member platform subscriptions remain distinct from academy training packages.

## Validation and remaining review

TypeScript and production compilation are the automated checks for this change. No production records were altered, and no database migration is required.

Authenticated browser testing remains necessary for phone-size navigation in both languages, long-dialog scrolling with an on-screen keyboard, family/evaluation anchor navigation after data loads, and an expired academy's renewal flow. Live payment processing, camera permissions and realtime chat were not exercised in this audit. Long profile histories still render all loaded records; a later pagination change should include loading/error behavior and preserve access to older entries. Academy profile/settings duplication and consistent error/retry states across every list remain follow-up review areas rather than silently removed functionality.
