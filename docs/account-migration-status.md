# Playza account migration — 24 October 2026

> Domain follow-up (10 November 2026): the application canonical domain is configured as `https://playza.life`, but the new domain is not reachable yet. The previous host already permanently redirects there. See the DNS blocker below; the account cutover described here is separate from domain readiness.

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

## Google sign-in follow-up — 25 October 2026

The public login starts Google OAuth against the new project, with the correct canonical `/auth/callback` URL, S256 challenge and saved verifier cookie. A read-only browser test intercepted the authorization request before it reached Google; no account was created or signed in. Redirect allowlisting and enabled-provider settings are correct, and the source/destination Google client IDs match.

The exported Google secret was an opaque 64-character value, and its destination representation differs. Its presence was previously checked but its usability was not verified. Initially, aggregate records showed no successful Google login on the destination after cutover. The user subsequently saved the actual Google Cloud client secret directly in the destination project's Google provider settings. Read-only verification confirmed that the secret changed, Google remains enabled, the client ID is unchanged and the canonical site URL is correct. The destination now records a successful Google sign-in at 11:11 UTC (14:11 Cairo) on 25 October 2026. No credentials or personal account records were printed during verification.

The callback now requires a verified user before redirecting to a protected destination, prevents caching of authentication redirects and maps failures to safe expired/cancelled/provider categories. Login shows bilingual failure guidance and removes provider error fragments without rendering raw descriptions. Mocked callback tests cover code exchange, profile completion, destination preservation, missing sessions and failed/expired/cancelled callbacks. Successful provider authentication is now observed, and the user confirmed that Google sign-in works again.


## Domain migration readiness — 10 November 2026

Application migration is committed in `8704d09` and pushed to `main`. Canonical URLs, sitemap defaults, social images, welcome-email links and payment URL defaults use `https://playza.life`. The previous host and `www.playza.life` have permanent redirects to the apex domain.

**Blocking: public DNS is not ready.** Google Public DNS returns `NXDOMAIN` (status 3) for both apex and www A queries and for the apex NS query. Local HTTPS requests also fail name resolution. This shows no public nameserver delegation at verification time; it does not establish whether registration is complete. A live request to `https://playza.nineapps.online/sports/volleyball?migration=check` returns HTTP 308 with the path and query preserved at the new domain. Until DNS is fixed, users following that redirect cannot reach the app.

Remaining operational steps:

1. Confirm domain registration and activate nameservers at the registrar. Add `playza.life` and `www.playza.life` to the existing Vercel `playza` project in scope `9apps`, then configure the exact DNS records Vercel displays. Verify both domains and HTTPS certificate issuance.
2. Confirm deployed `NEXT_PUBLIC_SITE_URL` and `KASHIER_SITE_URL` use `https://playza.life`; redeploy if environment values change. Repository defaults alone do not verify production environment values.
3. Confirm Supabase Auth Site URL is `https://playza.life` and its redirect allowlist permits the app callback on the new domain. Review Google OAuth authorized origins if used; retain the existing Supabase provider callback. Test actual login, password reset and email links after DNS resolves.
4. Confirm Kashier return URLs and webhook configuration point to the new domain, including `https://playza.life/webhook`. Confirm deployed notification functions use the updated email links. These hosted settings were not verified in this follow-up.
5. Run `node scripts/check-discovery.mjs https://playza.life --all-sports`, verify old-domain redirects, and submit the new sitemap in Search Console and Bing Webmaster Tools. Review analytics domain settings.

Validation in this follow-up: sitemap, welcome-email and court-rent-info-dialog tests pass. The academy-share test fails because its expected URL omits existing UTM parameters; public-game-discovery fails while reading an undefined mocked `index` value. These failures were observed without changing their implementation or tests. Full production discovery checks remain blocked by DNS. The unrelated local game-guests migration was left untouched.
