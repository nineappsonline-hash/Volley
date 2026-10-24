# Playza account migration — 24 October 2026

## Current state

**The Vercel hosting/domain move is complete.** `https://playza.nineapps.online` is verified on the new Vercel account and serves the validated new deployment. The website deliberately remains connected to the original live Supabase project, `wknaiyouwjobmzzjoutz`, so this hostname move does not switch databases or lose recent activity. The separate Supabase copy is provisioned and validated, but its final synchronization/backend cutover remains pending.

- Source Supabase project: `wknaiyouwjobmzzjoutz` (`Volley`, eu-west-1).
- Destination Supabase project: `jqysnlkykznwdonicwsm` (`Playza`, eu-west-1), in the new account's organization.
- Destination Vercel project: `playza`, scope `9apps`, project `prj_ynczLkR3zLEp2wukUvevUy2yJJf9`.
- Current hosting deployment: `https://playza-hs47i9lrk-9apps.vercel.app`, deployment `dpl_FZTiV8n5qHThp41srcJgnrwz6HKZ`. The custom production hostname is pinned to this deployment in the new account.
- The earlier initial-copy deployment `dpl_AUiTAYZbdh1NQFBt1kFUswkb18eA` validated the new Supabase snapshot; it is not the current live backend configuration.
- Retained live production domain: `playza.nineapps.online`. Its original Vercel project binding was released, and the new project binding is verified.
- No paid project/team transfer was used. The pre-existing paused destination Supabase project was left untouched.

## Copied and verified

- 88 application tables. Snapshot row counts matched across 119 backed-up application/auth/storage tables, with no count differences.
- All 89 authentication accounts and 89 profiles. Account IDs and saved password hashes matched the backup exactly; no password reset or user recreation was performed. Existing Google identities were included.
- All 139 uploaded files across the populated storage buckets: 158,216,935 bytes. Each copied file was downloaded again from the destination and checked against its source SHA-256 digest. All seven bucket definitions were retained, including empty buckets and private receipt buckets. Original file IDs, ownership and historical timestamps were restored and verified.
- All 280 application/auth/storage RLS policies matched the source. One custom auth trigger was restored. Anonymous access to a private receipt was denied, while public media remained accessible.
- Application Realtime subscription membership matched on all 13 source application tables. Platform-maintained retained broadcast partitions are managed independently by Supabase and were not treated as application tables.
- Supabase CLI migration history restored separately. Empty platform-owned vector metadata was excluded using the documented restore procedure; no source vector data was discarded.
- Google provider, email/SMTP and relevant authentication settings copied. No MFA-factor or Vault-secret records existed in the source, so there was no encrypted MFA/Vault payload to re-key.
- Both deployed Edge Functions (`notify-push`, `notify-email`) copied from the actual source deployment, with their original JWT verification settings. Six application notification settings were retrieved privately, hash-checked against the source and configured on the destination. Temporary migration helpers were deleted from the source; no helper endpoints remain.
- Seven scheduled jobs restored **inactive** to prevent duplicate notifications and housekeeping before cutover. Embedded old-project notification JWTs were repointed to destination keys.
- Nine Vercel application-variable names were inventoried. Protected/Secret values are not revealed by normal API/CLI exports: exported blanks must not be treated as working credentials. For the completed hosting move, the live Supabase URL/keys were verified through the source management API, the canonical URL was retained and payment settings were restored from the existing workspace configuration. An explicitly authorized temporary protected-settings deployment could not be created because the old Vercel account had an overdue balance; no such endpoint was left running. Exact equality with the old write-only payment settings could not be independently established, and no real card charge was tested. No booking, payment or notification was created or changed by QA.

## Validation

The current destination Vercel production build passed compilation, lint/type validation and route generation. A read-only mobile browser check returned HTTP 200 for `/`, `/dashboard`, `/login` and `/games/beach-volleyball`, without horizontal overflow, captured JavaScript errors or failing Supabase responses. The initial-copy browser check used only the new Supabase host. After the hosting-only cutover, a second check on the actual custom hostname passed the same four pages and confirmed requests use only the original live Supabase host, with no captured JavaScript errors or failing Supabase responses. Analytics requests were intercepted so QA did not send events to the production GA4 property.

This is an initial snapshot validation, not a claim that later source writes have already been synchronized or that end-to-end Google login has been completed. The completed hosting move keeps the original Supabase URL and authentication project. A later Supabase-project switch can require signing in again; preserved accounts retain their passwords and IDs.

## Remaining backend-migration setup

1. In the existing Google Cloud OAuth **Web application** client, add this Authorized redirect URI while retaining the original:
   `https://jqysnlkykznwdonicwsm.supabase.co/auth/v1/callback`
   Use Google Auth Platform → Clients. The exact new callback must be accepted before the Supabase backend is switched. It is not required for the completed hosting move because the original live authentication project remains connected.
2. In `https://vercel.com/9apps/playza/settings/git`, connect `jimmydodo/Volley` through the authorized GitHub account and select production branch `main`. The GitHub repository connection has now been verified in the destination Vercel project.
3. A temporary read-only staging guard and disabled destination signup were proposed to prevent shadow bookings/accounts before cutover. Automatic approval review rejected the broad database guard without explicit authorization. **No such guard or signup restriction was applied.** The user explicitly chose to keep the new copy writable, with signup enabled; no staging guard will be applied. Destination background jobs remain inactive.

## Remaining Supabase cutover sequence — not executed

1. Verify the external OAuth callback, destination deployment, repository connection and chosen staging restrictions. Snapshot the existing domain bindings and production deployment for rollback.
2. Coordinate a brief source-write freeze or equivalent controlled synchronization window. Retake the source database/storage snapshot and synchronize all changes since the initial copy. The source must remain authoritative until this completes; do not simply switch an old snapshot live.
3. Recheck account/password digests, counts, storage hashes and ownership, constraints, RLS, Realtime, authenticated access and payment/notification configuration against that final snapshot. Remove any explicitly authorized temporary destination staging restrictions at cutover.
4. The hostname is already on the new Vercel project; switch its application backend configuration only after those checks pass. Verify HTTPS, public pages, password/Google login, private receipts and application reads against the new backend.
5. Activate the seven destination jobs and disable their source counterparts to prevent duplicate work. The ignored local Vercel project linkage already points to the new project and GitHub is connected. Re-link Supabase CLI state only when its backend is cut over; the global Vercel CLI login was not changed for other workspaces. Do not delete the old projects during cutover.
6. If checks fail, restore the recorded original domain binding and source scheduler state before accepting new writes on the new backend. Once new production writes begin, rollback also requires reconciling those writes; moving the domain back alone is not a safe data rollback.

## Hosting cutover verification

Before reassignment, the original hostname returned HTTP 402 from the old Vercel account. The original alias metadata was saved privately. Only `playza.nineapps.online` was released from the old project; the old project, both databases and the parent domain were retained. The hostname was attached to the new project, verified and aliased to the ready deployment. Live HTTPS checks passed for `/`, `/dashboard` and `/login`; a mobile browser check additionally passed `/games/beach-volleyball`. Production GitHub connectivity is confirmed. No source database writes or scheduled-job changes were needed for this hosting-only move.

## Private operational material

Backups, database passwords, account tokens, environment exports, downloaded files and per-file verification manifests are held outside the repository under a user-restricted temporary directory, `/tmp/playza-account-migration`. They are not included in this document or in Git. Preserve a secure backup outside temporary storage before decommissioning the old projects. Account tokens shared for this operation should be rotated after migration and verification are complete.

## References

- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://vercel.com/docs/git/vercel-for-github
