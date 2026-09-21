# Game-payment review emails

New pending receipts on player/host payments and remaining-rent payments queue
an email to `mo.dowaik@gmail.com`. Free joins and approval updates do not queue
emails. Rejected payments submitted again do. The review button requires admin
sign-in; opening an email never approves a payment automatically.

## Enable

1. Set Supabase Edge Function secrets `RESEND_API_KEY` and `EMAIL_FROM`
   (for example `Playza <noreply@playza.nineapps.online>`, with a verified domain).
   SMTP credentials for Supabase Auth do not set these function secrets.
   Optional: `GAME_PAYMENT_REVIEW_EMAIL` overrides the admin recipient.
2. Deploy `notify-email`: `supabase functions deploy notify-email`.
3. Enable `pg_net` and `pg_cron` in Supabase before applying
   `20261121000000_game_payment_review_emails.sql`. The migration uses the existing
   `notify_email_forward` function from the transactional-emails migration.
4. Enable transactional emails: the later migration
   `20260928000000_disable_transactional_emails.sql` turns them off by default.
   In the SQL Editor, run:
   `UPDATE public.app_settings SET value = 'true' WHERE key = 'email_enabled';`
   This switch affects welcome emails, receipts and game-payment review alerts.
5. Deploy the web app for direct game-detail links.
6. Submit a test payment receipt and verify email delivery and the admin review
   button. No live email or payment was submitted during the automated tests.

The queue is inaccessible to app users. Emails are built from stored payment
facts, never caller-supplied email content. Resend's Idempotency-Key header keeps
concurrent retries from delivering duplicate emails. Failed jobs retry every
five minutes for 23 hours, within Resend's 24-hour window. Older unsent rows need
investigation through the queue and Edge Function logs; they are not retried
automatically. Check `sent_at` to distinguish delivered from queued emails.
