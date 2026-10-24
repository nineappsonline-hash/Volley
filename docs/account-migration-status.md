# Playza account migration — 24 October 2026

## Current state

The separate destination infrastructure is provisioned and the initial copy has been validated. **The live domain has not been switched.** The source remains authoritative while Google OAuth configuration, GitHub access and the final synchronization are pending.

- Source Supabase project: `wknaiyouwjobmzzjoutz` (`Volley`, eu-west-1).
- Destination Supabase project: `jqysnlkykznwdonicwsm` (`Playza`, eu-west-1), in the new account's organization.
- Destination Vercel project: `playza`, scope `9apps`, project `prj_ynczLkR3zLEp2wukUvevUy2yJJf9`.
- Initial validated deployment: `https://playza-azure.vercel.app`, deployment `dpl_AUiTAYZbdh1NQFBt1kFUswkb18eA`.
- Intended retained production domain: `playza.nineapps.online`.
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
- The nine actual Vercel production application environment variables were exported through `vercel env pull`, configured in the new project, and adjusted to the new Supabase URL and keys. API environment listings may contain encrypted values; these must not be mistaken for plaintext exports. Payment-provider configuration was preserved; no real booking, payment or notification was generated during QA.

## Validation

The destination Vercel production build passed compilation, lint/type validation and route generation. A read-only mobile browser check returned HTTP 200 for `/`, `/dashboard`, `/login` and `/games/beach-volleyball`, without horizontal overflow, captured JavaScript errors or failing Supabase responses. Browser requests used only the new Supabase host. Analytics requests were intercepted so QA did not send events to the production GA4 property.

This is an initial snapshot validation, not a claim that later source writes have already been synchronized or that end-to-end Google login has been completed. Existing browser sessions can require signing in again after the project change; preserved accounts retain their passwords and IDs.

## Pending external setup

1. In the existing Google Cloud OAuth **Web application** client, add this Authorized redirect URI while retaining the original:
   `https://jqysnlkykznwdonicwsm.supabase.co/auth/v1/callback`
   Use Google Auth Platform → Clients. The exact new callback must be accepted before production Google sign-in is switched.
2. In `https://vercel.com/9apps/playza/settings/git`, connect `jimmydodo/Volley` through the authorized GitHub account and select production branch `main`. The initial CLI deployment succeeds independently; automatic Git deployments are not yet verified.
3. A temporary read-only staging guard and disabled destination signup were proposed to prevent shadow bookings/accounts before cutover. Automatic approval review rejected the broad database guard without explicit authorization. **No such guard or signup restriction was applied.** A user decision is pending. Destination background jobs remain inactive.

## Cutover sequence — not executed

1. Verify the external OAuth callback, destination deployment, repository connection and chosen staging restrictions. Snapshot the existing domain bindings and production deployment for rollback.
2. Coordinate a brief source-write freeze or equivalent controlled synchronization window. Retake the source database/storage snapshot and synchronize all changes since the initial copy. The source must remain authoritative until this completes; do not simply switch an old snapshot live.
3. Recheck account/password digests, counts, storage hashes and ownership, constraints, RLS, Realtime, authenticated access and payment/notification configuration against that final snapshot. Remove any explicitly authorized temporary destination staging restrictions at cutover.
4. Move the retained hostname to the new Vercel project only after those checks pass. Verify HTTPS, public pages, password/Google login, private receipts and application reads against the new backend.
5. Activate the seven destination jobs and disable their source counterparts to prevent duplicate work. Re-link local deployment/Supabase CLI state and confirm future Git pushes deploy to the new account. Do not delete the old projects during cutover.
6. If checks fail, restore the recorded original domain binding and source scheduler state before accepting new writes on the new backend. Once new production writes begin, rollback also requires reconciling those writes; moving the domain back alone is not a safe data rollback.

## Private operational material

Backups, database passwords, account tokens, environment exports, downloaded files and per-file verification manifests are held outside the repository under a user-restricted temporary directory, `/tmp/playza-account-migration`. They are not included in this document or in Git. Preserve a secure backup outside temporary storage before decommissioning the old projects. Account tokens shared for this operation should be rotated after migration and verification are complete.

## References

- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://vercel.com/docs/git/vercel-for-github
