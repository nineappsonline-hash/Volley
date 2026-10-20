# Playza visual redesign: implementation plan and audit

## Existing architecture (before implementation)

- Next.js App Router: 79 page/layout files. Public content lives in `src/app` and marketing/public/academies/playgrounds components; authenticated shells share `src/app/(dashboard)/layout.tsx`, Topbar, Sidebar and MemberBottomNavigation. Guest browsing uses that same shell. Member, academy and platform-admin workspaces compose shared components.
- Tailwind configuration: `tailwind.config.ts`; shared palette entry: `src/app/playza-palette.css` (now imports canonical `public/playza-tokens.css`, also consumed by the standalone game); component roles, navigation and toast colors: `src/app/globals.css`. `src/lib/brand.ts` supplies non-CSS metadata/export colors and Recharts series.
- Shared primitives: `src/components/ui` (button, badge, card, tabs, input, textarea, form, checkbox, switch, select, dropdown, popover, sheet, dialog, alert-dialog, table, progress, skeleton, avatar, notifications).
- CSS modules: marketing landing variants, dashboard and member home, QR/check-in, app background and game controls. Other pages use Tailwind classes and inline/SVG presentation colors.
- Theme switching currently uses next-themes in Providers, ThemeToggle in Topbar and Sonner, a `.dark` variable block and component dark variants. This must be removed, including system preference behavior.
- Brand audit found repeated navy/lime literals (including opacity forms), navy navigation, blue interaction accents, duplicated CSS variables, chart series and older landing module palettes. Semantic error/warning/success/info colors must remain semantic.

## Implementation sequence

1. Centralize official color values, HSL opacity-compatible channels, purple scales and shared Tailwind aliases. Keep one light theme. Retain compatibility aliases only as references to the new palette, never duplicate literal palette definitions.
2. Remove dark-mode provider, toggle and variants; make notifications light. Preserve existing typography, RTL, reduced-motion and responsive structure.
3. Update shared buttons, controls, tables, cards, overlays, navigation and charts. Lime fill uses dark ink; purple text/controls remain legible on white. Destructive actions stay red.
4. Sweep public pages, both landing variants, listings, authentication and booking UI; use a deep-purple landing hero and white/lime typography.
5. Sweep member, academy and super-admin screens, nested pages and modals using the shared tokens. Audit direct color literals and inline/SVG UI styling, including QR and game controls.
6. Validate token contrast, absence of theme switching, responsive/RTL presentation and shared component behavior. Run existing tests, lint, TypeScript and production build. Verify no logo assets or business/auth/API/database/payment files were changed for behavior.
7. Commit only this task, push main and verify production deployment. Record changed areas, validation evidence and any visual limitations.

## Scope safeguards

The existing logo artwork and its display component stay unchanged. Sports photos, avatar artwork, QR encoding and 3D scene/environment/character art are content rather than UI themes and are preserved. No database, authentication, API, permission, route, pricing or booking behavior changes. Existing actions, route targets, form handlers and chart data are preserved; only presentation and the explicitly requested removal of theme switching change.

## Implementation record

- Canonical palette: `public/playza-tokens.css`, imported through the existing app CSS entry and by the standalone beach-game stylesheet. All official colors and hover values have exact-color assertions. Legacy navy aliases now resolve to purple; they do not define another palette. `src/lib/brand.ts` mirrors colors only for non-CSS email/PDF/browser metadata consumers.
- Shared surfaces: global light background, white cards/popovers/tables, neutral text, purple focus/selection, purple secondary controls and lime primary CTAs. Tables use light-purple header/selected-row accents. Status colors retain their success/warning/error/info meanings.
- Navigation and theme: academy/admin sidebars use deep purple with purple active items and lime indicators. Theme provider, dependency, toggle and dark utilities were removed. Saved dark preferences are cleared and notifications always render light.
- Public experience: both landing style modules, purple homepage hero, lime CTA, sports illustrations, public listings, registration/login, checkout, game cards and the standalone game's UI use the shared palette. The ambient page backdrop is now static and restrained.
- Member experience: live-game lists, capacity bars, sport selection, photo activity cards, training, games, profile, parent views, upgrade controls, chat and navigation inherit or explicitly use the new tokens.
- Academy experience: overview, members, attendance, schedules, booking/availability dates, evaluations, financial/reports/analytics, subscriptions and settings receive the shared surfaces and controls. Selected booking dates and attendance checkboxes are purple. Existing selected-time primary controls remain lime.
- Super-admin experience: the shared shell, management tables, record tabs, details, approval dialogs, alerts and analytics use the same system. Chart series use purple, lime and light purple; chart data and labels are unchanged. Destructive actions remain red.
- Preserved content: all tracked logo assets and the AppLogo component match the original bytes. Existing sports photos and character/environment artwork remain content assets, including the approved modest sports clothing.

## Validation and scope limits

The full regression suite passed (58 files), followed by six affected calendar/attendance/admin checks after the final control adjustments. Exact palette values and accessible text pairs are tested in `tests/brand-palette.cjs`. A TypeScript AST comparison confirmed unchanged hrefs, event handlers and form states across 72 modified React files. No database migrations, RLS, auth logic, API request handling, payment processing or route targets changed. The game-share image endpoint has one presentation-only background adjustment.

Browser checks use the production build at mobile and desktop widths with an emulated dark system preference and a saved dark preference, in English and Arabic. Authenticated member/academy/admin feature coverage comes from the existing component/regression harnesses; live owner/admin sessions are not part of this visual review. Third-party content, uploaded photos and 3D scene art intentionally retain their own colors.

Final verification: the optimized production build, lint/type checks and all 16 English/Arabic mobile/desktop browser cases passed. Every browser case retained `#F8F9FC` body background with a light color scheme despite dark system/stored preferences, and had no horizontal document overflow. Arabic bottom-navigation labels are constrained to their own cells.
