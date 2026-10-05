const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');

function load(relative) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', output)(require, exports);
  return exports;
}

const { SESSION_PACKAGES, sessionPackageAmount, groupAvailableSessions, sessionPackageOptions, defaultSessionPackage } =
  load('src/lib/admin/training-assignment.ts');

// --- only 8, 4 and a single session are offered --------------------------
assert.deepEqual([...SESSION_PACKAGES], [8, 4, 1], 'the three packages the database accepts');
console.log('PASS: session packages are exactly 8, 4 and a single session');

// --- amounts match the database formula -----------------------------------
// admin_assign_training: price := CASE WHEN p_sessions=1 THEN trial_price
//                                    ELSE round(monthly_price*p_sessions/monthly_sessions, 2) END
const group = { monthly_price: 1000, monthly_sessions: 8, trial_price: 150, slots: [] };
assert.equal(sessionPackageAmount(group, 8), 1000, 'the full month costs the monthly price');
assert.equal(sessionPackageAmount(group, 4), 500, 'half the month is prorated');
assert.equal(sessionPackageAmount(group, 1), 150, 'a single session uses the trial price, not a prorated share');

const odd = { monthly_price: 1000, monthly_sessions: 3, trial_price: 300, slots: [] };
assert.equal(sessionPackageAmount(odd, 4), 1333.33, 'proration rounds to 2dp like round(numeric,2)');
assert.equal(sessionPackageAmount(odd, 8), 2666.67);
assert.equal(sessionPackageAmount(odd, 1), 300);
console.log('PASS: amounts follow the database formula and round the same way');

// --- string numerics from Postgres survive --------------------------------
assert.equal(sessionPackageAmount({ monthly_price: "750.50", monthly_sessions: "4", trial_price: "99.99" }, 4), 750.5);
assert.equal(sessionPackageAmount({ monthly_price: "750.50", monthly_sessions: "4", trial_price: "99.99" }, 1), 99.99);
console.log('PASS: numeric values arriving as strings are handled');

assert.equal(sessionPackageAmount(null, 8), 0, 'no group means no amount');
assert.equal(sessionPackageAmount({ monthly_price: 500, monthly_sessions: 0, trial_price: 50 }, 8), 0, 'no division by zero');
assert.equal(sessionPackageAmount({ monthly_price: null, monthly_sessions: null, trial_price: null }, 1), 0);
console.log('PASS: missing or zero session counts cannot produce NaN or Infinity');

// --- availability comes from real seats ----------------------------------
const slots = (n, seats = 1) => Array.from({ length: n }, () => ({ seats_left: seats }));
assert.equal(groupAvailableSessions({ slots: slots(5) }), 5);
assert.equal(groupAvailableSessions({ slots: [...slots(3), { seats_left: 0 }, { seats_left: 0 }] }), 3, 'full slots do not count');
assert.equal(groupAvailableSessions({ slots: null }), 0);
assert.equal(groupAvailableSessions(null), 0);
console.log('PASS: only slots with an open seat count as available');

const options = sessionPackageOptions({ ...group, slots: slots(5) });
assert.deepEqual(options.map((o) => [o.count, o.amount, o.available]), [
  [8, 1000, false],  // 8 requested, only 5 open
  [4, 500, true],
  [1, 150, true],
]);
console.log('PASS: a package larger than the open seats is marked unavailable rather than failing at submit');

assert.deepEqual(
  sessionPackageOptions({ ...group, slots: slots(2) }).map((o) => [o.count, o.available]),
  [[8, false], [4, false], [1, true]],
  'two open seats still allow a single session'
);
assert.equal(sessionPackageOptions({ ...group, slots: slots(0) }).every((o) => !o.available), true, 'a fully booked group offers nothing selectable');
assert.equal(sessionPackageOptions({ ...group, slots: null }).every((o) => !o.available), true, 'a group with no schedule offers nothing selectable');
assert.equal(defaultSessionPackage({ ...group, slots: slots(5) }), 4, 'the default is the largest package that fits');
assert.equal(defaultSessionPackage({ ...group, slots: slots(9) }), 8);
assert.equal(defaultSessionPackage({ ...group, slots: [] }), null, 'no selectable package when the group is empty');
assert.equal(sessionPackageOptions(null).every((o) => o.amount === 0 && !o.available), true);
console.log('PASS: the default package is the largest one the group can actually fill');

// --- every editable member-details tab is always inline -------------------
const editor = fs.readFileSync(path.join(root, 'src/components/super-admin/member-details-editor.tsx'), 'utf8');
assert.ok(!/if\s*\(\s*!draft\s*\)\s*return/.test(editor), 'the Overview editor has no collapsed toggle');
assert.doesNotMatch(editor, /Edit member details/, 'the "Edit member details" button is gone');
assert.match(editor, /type="submit"/, 'the form is always present and submittable');
assert.match(editor, /Discard changes|إلغاء التعديلات/, 'there is still a way to revert edits');

const assignment = fs.readFileSync(path.join(root, 'src/components/super-admin/member-training-assignment.tsx'), 'utf8');
assert.ok(!/if\s*\(\s*!open\s*\)\s*return/.test(assignment), 'the enrollment form is not behind a toggle');
assert.doesNotMatch(assignment, /Assign academy & training group/, 'the "Assign academy & training group" button is gone');
assert.match(assignment, /setSessions\(null\)/, 'no package is preselected, so a choice is required');
assert.match(assignment, /disabled=\{busy \|\| !group \|\| !sessions\}/, 'submit stays disabled until a package is chosen');

const family = fs.readFileSync(path.join(root, 'src/components/super-admin/member-family-manager.tsx'), 'utf8');
assert.doesNotMatch(family, /Edit details|تعديل البيانات/, 'no per-child "Edit details" toggle remains');
assert.match(family, /children\.map/, 'each child renders its own editable form');
console.log('PASS: Overview, Academies and Family are all editable without entering another mode');

console.log('\nAll member details inline-edit tests passed.');