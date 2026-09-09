# Academy monthly training and tryout pricing

Apply `supabase/migrations/20260909030000_academy_training_prices.sql` before deploying. The same migration is appended to the consolidated schema.

Academy admins use **Settings → Member training prices**. Platform admins use **Academies → Edit → Member training prices**. Both use the dedicated **Save training prices** button.

Set sessions per month (1–100), monthly price in EGP, and the price of one tryout session. Monthly count and monthly price must be set or cleared together. Blank means unset; zero is a free offering. Prices are saved to two decimal places. Existing academies start unset; no prices are inferred from past payments or Full/Half plans.

Published academy pages at `/a/<slug>` display the configured monthly offering and tryout price. These are advertised prices; saving them does not alter historical payments, purchased memberships, or automatically create training sessions. Flexible membership plans remain available separately.

The RPC permits active administrators of the relevant academy and platform super admins, and denies blocked or anonymous callers. A trigger also guards pricing changes through direct table updates. Database constraints enforce nonnegative prices and a complete monthly offering.

Validation includes TypeScript, production build, and isolated PostgreSQL tests for save/edit/clear, free tryouts, invalid data, academy isolation, ordinary-member direct-write denial, super-admin access, and blocked/anonymous callers. Live Supabase is not modified by these tests:

```sh
npm install --prefix /tmp/qr-validation @electric-sql/pglite
NODE_PATH=/tmp/qr-validation/node_modules node tests/academy-training-prices.cjs
```
