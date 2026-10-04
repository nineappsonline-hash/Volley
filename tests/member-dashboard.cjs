const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('require', 'exports', output)(require, exports);
  return exports;
}

const {
  shareAmountDue,
  shareTone,
  todayISO,
  addDaysISO,
  dayBucket,
  groupGamesByDay,
  countdown,
  memberActions,
  translateAction,
} = load('member-dashboard');

// --- helpers ---------------------------------------------------------------
const game = (over = {}) => ({
  id: 'g1',
  creator_id: 'creator',
  title: 'Night match',
  game_date: '2026-05-10',
  start_time: '18:00',
  status: 'open',
  share_price: 120,
  host_pays: false,
  ...over,
});
const row = (over = {}, gameOver = {}) => ({
  id: 'p1',
  is_waitlisted: false,
  pay_status: 'unpaid',
  game: game(gameOver),
  ...over,
});

// --- shareAmountDue --------------------------------------------------------
assert.equal(shareAmountDue(row()), 120, 'unpaid owes the share price');
assert.equal(shareAmountDue(row({ pay_status: 'rejected' })), 120, 'a rejected payment still owes the share');
assert.equal(shareAmountDue(row({ pay_status: 'pending' })), 0, 'a submitted payment owes nothing');
assert.equal(shareAmountDue(row({ pay_status: 'approved' })), 0, 'an approved payment owes nothing');
assert.equal(shareAmountDue(row({ pay_status: null })), 120, 'a null status falls back to unpaid');
assert.equal(shareAmountDue(row({}, { host_pays: true })), 0, 'host pays means no share');
assert.equal(shareAmountDue(row({ is_waitlisted: true })), 0, 'waitlisted members owe nothing');
assert.equal(shareAmountDue(row({}, { share_price: 0 })), 0, 'a free game owes nothing');
assert.equal(shareAmountDue(row({}, { share_price: null })), 0, 'a missing price owes nothing');
assert.equal(shareAmountDue(row({}, { share_price: -50 })), 0, 'a negative price never creates debt');
assert.equal(shareAmountDue(row({}, { share_price: 'abc' })), 0, 'a malformed price never creates debt');
console.log('PASS: outstanding share respects waitlist, host-pays, payment status and malformed prices');

// --- shareTone -------------------------------------------------------------
assert.equal(shareTone(row()), 'due');
assert.equal(shareTone(row({ pay_status: 'rejected' })), 'due');
assert.equal(shareTone(row({ pay_status: 'pending' })), 'pending');
assert.equal(shareTone(row({ pay_status: 'approved' })), 'paid');
assert.equal(shareTone(row({ is_waitlisted: true })), 'none', 'waitlisted is never actionable');
assert.equal(shareTone(row({ pay_status: 'approved' }, { host_pays: true })), 'paid', 'host-paid games read as settled');
assert.equal(shareTone(row({}, { host_pays: true })), 'none', 'a stale unpaid status on a host-paid game raises nothing rather than claiming it was paid');
assert.equal(shareTone(row({}, { share_price: 0 })), 'none', 'free games need no badge');
console.log('PASS: share tone maps payment state to a single badge variant');

// --- dates -----------------------------------------------------------------
// `at` builds a local-time Date so every assertion below holds in any timezone.
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
assert.equal(todayISO(at(2026, 5, 10, 9)), '2026-05-10');
assert.equal(todayISO(at(2026, 5, 10, 0, 1)), '2026-05-10', 'just after local midnight is still the 10th');
assert.equal(todayISO(at(2026, 5, 10, 23, 59)), '2026-05-10', 'just before local midnight is still the 10th');
assert.equal(todayISO(at(2026, 1, 5)), '2026-01-05', 'single-digit months and days are zero padded');
assert.equal(addDaysISO('2026-05-10', 1), '2026-05-11');
assert.equal(addDaysISO('2026-05-31', 1), '2026-06-01', 'month rollover');
assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28', 'month underflow');
assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01', 'year rollover');
assert.equal(dayBucket('2026-05-10', '2026-05-10'), 'today');
assert.equal(dayBucket('2026-05-11', '2026-05-10'), 'tomorrow');
assert.equal(dayBucket('2026-05-12', '2026-05-10'), 'week');
assert.equal(dayBucket('2026-05-09', '2026-05-10'), 'week', 'past dates fall in the generic bucket');
console.log('PASS: day buckets and local ISO date maths');

assert.deepEqual(countdown('2026-05-10', '18:00', at(2026, 5, 10, 9)), { kind: 'hours', value: 9 });
assert.deepEqual(countdown('2026-05-11', '08:00', at(2026, 5, 10, 9)), { kind: 'hours', value: 23 }, 'just under a day out still gets a cue');
assert.equal(countdown('2026-05-11', '09:00', at(2026, 5, 10, 9)), null, 'exactly a day out defers to the day header');
assert.deepEqual(countdown('2026-05-10', '09:30', at(2026, 5, 10, 9)), { kind: 'minutes', value: 30 }, 'sub-hour games count minutes');
assert.deepEqual(countdown('2026-05-10', '09:01', at(2026, 5, 10, 9, 0, 30)), { kind: 'minutes', value: 1 }, 'a sliver under a minute still reads as 1m, never 0m');
assert.equal(countdown('2026-05-10', '09:00', at(2026, 5, 10, 20)), null, 'a started game has no countdown');
assert.equal(countdown('2026-05-14', '18:00', at(2026, 5, 10, 9)), null, 'far-off games show no countdown');
assert.equal(countdown('2026-05-14', null, at(2026, 5, 10, 9)), null);
assert.deepEqual(countdown('2026-05-10', '9:00', at(2026, 5, 10, 8)), { kind: 'hours', value: 1 }, 'a single-digit hour still parses');
console.log('PASS: countdowns render today/tomorrow/hours and stay silent otherwise');

