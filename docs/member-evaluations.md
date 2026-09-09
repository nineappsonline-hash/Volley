# Member and parent evaluation visibility

Apply `supabase/migrations/20260909040000_evaluation_visibility.sql` before deploying. The consolidated schema also includes the policy changes.

Members open Profile to read evaluations. Parents open Profile → Family → their child's profile. Both views show assessment dates, coach attribution where available, technique/tactics/fitness/attitude scores out of five, averages, and written feedback. The latest assessment is compared with the previous one per skill. The first assessment establishes a baseline. These are changes in recorded coach ratings, not a separate objective measure of athletic improvement.

Academy admins continue to record feedback from the member's evaluation card, selecting the coach. This change does not create coach login accounts. Members and parents receive a read-only view. Database policies remove broad academy-member write access and allow self/guardian reads plus active academy-admin management within their academy.

The query sorts by assessment date, creation timestamp, then ID for consistent comparisons. Open evaluation cards subscribe to database updates and periodically refresh as a fallback. Loading and failed requests have separate states.

Validation: TypeScript, production build, and isolated PostgreSQL tests for self/guardian reads, unrelated members, cross-academy admins, member write denial, authorized editing, and anonymous access. Live Supabase and live two-account Realtime delivery have not been tested.

```sh
npm install --prefix /tmp/qr-validation @electric-sql/pglite
NODE_PATH=/tmp/qr-validation/node_modules node tests/evaluation-visibility.cjs
```
