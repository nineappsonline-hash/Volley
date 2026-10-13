# Playza color system

Shared tokens in `src/app/playza-palette.css` and `src/app/globals.css` extend the existing Tailwind/shadcn architecture. The application keeps its existing dark mode, responsive layouts and Arabic/English direction support.

| Role | Color |
| --- | --- |
| Navy / hover | #14213D / #0E182D |
| Primary action / hover | #C7F23D / #B4DF2D |
| Selection background | #F1FAD6 |
| Page / surface | #F6F8FA / #FFFFFF |
| Body / secondary text | #243247 / #64748B |
| Border | #E2E8F0 |
| Success / light | #15803D / #DCFCE7 |
| Warning / light | #92400E / #FEF3C7 |
| Error / light | #B91C1C / #FEE2E2 |
| Information / light | #1D4ED8 / #DBEAFE |

Use navy for headings and links, lime with navy labels for primary actions, white bordered secondary actions, and semantic error colors for destructive actions. Shared tabs and selected table rows use soft lime; sidebars use navy with lime active items and lighter navy hover states. Keep KPI cards neutral and semantic colors distinct from the lime brand accent. Charts use navy, lime, neutral and separate semantic series colors.

The supplied secondary ink measures 4.47:1 on the supplied page background, below normal-text AA. The muted foreground uses a slightly deeper shade (#627289) to pass on that background; the original secondary token remains available. Navy/lime is 12.32:1, navy/hover lime is 10.29:1, navy/soft lime is 14.75:1. All four semantic ink/light-background combinations exceed 4.5:1. Dark semantic inks use lighter shades. Keyboard focus uses navy on light surfaces and lime on dark navigation.

`src/lib/brand.ts` supplies matching constants for metadata, generated share cards, emails and PDFs. Original logos, photographs, Google sign-in artwork and sport illustrations are preserved.

Coverage includes public discovery, authentication, games, court and academy booking, payment controls, player/family dashboards, academy staff, venue owners, Super Admin management, shared forms, menus, dialogs, notifications, tables and calendars. These changes affect presentation only.

Visual validation uses real public routes plus isolated previews of actual shared sidebar/control components for player, academy staff, owner and Super Admin. Isolated previews do not exercise authenticated data or permissions. Full live-session dashboard and booking/payment interaction review remains outstanding.
