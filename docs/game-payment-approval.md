# Game payment approval

Apply `supabase/migrations/20270124000000_game_payment_approval_gates.sql` after the preceding migrations.

- A payment submission creates a private reservation, not a confirmed roster place. The payer (including their sponsored guests) and platform admins retain access for payment review. Existing capacity checks continue reserving places to prevent overbooking.
- Player counts, roster names and confirmed upcoming bookings include approved payments only. Unapproved reservations cannot access game chat.
- Newly created games stay visible to their organizer and platform admins, with an approval notice. They enter public discovery, invite previews and playground listings only when the organizer payment is approved. Other members cannot register before then. The organizer can still include guests in their own pending payment.
- Verified card settlement and approved manual receipts use the same approval state. Players whose costs are already covered by the host keep the existing free/approved registration flow.
- New-game and player-joined announcements wait for approval. Rejecting/removing the organizer's payment hides the game again.

Validation: `node tests/game-payment-approval.cjs`, `node tests/public-game-payment-approval.cjs`, `node tests/shared-game-participants.cjs`, `node tests/my-games.cjs`.
