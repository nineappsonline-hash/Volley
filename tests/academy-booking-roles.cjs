const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

// The client gate and the database guard must agree, otherwise an admin sees a
// booking button that fails at submit time with "account is required".
const client = read('src/components/academies/training-booking.tsx');
const migration = read('supabase/migrations/20270101000000_academy_training_admin_booking.sql');

const rolesMatch = client.match(/const BOOKING_ROLES=\[([^\]]+)\]/);
assert.ok(rolesMatch, 'the client declares an explicit role whitelist');
const clientRoles = [...rolesMatch[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
assert.deepEqual(clientRoles, ['admin', 'member', 'super_admin'], 'members and both admin roles can book');

const guardMatch = migration.match(/role IN \(([^)]+)\) AND is_active/);
assert.ok(guardMatch, 'the migration keeps the active-account check with a role whitelist');
const dbRoles = [...guardMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
assert.deepEqual(dbRoles, clientRoles, 'the database whitelist matches the client whitelist');
console.log('PASS: client gate and reserve_academy_training agree on', clientRoles.join(', '));

assert.ok(
  !client.includes('{profile?.role==="member"?'),
  'no strict member-only gate is left behind'
);
assert.equal((client.match(/\{canBook\?<Button/g) || []).length, 2, 'both the monthly and trial buttons use canBook');
assert.ok(!client.includes('Sign in as a member to book'), 'the stale member-only prompt is gone');
console.log('PASS: both booking buttons use canBook and the prompt no longer says members only');

// A playground owner is still not academy-facing, so they keep the sign-in prompt.
assert.ok(!clientRoles.includes('playground_owner'), 'playground_owner stays excluded');

// The relaxation must not have loosened anything else in the function.
for (const guard of [
  "public.is_account_blocked()",
  "NOT p.active",
  "academies WHERE id=p.academy_id AND is_public",
  "venues WHERE id=p.venue_id AND approval_status='approved'",
  "pr.gender=p.gender",
  "p.min_age IS NULL",
  "p.max_age IS NULL",
]) {
  assert.ok(migration.includes(guard), `the migration still enforces: ${guard}`);
}
console.log('PASS: the active-account, program, age and gender guards are all still enforced');

console.log('\nAll academy booking role tests passed.');