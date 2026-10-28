# Super-admin game guests

Apply `supabase/migrations/20270108000007_admin_game_guests.sql` before deploying the guest controls. It follows the existing game-guests migration and creates three authenticated RPCs, each enforcing `is_super_admin()` in the database.

In **Super Admin → Games**, open a game's details and use **Manage players → Guest name — no account → Add guest**. Enter the guest's name; no account, email address, phone number or sponsor booking is needed. The roster identifies guests as having no account. Arabic labels are included.

Each guest occupies one real place. Full games reject additions; completed and cancelled games retain the existing restriction on roster changes. Admins can manage guests in public and private games without joining themselves. Names are required and limited to 100 characters. Two people may share a name.

Host-paid and zero-price game guests are approved automatically. Guests in paid games start unpaid with the game's share price. After collecting cash, use **Confirm cash received** and confirm receipt to approve that guest. This does not create a card transaction or send account notifications. Removing a guest frees their place for a new registration. It does not issue a refund.

Validation: `node tests/admin-game-guests.cjs` executes the migration against PGlite and checks authorization, names, capacity/status, independent guest identity, cash confirmation, removal scope, waitlist closure, member/admin/card capacity enforcement and function permissions. Existing admin edit and shared-participant tests, TypeScript and strict lint are also checked.

## Cash correction and closing waitlists

Apply `supabase/migrations/20270108000008_disable_game_waitlists_and_allow_guest_cash.sql` after the guest migration. This fixes the payment-method constraint that rejected cash confirmations. Existing unpaid, zero-share waitlist entries are removed; the migration stops for review if an unexpected waiting entry has payment information. No waiting player is charged or promoted. New waiting entries are prohibited, and database capacity enforcement covers member/admin/guest/card registrations. Payment confirmation for an existing seat remains available when a game is full.
