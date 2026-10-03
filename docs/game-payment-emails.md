# Payment emails

Payment notifications now use the success-only flow described in
[kashier-payments.md](./kashier-payments.md). Members and the configured admin
recipient receive a payment-received email only after a verified card payment
or approval of a manual receipt. Uploading a pending receipt no longer sends
payment-received or payment-review emails.

Deploy the new migration and `notify-email` edge function together. Configure
`RESEND_API_KEY`, `EMAIL_FROM`, and `PAYMENT_RECEIVED_EMAIL` in the edge function,
and enable the existing `email_enabled` app setting. `GAME_PAYMENT_REVIEW_EMAIL`
is accepted as a fallback admin recipient.