// --- grouping --------------------------------------------------------------
const unsorted = [
  row({ id: 'b' }, { id: 'g3', game_date: '2026-05-12', start_time: '18:00' }),
  row({ id: 'a2' }, { id: 'g1', game_date: '2026-05-10', start_time: '20:00' }),
  row({ id: 'a1' }, { id: 'g2', game_date: '2026-05-10', start_time: '09:00' }),
  row({ id: 'b2' }, { id: 'g4', game_date: '2026-05-12', start_time: '07:00' }),
];
const groups = groupGamesByDay(unsorted, '2026-05-10');
assert.deepEqual(groups.map(g => g.date), ['2026-05-10', '2026-05-12'], 'days are chronological regardless of input order');
assert.deepEqual(groups.map(g => g.bucket), ['today', 'week']);
assert.deepEqual(groups[0].items.map(r => r.id), ['a1', 'a2'], 'same-day games sort by start time');
assert.deepEqual(groups[1].items.map(r => r.id), ['b2', 'b'], 'later days sort by start time too');
assert.deepEqual(groupGamesByDay([], '2026-05-10'), [], 'no games produce no groups');
assert.equal(groups[0].items.length, 2, 'every game lands in exactly one bucket');
assert.equal(groups.reduce((n, g) => n + g.items.length, 0), unsorted.length, 'grouping is lossless');
console.log('PASS: games group into chronological days sorted by start time');

// --- memberActions ---------------------------------------------------------
const mixed = [
  row({ id: 'due1', pay_status: 'unpaid' }, { id: 'x1' }),
  row({ id: 'due2', pay_status: 'rejected' }, { id: 'x2', share_price: 80 }),
  row({ id: 'ok', pay_status: 'approved' }, { id: 'x3' }),
  row({ id: 'pend', pay_status: 'pending' }, { id: 'x4' }),
  row({ id: 'wl', is_waitlisted: true, pay_status: 'unpaid' }, { id: 'x5' }),
];
const dueActions = memberActions({ games: mixed });
assert.deepEqual(dueActions.map(a => a.id), ['share_due', 'share_pending'], 'payments outrank subscription warnings');
const shareDue = dueActions[0];
assert.equal(shareDue.count, 2, 'waitlisted and settled games are excluded from the count');
assert.equal(shareDue.amount, 200, 'outstanding amount sums every due game');
assert.equal(shareDue.tone, 'action');
assert.equal(shareDue.href, null, 'an outstanding share opens the payment dialog instead of navigating');
assert.deepEqual(shareDue.params, { n: 2, amount: 200 });
assert.equal(dueActions[1].count, 1);
assert.equal(dueActions[1].tone, 'info');
assert.equal(dueActions[1].href, '/dashboard/games');

const free = memberActions({ games: [row({}, { host_pays: true })] });
assert.deepEqual(free.map(a => a.id), [], 'host-paid games raise nothing');

const zeroPrice = memberActions({ games: [row({}, { share_price: 0 })] });
assert.deepEqual(zeroPrice, [], 'free games raise nothing');

assert.deepEqual(memberActions({ games: [] }), [], 'a member with nothing pending sees no strip');
assert.deepEqual(memberActions({ games: [], remainingSessions: null }), [], 'no academy means no subscription warning');

const empty = memberActions({ games: [], remainingSessions: 0 });
assert.equal(empty.length, 1);
assert.equal(empty[0].id, 'session_empty');
assert.equal(empty[0].tone, 'action');
assert.deepEqual(empty[0].params, { n: 0 });

const low = memberActions({ games: [], remainingSessions: 2 });
assert.equal(low[0].id, 'session_low');
assert.equal(low[0].tone, 'warning');
assert.deepEqual(low[0].params, { n: 2 });
assert.deepEqual(memberActions({ games: [], remainingSessions: 3, lowSessionThreshold: 3 })[0].id, 'session_low', 'the threshold is inclusive');
assert.deepEqual(memberActions({ games: [], remainingSessions: 4, lowSessionThreshold: 3 }), [], 'a healthy subscription raises nothing');
assert.equal(memberActions({ games: mixed, remainingSessions: 0 }).at(-1).id, 'session_empty', 'an empty subscription sorts last');
console.log('PASS: action list ranks payments first, aggregates amounts and respects subscription thresholds');

// --- placeholder substitution ---------------------------------------------
const amountTemplate = 'Settle {amount} to lock your spot in {n} game{s}';
assert.equal(
  translateAction(amountTemplate, { n: 1, amount: '120 EGP' }, 'en'),
  'Settle 120 EGP to lock your spot in 1 game',
  'English singular drops the plural suffix'
);
assert.equal(
  translateAction(amountTemplate, { n: 3, amount: '260 EGP' }, 'en'),
  'Settle 260 EGP to lock your spot in 3 games',
  'English plural adds the suffix'
);
assert.equal(
  translateAction(amountTemplate, { n: 3, amount: '260 EGP' }, 'ar'),
  'Settle 260 EGP to lock your spot in 3 game',
  'Arabic never appends a suffix and never leaves a stray brace'
);
assert.equal(
  translateAction('Top up soon ({n})', { n: 2 }, 'en'),
  'Top up soon (2)',
  'templates without {s} are untouched'
);
assert.equal(
  translateAction('{n} payment{s} waiting', { n: 5 }, 'en'),
  '5 payments waiting',
  'repeat placeholders are all replaced'
);
assert.equal(
  translateAction('{a}-{b}', { a: 'x', b: 'y' }, 'en'),
  'x-y',
  'multiple distinct placeholders resolve in one pass'
);
console.log('PASS: action copy substitutes values and handles the English-only plural suffix');