# AI Coach Assistant + Academy Insights

Two integrated features shipped on top of the existing academy model:

1. **AI Coach Assistant** (`/coach-ai`) — generate, version, review and assign training plans, plus player development plans and post-session reports.
2. **Academy Insights & Predictions** (`/insights`) — a rule-based engine that produces explainable churn/utilization scores, KPIs and an alerts action center.

## Migrations

Apply in order in Supabase before the app is deployed:

- `supabase/migrations/20260918000000_ai_coach_assistant.sql`
- `supabase/migrations/20260918010000_academy_insights.sql`

Both are idempotent (`CREATE OR REPLACE`), enable RLS on every new table, and grant only `authenticated`. To roll back, drop the new tables/functions in reverse order; no existing table is altered or dropped.

### Tables

- AI coach: `ai_training_plans`, `ai_training_plan_sections`, `training_exercises`, `training_plan_versions`, `player_development_plans`, `player_development_goals`, `post_session_reports`, `ai_usage_log`.
- Insights: `academy_insights`, `prediction_scores`, `prediction_factors`, `academy_alerts`, `alert_actions`, `prediction_settings`, `dashboard_preferences`.

### Access model

- **Admins**: create/approve plans, manage all teams/players, change prediction settings.
- **Coaches** (`members` with a `coaches.profile_id` record): manage only their own teams and the players linked to their development plans.
- RLS + SECURITY DEFINER RPCs both enforce the scope; `resolveStaffScope` is used by the API routes. Coaches are never shown other coaches' or foreign-team plans.

## AI Coach Assistant

### Workflow

Plans start as `draft`, are `submitted` by the coach, `approved`/`rejected` with an optional note by an admin, and can be `archived`/`restored`. Editing locks past `approved` or `archived`. Plans can be duplicated, favorited, marked as templates, and assigned to upcoming training sessions. A post-session report can be attached to a plan, optionally drafted from coach notes by the AI.

### AI behaviour

- Provider-agnostic: `openai`, `anthropic`, or any `openai-compatible` endpoint (`AI_BASE_URL`).
- No `AI_PROVIDER`/`AI_API_KEY` set, or a failed call → deterministic safe fallback templates, so the module is a working manual workflow without keys.
- Structured outputs are validated with zod before anything is persisted; prompt inputs (titles, notes, names) are sanitized and treated as data, never instructions.
- Usage is accounted to `ai_usage_log` (tokens + estimated cost). A failure to log never breaks the request.

### Env vars (all optional)

`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_PRICE_PER_1K_PROMPT`, `AI_PRICE_PER_1K_COMPLETION`.

## Academy Insights & Predictions

### Engine

`recalculate_academy_insights()` (wrapper) → `recalculate_academy_insights_for(p_academy_id)`. Pure-SQL, `SECURITY DEFINER`, RLS-safe. A TypeScript mirror (`src/lib/insights/engine.ts`) documents the same rules; the SQL is the source of truth.

### Churn score (0–100), member level

| Factor | Weight | Contribution |
| --- | --- | --- |
| Payment recency | 35% | 0–100 from days-since-last-payment / `payment_gap_days` |
| Attendance (last 30 days) | 30% | `100 − att_rate_30d*100` |
| Attendance trend | 20% | `(baseline_rate − recent_rate) * 150`, capped 0–50 |
| Subscription usage | 15% | `used_percent − 50`, capped 0–100 |

Levels: `high` ≥ churn_high (70), `medium` ≥ churn_medium (40), `low` otherwise. Members with no recorded payments or attendance get a `not_enough_data` row (kept visible, never fabricated).

Every score persists an `explanation.score_components` array (factor, label, weight, contribution) and matching `prediction_factors` rows, so the UI can show "Why this score?" for audits with no extra queries.

### Other scores & KPIs

- `utilization_risk` per team = `100 − utilization%` where utilization is present-attendances / (team_size × sessions) over 45 days.
- `academy_insights` period metrics: `active_members`, `expected_paying_members`, `expected_revenue_next` (adjusted by churn probability × average spend).

### Alerts (deduplicated per period)

`no_attendance` / `payment_overdue` (per member, evaluated independently so one doesn't mask the other), `retention_trajectory` (high-churn members), `utilization_low` (per team), `revenue_drop`, `enrollment_decline` (academy-level). `prediction_settings.enabled_alerts` is a JSONB array; an empty array means all alert types enabled (same semantics as the schema default). The action center transitions alerts through `acknowledged → in_progress → resolved` and records `alert_actions` rows via `act_on_alert`.

### Settings

`set_prediction_settings(p_thresholds, p_enabled_alerts)` — threshold keys `payment_gap_days`, `attendance_gap_days`, `utilization_low_pct`, `revenue_drop_pct`, `churn_high`, `churn_medium`. Verified end-to-end in the tests (lowering `payment_gap_days` to 5 flags a previously-fine member).

## Tests

Isolated PostgreSQL tests run against `@electric-sql/pglite` (no live database needed); `@electric-sql/pglite` is a devDependency.

```sh
node tests/ai-insights.cjs
```

Covers the full AI plan lifecycle (save→versioning→submit→decide→edit-lock→duplicate→assign→report), dev plans, coach scope rejection (foreign team/player, anon), churn scoring + persisted factors, utilization, alert dedupe/idempotent re-runs, the action center, settings, and dashboard preferences. The migration bug fixes it validates: `v_can_edit` BOOLEAN→TEXT, JSONB vs TEXT[] `enabled_alerts`, empty-array = all-enabled, per-member multi-alert support, and temp-table scoping of the churn CTE.

Validation: `npm run typecheck`, `npm run lint:check`, and `npm run build` all pass; `/coach-ai`, `/insights`, and all `/api/coach-ai/*`, `/api/insights/*` routes build. Physical phone camera / deployed-database behavior was not exercised.