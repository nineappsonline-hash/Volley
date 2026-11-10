# Kashier card payments

Visa, Mastercard and Meeza use Kashier's hosted one-time card checkout. Playza
never receives card numbers or CVVs. Monthly plans are one-time purchases, not
recurring card charges. Existing InstaPay and e-wallet options remain available.

## Deployment

1. Apply `supabase/migrations/20261230000000_kashier_payments.sql` after the academy
   migrations. Enable `pg_net` and `pg_cron` for email retries and expired game
   reservation cleanup. Without cron, run `expire_kashier_holds()` every minute
   and `retry_confirmed_payment_emails()` every five minutes with a trusted job.
2. Set these **server-only** variables in the hosting environment:
   - `KASHIER_MODE=live`
   - `KASHIER_MERCHANT_ID=MID-49632-761`
   - `KASHIER_API_KEY` and `KASHIER_SECRET_KEY` from the live Kashier account
   - `KASHIER_SITE_URL=https://playza.life`
   - `SUPABASE_SERVICE_ROLE_KEY` (already required by other server features)
   Do not prefix secrets with `NEXT_PUBLIC_`. The supplied credentials are saved
   only in ignored `.env.local`; deployment does not upload that file. When
   entering a secret in a hosting UI, use its raw value, including any `$`.
3. Deploy the app. Kashier sessions use the server webhook
   `https://playza.life/webhook`. This URL accepts POST, not a browser
   GET. Keep Kashier's dashboard webhook at that URL if configured; duplicate
   deliveries are safe.
   The route first tries the Payment Sessions API. If that API is blocked (for
   example a Kashier IP allow-list rejecting Vercel's dynamic egress), it falls
   back to a signed hosted-checkout URL at `https://payments.kashier.io/` using
   the Payment API Key and the same order hash. The fallback never exposes the
   Secret Key and the webhook remains the payment authority. Session reads on
   the return page are skipped for fallback orders because Kashier returns no
   session id; the webhook still settles them. To restore session-based
   reconciliation, allow-list a stable egress IP or route API calls through a
   static proxy.
4. Deploy `supabase functions deploy notify-email`. Configure its existing
   `RESEND_API_KEY` and `EMAIL_FROM`, plus `PAYMENT_RECEIVED_EMAIL` for the admin
   notification recipient (falls back to `GAME_PAYMENT_REVIEW_EMAIL`). Members
   receive confirmation at their profile email. Enable `email_enabled` in
   `public.app_settings` if email delivery is currently disabled.
5. Complete an end-to-end checkout and confirm the webhook, fulfillment, and
   receipt. Credentials were checked with a read-only live API request; no live
   charge was made during implementation. Visa/Mastercard/Meeza acceptance must
   also be enabled on the merchant's Kashier account.

## Payment lifecycle

The server calculates the amount from the selected group, game or subscription.
A checkout lasts at most 15 minutes and never beyond its reservation deadline.
Opening checkout or returning from Kashier does not mark anything paid. The
return page reads the database status and polls for webhook confirmation.

The webhook validates the Payment API Key HMAC, requires signed identity,
amount, currency and status fields, then settles the signed successful capture. A best-effort session read is an
audit check and does not block a valid signed webhook. Return-page and admin
reconciliation require an independent provider read bound to the expected
merchant, order, amount and currency; authorization alone is not success. A service-only database function records the transaction and fulfills
it atomically. Duplicate notifications cannot extend a plan twice or send two
receipts. Public/client RPCs cannot approve a card checkout.

An expired, removed or cancelled reservation that is subsequently paid is
marked `review_required`. It is not rebooked automatically. Find it in
`public.kashier_orders`, reconcile the transaction in Kashier, and contact the
member. Refunds are managed in Kashier; automatic refund fulfillment is not
part of this integration. Do not retry an unclear charge as a new payment.

## Emails

Payment-received emails are queued only after verified card payment or approval
of a manual receipt. Pending, failed and cancelled checkouts send no receipt.
Legacy pending-review alerts and caller-supplied receipt events are disabled.
The private `confirmed_payment_emails` outbox supports provider idempotency and
retries within 23 hours. Inspect older unsent rows manually before resending.
Welcome emails remain unchanged. Deploy the migration and edge function together.

## Checks

- `node scripts/check-kashier.mjs`
- `node scripts/check-kashier-signature.mjs`
- `npm run typecheck`
- `npm run lint:check`

Official references: [Sessions](https://developers.kashier.io/docs/accept-payments/payment-sessions),
[Webhooks](https://developers.kashier.io/docs/webhooks),
[Meeza](https://developers.kashier.io/docs/accept-payments/meeza).


Admin review and pending-checkout filters are documented in
[payment-approval-context.md](payment-approval-context.md). Apply migration
`20270108000005_admin_card_payment_reviews.sql` for the server-only card review
routine and preservation of explicit decisions during settlement/expiry. Manual
review never calls Kashier charge, capture or refund endpoints.
