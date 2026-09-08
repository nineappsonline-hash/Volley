# Friendly game chat

Apply `supabase/migrations/20260909010000_friendly_game_chat.sql` in the Supabase SQL Editor before deploying the UI. It creates the messages table, participant-only read policy, send RPC and Realtime publication entry. The consolidated schema also contains these changes.

Participants open **Game chat** on their game card (Friendly Games or Community). They can send text up to 2,000 characters, see sender names and timestamps, and load older messages. English and Egyptian Arabic labels follow the selected language. Completed and canceled games retain their chat for current participants.

Membership is checked in the database for reads and writes. Leaving removes future access. Sender ID and display name are set by the server; clients cannot insert, edit or delete rows directly. Deleting a game removes its messages. Retry IDs prevent duplicate messages after a response is lost. Names are captured at send time.

The open chat listens for Realtime inserts and refetches after reconnecting. A 15-second refresh provides a fallback. Closing it releases the subscription and inactive message query cache. Each query is scoped by game and signed-in member. Text is rendered as plain text.

Checks: TypeScript and isolated PostgreSQL tests cover repeated migration application, member read/send access, non-member and cross-game isolation, joining/leaving, blocked/anonymous callers, sender identity, direct-write denial, length validation and retry deduplication. To rerun:

```sh
npm install --prefix /tmp/qr-validation @electric-sql/pglite
NODE_PATH=/tmp/qr-validation/node_modules node tests/game-chat.cjs
```

A deployed two-account Realtime walkthrough remains to be performed after the migration is applied.
