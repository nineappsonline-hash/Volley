# Academy-owner defect fixes — 19 October 2026

This change repairs the existing academy-owner workflows identified in the audit. The proposed feature additions remain deferred.

## Repaired behavior

- **Academy resolution:** the current academy is fetched through the authenticated user's profile and an explicit academy ID. Public directory rows cannot become the owner's academy. Accounts without an academy return an explicit missing-academy state.
- **Member creation:** the server verifies an active academy-admin profile and assigns that academy explicitly. New members start with zero paid-session credit. Client-supplied session credits/academy IDs are not accepted by this API. An unsuccessful profile setup rolls back only the new auth account; cleanup failure produces an actionable support response.
- **Trial conversion:** new accounts receive an auth invitation to set their own password. The password setup page supports invite sessions and recovery sessions. Existing members of the same academy can be reused without resetting credits; accounts elsewhere are not reassigned. Invites were mocked in tests; no customer emails were sent during validation.
- **Recurring schedule creation:** uses the trusted academy default, validates dates, and exposes the existing sport/venue/coach assignment fields plus duration. Saving a schedule and generating its sessions are distinct actions. Failures display recoverable error messages.
- **Recurring generation:** moved into an authenticated, owner-scoped security-invoker RPC. It locks the schedule and uses a unique source-schedule/occurrence identity. Repeated generation creates zero duplicates and reports the actual count. Editing an occurrence does not cause its original date to be generated again. Historical rows are not deleted or retroactively relinked.
- **Session saves:** fixed the missing live `training_sessions.academy_id` default. New owner sessions inherit the correct academy.
- **Scheduling conflicts:** sessions have a duration and court selection. The client checks overlapping intervals and disables a known conflicting submission. Database triggers enforce owner/resource ownership, coach conflicts, court capacity and same-day duration. Occupancy checks also protect against conflicting games, rentals and public training bookings; the free-court picker includes owner sessions. Existing rows retain a 60-minute default until edited; historical dates and customer records were not rewritten.
- **Permissions:** removed the legacy policies that let ordinary academy members write staff sessions/recurring schedules. Existing member SELECT access remains. Trigger helpers are private and not executable by PUBLIC. The generation RPC is not executable by anonymous users.
- **Settings:** zero-percent platform fees remain zero; invalid percentages are rejected. Missing academy data and errors no longer produce an endless skeleton.
- **Onboarding:** shares pricing validation with Settings, distinguishes free from unset prices, hydrates asynchronously loaded values once per academy, and removes successfully saved coach/template drafts so a later failure/retry does not resubmit them.
- **Error recovery:** added explicit query loading/retry handling to the affected members, costs, reports, coaches, teams, attendance, onboarding, recurring schedules and trial gate flows.

## Existing test failures resolved

The five pre-existing failures were stale test contracts or fixtures, rather than a reason to change established product behavior:

- Payment calculations already use the minimum-player total including fees, as established by the existing database migration. Tests now assert the correct 600 EGP boundary/balance and retain pending, rejected, waitlist and host-payment coverage. Money calculations were not changed.
- Email tests now exercise the confirmed-payment queue, verify persisted facts and both recipients, and ensure legacy unverified review requests do not send receipts.
- Maps tests use the current accessible/localized button and load the real directions component instead of the old null mock.
- Court-directory tests transpile the discovery module with an ES2020 target so Set/spread constructs work correctly in the fixture.

## Validation

- `npm run lint:check`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- All **51** `tests/*.cjs` files: passed.
- `node scripts/audit-academy-owner.cjs`: **17/17** checks passed.
- `node scripts/check-academy-training.mjs`: passed.
- `tests/academy-owner-scheduling.cjs` runs the migration twice in isolated PostgreSQL and checks generated counts, stable occurrence identity, role/academy isolation, coach intervals, court capacity, cancellation release, midnight rejection and shared booking occupancy.
- Migration `20261019085414_academy_owner_flow_fixes.sql` applied to the Volley Supabase project. Read-only verification confirmed the default, new fields, five guards, security-invoker RPC and anonymous/authenticated execute permissions. No customer records were created or modified for testing.
- Supabase security advisors were checked before and after. No findings reference the new private guards or generation RPC. Existing broader project notices remain outside this workflow fix; this change is not a claim of a complete project security remediation.

## Deferred additions and remaining acceptance work

The owner training-group/booking workspace, integration of purchased training into owner attendance/finance, fuller setup checklist, CSV imports, membership exceptions, delegated roles and other proposed additions have not been implemented. They remain the next product phase requested by the user. Existing Profile-to-Settings links already provide configuration access; merging those screens is also deferred.

An authenticated staging browser walkthrough is still required for real invite delivery, phone/Arabic layout, media uploads, camera scanning and payment checkout. Local regression tests and the production build do not certify those external interactions.
