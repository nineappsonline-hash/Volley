# Academy owner audit — 19 October 2026

The academy has a broad operations dashboard, but I would fix academy selection, member creation and recurring scheduling before onboarding more owners. Public bookable training is also not yet self-service for owners.

## Scope and limits

Reviewed the academy-owner (`admin`) journey, distinct from the playground-owner (`playground_owner`) role. Exercised the existing local test suite, training-booking SQL checks in isolated PGlite, and new focused probes against actual query hooks, the member-creation API handler and the settings save handler. Read the owner routes, navigation, onboarding, members, teams, coaches, attendance, financial reports, trial gate, training programs and relevant schema/migrations.

This is **not a completed authenticated browser acceptance test**. There is no connected browser automation tool or authenticated test-owner session available in this session. The new probes mock authentication/transport and use local database fixtures; they do not establish the deployed database's current schema or configuration. Mobile layout, camera scanning, uploads, delivered emails/push, external checkout and live cross-account behavior remain unverified. No production accounts, bookings, notifications or payments were created, changed or deleted. `investigate.cjs` was inspected but not executed because it includes live deletes.

## Executed checks

- Existing `tests/*.cjs`: **45 passed, 5 failed** out of 50 files. Some files contain multiple assertions/scenarios; this is a file count, not a claim of 50 end-to-end journeys.
- `node scripts/check-academy-training.mjs`: passed. Covers training access controls, capacity, court occupancy, receipts, payment approval, expiry, free trials, age/gender eligibility, media and verified ratings in an isolated SQL fixture. Its admin actor is a **platform super admin**, not an academy owner.
- `npm run lint:check` and `npm run typecheck`: passed.
- `node scripts/audit-academy-owner.cjs`: **5 passed, 7 failed** across twelve focused acceptance probes. Exit 1 is intentional while the reported product defects remain. The script has no credential loading or network calls.

Existing failures, observed before adding the owner probes:

| Test file | Observed failure | Interpretation |
| --- | --- | --- |
| `tests/game-booking-payment.cjs` | `false !== true`, line 8 | Existing source-contract assertion fails; requires triage, not proof of a live checkout outage. |
| `tests/game-costs.cjs` | Remaining rent `600 !== 380`, line 39 | Expected cost calculation differs from implementation. Resolve intended behavior before changing money logic. |
| `tests/game-payment-email.cjs` | No first sent email in mock | Email delivery test/handler integration needs triage; real delivery was not attempted. |
| `tests/member-dashboard-render.cjs` | Missing expected `Google Maps directions` text, line 442 | Most earlier rendering scenarios pass; directions assertion does not. |
| `tests/public-court-directory.cjs` | `NOT_FOUND` in fixture rendering | Directory fixture/dependency contract needs triage; does not establish that real approved courts fail. |

## Confirmed local defects

### 1. Current-academy lookup fails when another public academy is visible — P0

**Reproduction:** the owner belongs to private academy A; academy B is public. The actual SELECT policies from `supabase/schema.sql` make both rows visible to the owner. `useAcademy()` calls `.from("academies").select("*").maybeSingle()` without an academy filter. The probe reproduces multiple visible rows and the single-row error.

**Owner impact:** any screen depending on the current academy can fail, including onboarding, settings and dashboard. Settings turns `!academy` into an indefinite loading skeleton. If only a different public academy is visible for an account with no academy, this query can also return the wrong academy context.

**Fix:** resolve the signed-in profile's verified academy ID, filter by that ID, disable the query when absent, and show separate loading, error/retry and missing-academy states. Do not remove public directory access to hide the problem.

**Evidence:** `src/lib/queries.ts` (`useAcademy`), `supabase/schema.sql` (`View own academy`, `Public view public academies`), `src/components/settings/settings-client.tsx`.

### 2. Creating a member omits academy context and grants sessions without payment — P1

**Reproduction:** invoke the real `/api/admin/users` POST handler with mocked authenticated academy-owner identity. It returns success, but neither the auth creation metadata nor service-role profile upsert carries the verified owner's academy ID. The request also grants eight sessions by default despite no payment being recorded. The local probes verify both payloads and the API's 401/403 rejection of anonymous/member callers.

**Owner impact:** a newly created member can be left outside the owner's roster. Trial conversion uses the same endpoint and inherits this risk. Session credit also conflicts with the member-edit flow's stated rule that a plan is granted when payment is recorded.

**Fix:** load and validate the active owner profile and academy on the server; assign the academy explicitly; start unpaid members with zero sessions unless a deliberate complimentary-credit flow is recorded. Handle partial creation failures so retrying does not leave an unusable existing email/account.

