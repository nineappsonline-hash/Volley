# Padel, Basketball, court owners and booking pricing

## Existing functionality and gaps

The platform already has owner signup, owner/admin approval, venue editing, photos, court counts, blocked dates, rental schedules, manual payment receipts and Kashier checkout. Reuse these pages and payment flows. Missing or incorrect: Padel is excluded from active sports, owner venue editing hides the sport selector, recurring availability is not exposed to owners per court, raw prices are readable by customers, the old fee/divisor rules remain, confirmation uses a 50% threshold, and there is no manual owner payout ledger.

## Implementation

1. Add Padel and Basketball to existing sports, landing and dashboard selectors. Keep Archery available.
2. Add bilingual owner benefits and the owner signup CTA to login. Extend existing venue forms with sport, phone/location and per-court weekly availability; preserve photos and existing availability.
3. Centralize sport pricing: Tennis/Padel 2, Volleyball 10, Beach Volleyball 8, Basketball 8 (explicit user choice); rental × duration first, fixed 25 EGP/player once. Full-court price adds 25 × minimum players once. Server enforces pricing, client uses quotes containing only final totals. Preserve historical saved charges.
4. Enforce rental-rate privacy through database column grants plus authorized management reads. Public and member responses must contain final prices only, including nested game and court responses.
5. Full approved prepayment determines confirmation. Pending receipts are never paid funds. Track the original rental snapshot, scheduled payout date and manual payout references in an owner/admin-only ledger; no money transfers are initiated.
6. Test price examples/durations, privacy as anon/member/owner/admin, availability conflicts and payments, existing signup/booking regressions, mobile/RTL, lint/types/build. Apply the expansion migration, push and verify production, then apply the price-visibility migration. The split avoids breaking the old frontend during the rollout.

## Validation and rollout

Implemented the steps above, including Basketball's confirmed minimum of eight and manual payouts. All 60 regression test files pass; the production build, typecheck and lint pass. Database integration tests cover authoritative pricing, historical snapshots, restricted rate access, owner isolation, court availability and payout eligibility/auditing. Browser checks cover English/Arabic on mobile and desktop. Authenticated owner/admin behavior is covered by component and database tests rather than live payment submissions.

Rollout uses an expansion migration before the frontend deployment, followed by the price-visibility migration once the new production frontend is ready. Existing unrelated Supabase advisor findings are outside this change; management RPCs check authorization explicitly.
