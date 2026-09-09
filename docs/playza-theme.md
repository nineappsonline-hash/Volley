# Playza color system

The website uses Playza navy, green, blue and orange through the existing shadcn/Tailwind theme. The app is branded Playza. The shared AppLogo component displays the original root Logo.webp from public/logo.webp; the matching root favicon.png is served from public/favicon.png. Product behavior is unchanged.

- `src/app/playza-palette.css`: core colors and derived shades. HSL channels support Tailwind opacity modifiers. Light shades mix with white; dark shades mix with navy.
- `src/app/globals.css`: semantic light/dark tokens, persistent navy navigation and notification colors.
- `tailwind.config.ts`: utility bindings. Use semantic colors (`success`, `warning`, `info`, `destructive`, `*-ink`) for states; use the derived scales only for subtle backgrounds and gradients.
- `src/lib/brand.ts`: matching brand values for email, PDF and browser metadata; shared CSS-based chart colors.

Navy anchors headings and navigation; blue marks interaction and selection; green identifies successful payments and progress; orange flags attention. Error actions use a darker derived red so white labels remain readable. Small text on blue uses a darker navy foreground for contrast. Charts use theme-aware colors, and map markers retain white details in both themes.

Coverage includes shared controls, dashboard and platform administration, member/family profiles, academies, games/community, bookings/rentals, calendars, reports/charts, subscription/checkout screens, authentication, marketing pages, emails and exported PDFs.

Validation: production build and TypeScript checks pass. Core normal-text color pairs were checked against 4.5:1 contrast, including semantic inks, button labels and navigation. Browser previews are supplemental; authenticated workflows still need a live-session visual check. Existing unrelated edits remain in the workspace.