**Evidence:** `src/app/api/admin/users/route.ts`, `src/components/members/member-form-dialog.tsx`, `src/components/dashboard/trials-card.tsx`, latest `handle_new_user` in `supabase/migrations/20261201000000_playground_owners.sql`.

### 3. Recurring schedule creation sends an invalid academy ID — P1

**Reproduction:** the real recurring form supplies `academy_id: ""`; its mutation forwards the object unchanged. A local PostgreSQL UUID insert rejects it with `invalid input syntax for type uuid: ""`. A column DEFAULT cannot replace an explicitly supplied empty string, and RLS does not populate columns.

**Owner impact:** creating a weekly schedule fails at save time. The form also has no rendered sport, venue or coach selectors despite storing those state fields, and its create/generate/delete handlers lack an error toast/catch path.

**Fix:** omit academy_id and use the trusted database default, or pass a verified ID with owner authorization. Add selectors, date-range validation and recoverable errors. Creation and generation should be clearly separate actions or one atomic operation.

**Evidence:** `src/components/shared/recurring-schedules.tsx`, `src/lib/queries.ts` (`useCreateRecurringSchedule`), `supabase/schema.sql` (`recurring_schedules`).

### 4. Repeating schedule generation inserts duplicate sessions — P1

**Reproduction:** execute the real `useGenerateSessions` mutation twice for Mondays 19–26 October 2026. It submits four rows for two distinct dates/times. There is no duplicate lookup or stable generated-session key in this path. The checked-in base `training_sessions` table has no relevant uniqueness rule; live constraints were not inspected.

**Owner impact:** repeated clicks/retries can create duplicate calendar entries and confuse attendance and cost reporting. The mutation also returns `undefined`, so the UI displays a dash instead of the number created.

**Fix:** generate server-side using a recurring-schedule ID and occurrence key, with a uniqueness rule/idempotent operation; return created/skipped counts and protect pending actions.

**Evidence:** `src/lib/queries.ts` (`useGenerateSessions`), `src/components/shared/recurring-schedules.tsx`.

### 5. Saving a 0% platform fee silently changes it to 5% — P2

**Reproduction:** execute the actual settings save handler with platform fee state `"0"`. The captured mutation payload is `5`, because `Number(platformFee) || 5` treats zero as missing.

**Fix:** distinguish empty/invalid values from zero, and validate the allowed percentage range before saving.

**Evidence:** `src/components/settings/settings-client.tsx`.

## Owner-facing gaps found in code review

These are observed workflow limitations or code-review concerns, not claims that a browser action was exercised successfully.

| Priority | Finding | Owner experience and proposed change |
| --- | --- | --- |
| P1 | Public training groups are platform-admin managed | Owners can set general monthly/tryout prices, but the bookable program editor and `admin_save_training_program` require super-admin access. Booking payment approvals also require super admin. Add an owner Training groups / Bookings workspace with academy-scoped authorization; keep platform-only actions explicit. |
| P1 | Two training systems are not unified for owners | The owner calendar/attendance works with `training_sessions`; public purchases reserve `academy_training_booking_sessions`. The admin calendar passes no booked-training agenda, while attendance reads `training_sessions`. Add one owner schedule/roster view and an explicit synchronization or linking strategy so customer reservations can be checked in and reported. |
| P1 | Conflict check is limited to an exact start time at a venue | The owner session form lacks duration/court selection and checks same-venue/date/start-time only; the warning does not disable Save. Add interval, coach and court-capacity validation in the database, then actionable warnings in the UI. Public booking court checks are separately tested and do not prove this owner-session path is protected. |
| P2 | Onboarding handles free prices differently from settings | `toNumOrNull` accepts only numbers greater than zero, so a zero-price tryout becomes unset; monthly count/price can become an incomplete pair. Use the same validated pricing rules as Settings. State initially reads async academy data without a hydration effect. |
| P2 | Setup completion checks only logo presence | The dashboard's setup banner checks `!academy.logo_url`; having a logo does not mean coaches, prices, venues or future sessions are ready. Add a persistent checklist with links to unfinished tasks. |
| P2 | Error states vary by screen | Dashboard and some newer cards use QueryState, but settings shows a skeleton for missing/error academy data and several lists can look empty after errors. Standardize retry, no-access, no-data and saving states. |
| P2 | Converting a trial creates a password the member is not shown | `TrialsCard` generates a temporary password and creates an email-confirmed account; this path does not show or deliver an activation/reset link. Use an invitation/set-password flow and handle an existing member account without duplicate creation. Live email behavior needs acceptance testing. |
| P2 | Owner settings are split across Profile and Settings | Consolidate academy setup or provide explicit section links and save status, while retaining the owner's personal profile separately. |

