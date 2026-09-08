# Friendly-game player limits and estimates

Apply `supabase/migrations/20260909020000_game_cost_estimates.sql` before deploying the UI. Both game creation forms accept minimum/maximum player counts and duration in hours. Counts include the organizer. Minimum must be an integer of at least 2, maximum cannot be smaller, and duration must be greater than zero and at most 24 hours. The database validates these inputs too.

The estimate splits `playground hourly rental_cost × duration_hours` equally. The low estimate divides by maximum players, and the high estimate divides by minimum players. For 300 EGP/hour × 2 hours with 6–12 people, the total is 600 EGP and the range is 50–100 EGP each. The UI labels it an estimate, excluding the separate game-creation fee and extras. It does not charge members or reserve the playground.

The server snapshots the selected pool playground's hourly price at creation. Existing games retain an unknown price because their original rate/duration was not captured. Missing prices display unavailable, while a stored zero remains a valid zero-cost estimate. Weekly occurrences inherit the parent's limits, duration and price. The recurring roster lookup also now selects the latest occurrence by date rather than applying MAX to a UUID.

The playground picker selects explicit public columns so private contact-field restrictions do not break pricing queries. Game cards in both Friendly Games and Community show the estimate to creators and other members with access to the game.

Validation: TypeScript and isolated PostgreSQL/calculation tests. Run from the project root:

```sh
npm install --prefix /tmp/qr-validation @electric-sql/pglite
NODE_PATH=/tmp/qr-validation/node_modules node tests/game-costs.cjs
```

Tests cover migration reruns, invalid limits/durations, fixed price snapshots, recurring inheritance, unknown/zero prices, fractional duration, equal headcounts and range calculation. Live Supabase was not modified.
