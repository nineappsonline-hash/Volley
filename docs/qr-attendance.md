# QR attendance

Apply `supabase/migrations/20260908190000_qr_attendance.sql` in Supabase before using the new scanner. It preserves issued codes, fills missing codes, enforces case-insensitive uniqueness, fixes attendance badge awarding, and creates the academy-admin check-in RPC. The consolidated schema includes the same migration.

Members open Profile to show or download their QR. Parents can open a child's profile for that child's separate card. An active academy admin opens Attendance, selects a scheduled session, and presses Scan with camera. Allow camera permission on HTTPS (or localhost). A scan stops the camera and reports the member name and result; press Scan again for the next member. Typed codes remain available when a camera cannot be used. This release does not add coach login accounts.

Authorization is enforced inside the RPC using the caller's current profile and academy. The QR is an identifier, not permission to write attendance. A repeat scan leaves an existing present attendance row unchanged. Inactive members and sessions outside the admin's academy cannot be checked in.

The decoder is loaded only when the camera opens and camera tracks stop when the scanner closes or the session changes. Decoder integration follows the [ZXing browser API](https://github.com/zxing-js/browser).

Validation: production build and TypeScript pass. Isolated PostgreSQL tests cover migration re-runs, normalized codes, repeated attendance, absent-to-present changes, badge/activity deduplication, invalid/inactive/cross-academy members, canceled sessions, and member/anonymous/blocked callers. Physical phone cameras and the deployed database have not been tested or changed.

Run the isolated tests from the project root (no live database credentials needed):

```sh
npm install --prefix /tmp/qr-validation @electric-sql/pglite
NODE_PATH=/tmp/qr-validation/node_modules node tests/qr-attendance.cjs
```