## Feature coverage from the owner's perspective

“Reviewed” means traced through source, not browser-certified. Passing tests cover the named behavior only.

| Owner task | Evidence exercised | Remaining acceptance work |
| --- | --- | --- |
| Register academy and confirm email | Auth redirect/password recovery/session tests passed; signup and current trigger reviewed | Real owner signup, email confirmation and academy/role creation in staging |
| Complete onboarding and upload branding | Wizard/media code reviewed; academy query reproduced | Upload/replace/delete media, partial save recovery and slow connection |
| Publish academy, share page, set prices | Academy sharing and isolated price/owner-isolation tests passed | Verify public page after actual owner edits in both languages |
| Add/edit members and convert trials | API handler probes; member detail inline-edit tests passed | End-to-end create/activate/convert after academy-context fix |
| Plans, payments, renewal requests | Member-training and renewal-related tests passed; forms/RPC flow reviewed | Cash collection, edits, reversals and balance reconciliation with owner fixtures |
| Teams and coaches | Team/coach forms and invitation RPC reviewed | Invite/accept/reject a real coach, role restrictions and limits |
| Single and recurring sessions | Calendar rendering tests; recurring mutation probes | Create/edit/cancel/restore/delete, duplicate prevention and conflict handling |
| Attendance and QR | Isolated QR-attendance tests passed; table save path reviewed | Owner camera permission, scanning, double-scan and completed-session correction |
| Costs, expenses, rentals, reports and exports | Shared financial computation/UI traced; CSV/PDF handlers reviewed | Known-answer owner ledger totals, export downloads and Arabic PDF appearance |
| Branches | Branch CRUD/query flow reviewed | Assign staff/members/sessions to a branch and verify branch reporting; current CRUD alone does not establish this workflow |
| Tournaments | Access and league tests passed | Owner create/registration/fixtures/results on each plan |
| Announcements, reminders and notifications | Announcement/reminder handlers reviewed; welcome-email test passed | Actual delivery, failure/retry visibility and recipient correctness |
| AI coach and academy insights | Existing AI-insight tests passed; gating/client code reviewed | Owner plan entitlement, generation, approval, usage limits and provider failures |
| Trial expiry and subscription upgrade | TrialGate and checkout entry reviewed | Expired staging academy, checkout success/failure/cancel, webhook and restored access |
| Account deletion | Confirmation UI and existing deletion SQL reviewed | Disposable staging academy only; preserve/export data and test actual deletion boundaries |
| Phone and Arabic use | Existing bilingual rendering/i18n tests passed where covered | Real mobile owner navigation, RTL, keyboard, dialogs and visual layout |

## What to add next

1. **Make owners self-sufficient:** an academy-scoped training group editor, booking inbox, customer roster, attendance and payment status in one place. Clearly identify actions still requiring Playza approval.
2. **Finish first-day setup:** a checklist for sports, branch/venue, coach, training group, prices, first session and public booking link. Include a preview of exactly what a customer can book.
3. **Make migration from spreadsheets easy:** CSV member import with preview, validation, duplicate detection and an error file. CSV export already exists; import is the missing owner workflow in the reviewed members UI.
4. **Handle membership exceptions:** freeze/resume, make-up sessions, cancellations, refunds/credit notes and a per-member ledger that explains every credit/debit. Avoid treating payment deletion as a refund workflow.
5. **Delegate safely:** owner, manager, receptionist, finance and coach permissions, with an audit history for payments, attendance corrections and settings changes. Existing coach invitations are a useful starting point.
6. **Turn inquiries into renewals:** one pipeline for inquiries → trial booked → attended → joined → renewal due. Trials and renewal requests already exist; connect them and show sent/failed reminder status rather than adding a second reminder system.
7. **Support families and branches operationally:** link guardians to participants, collect emergency/contact/consent information, and scope schedules, rosters and financial views by branch. Family accounts and branch records already exist and should be extended.

## Suggested delivery order

- First: fix current-academy resolution, member academy assignment/credit behavior, recurring creation/idempotency and missing error recovery. Re-run the failing probes.
- Next: deliver the owner training/booking workspace and reconcile it with owner schedule, attendance and finance. Add regression coverage for two academies and multiple roles.
- Then: import, exception handling/ledger, delegated roles and onboarding checklist, followed by conversion/retention improvements.
- Before calling the owner flow ready: execute the staging browser matrix above using two disposable academies, owner/coach/member accounts, English/Arabic and desktop/mobile. Send only test notifications and use sandbox checkout.

This audit adds documentation and local probes only. It does not change production behavior or repair the findings.
