# Playza account migration — 24 October 2026

## Current state

**The Vercel and Supabase cutovers are complete.** `https://playza.nineapps.online` now runs in the new Vercel account and uses the new Supabase project, including existing accounts, application records and uploaded files. No paid account/team transfer was used.

- New Supabase project: `jqysnlkykznwdonicwsm` (`Playza`, eu-west-1). [Dashboard](https://supabase.com/dashboard/project/jqysnlkykznwdonicwsm).
- New Vercel project: `playza`, scope `9apps`, project `prj_ynczLkR3zLEp2wukUvevUy2yJJf9`.
- Validated cutover deployment: `dpl_GnVNGCZGbTkAmFD7h6RJjbRWGgzx`, `https://playza-gk0d3vj1g-9apps.vercel.app`, built from commit `262cecef`. Later successful Git deployments may supersede it.
- GitHub repository `jimmydodo/Volley` is connected, with production branch `main`. Production and preview environment defaults now use the new backend.
- Local ignored `.env.local` and Supabase project/pooler linkage now target the new backend. Global CLI account logins were left unchanged; future Supabase CLI management requires authentication to the new account.
- The old Supabase project, `wknaiyouwjobmzzjoutz`, is retained with application writes paused and all seven scheduled jobs disabled. Do not point clients back to it without a controlled rollback.
- The pre-existing paused project in the new Supabase account was left untouched. The new Playza project remains writable with signup enabled, as requested.

## Data copied and verified

The initial copy included 88 application tables, authentication records, storage definitions, database functions, grants and migration history. Initial row counts matched across 119 backed-up application/auth/storage tables. All 280 application/auth/storage RLS policies matched; the custom auth trigger and all 13 application Realtime publication tables were retained. Empty platform-managed vector metadata was excluded; no vector data existed.

The final comparison found one additional source account/profile, source venue edits and a venue deletion, and two new uploads. A comparison against the initial snapshot showed no destination-only account/profile additions or conflicting venue edits. These changes were synchronized after the user explicitly authorized pausing writes and jobs on the old project. A first pause attempt encountered a protected internal migration table and rolled back atomically; the successful pause excludes protected platform migration tables.

At cutover:

- **90 authentication accounts, 90 identities and 90 profiles** matched, including account IDs and saved password hashes. No accounts were recreated and no password reset was performed.
- All application tables matched after normalizing old storage URLs to the new project. The updated source venue records and deletion were retained.
- **141 uploaded files**, totaling **162,685,422 bytes**, were present. The initial 139 files and the two additional files were downloaded from the destination and SHA-256 checked against their source bytes. Final paths, sizes, IDs and ownership matched across projects. Original ownership and historical timestamps were preserved without overwriting destination storage version metadata.
- All seven bucket definitions were retained, including public media and private receipt buckets. Initial access tests denied anonymous private-receipt access and allowed public media.
- The only remaining comparison differences were volatile auth sessions, refresh tokens, OAuth flow state and session authentication-method records created on the old project after the initial copy. These were not treated as new user accounts or portable live sessions. Users may need to sign in again; account IDs and passwords remain intact.

## Authentication, background work and configuration

Google provider and email/SMTP settings were copied. The user confirmed adding `https://jqysnlkykznwdonicwsm.supabase.co/auth/v1/callback` to the existing Google OAuth client. The new project's Google provider, client configuration, canonical site URL and enabled signup were checked. Full interactive Google/password login with a real user's credentials was not performed by automation.

Both deployed Edge Functions, `notify-push` and `notify-email`, were copied with their original JWT verification settings. Six notification secrets were copied privately and hash-checked. Temporary source helper endpoints were deleted. Embedded notification URLs/JWTs were repointed to the new project. The seven destination scheduled jobs were activated only after live checks passed; the source has zero active scheduled jobs.

Only the three Supabase environment variables changed during backend cutover. Existing canonical URLs and payment configuration were retained. Protected old Vercel values could not be exported through normal APIs, and the old account's overdue balance prevented the explicitly authorized temporary settings-export deployment. During the earlier hosting move, verified Supabase keys came from its management API and payment configuration came from the existing workspace settings. Exact equality with the old write-only payment values was not independently established. No real card charge was tested, and no payment or booking logic changed.

## Validation and live switch

The production build passed compilation, lint/type validation and route generation. It was staged without assigning production domains, then checked through Vercel's authenticated automation access. The latest committed super-admin fixes were included in a refreshed build before cutover.

Final read-only mobile browser checks on the actual custom domain passed `/`, `/dashboard`, `/login` and `/games/beach-volleyball`: all returned HTTP 200, with no horizontal overflow, captured JavaScript errors or failing Supabase responses. Requests used **only `jqysnlkykznwdonicwsm.supabase.co`**. Analytics requests were intercepted to avoid sending QA events to GA4. No test accounts, bookings or payments were created.

The Vercel CLI promotion reported a team-resolution error. Promotion succeeded through the API with explicit project/team IDs, and alias metadata confirmed the exact validated deployment. A check during propagation saw mixed old/new responses and a React recovery error; the subsequent fresh check passed with only the new backend and no errors.

These checks establish successful deployment and public application access; they do not substitute for a real user's interactive sign-in or a real payment-provider transaction.

## Retention and rollback

Both old projects remain available. The old database is intentionally write-paused so stale browser clients cannot create records in the retired backend. Administrative management access remains available, and the private pause rollback script records the original scheduler state. Do not unpause it for normal production activity.

The previous new-account deployment used the old backend and is recorded privately. Once the new backend accepts production writes, rollback requires reconciling those writes before restoring old database traffic. Simply reassigning a domain or restoring old environment values could lose new activity. The old Vercel account's billing error makes its original deployment an unsuitable hosting rollback target.

Backups, credentials, uploaded-file copies, comparison snapshots and rollback scripts are held outside Git under the restricted temporary directory `/tmp/playza-account-migration`. Preserve them in secure durable storage before deleting either old project. Tokens shared for migration should be rotated after verification. No secret values or personal records are included in this report or Git.

## References

- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
