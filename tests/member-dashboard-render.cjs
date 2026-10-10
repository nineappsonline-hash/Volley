const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.join(__dirname, '..');

// Classic JSX output calls the global `React`, so expose it rather than passing
// it as a parameter (which would collide with modules that import React).
globalThis.React = React;

const dictSource = fs.readFileSync(path.join(root, 'src/lib/i18n/dictionary.ts'), 'utf8');
const dictOut = ts.transpileModule(dictSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const dictModule = {};
new Function('require', 'exports', dictOut)(require, dictModule);
const dictionary = dictModule.dictionary;

const { todayISO, addDaysISO } = (() => {
  const source = fs.readFileSync(path.join(root, 'src/lib/member-dashboard.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', output)(require, exports);
  return exports;
})();

let lang = 'en';
const useI18n = () => ({
  lang,
  dir: lang === 'ar' ? 'rtl' : 'ltr',
  t: (key) => {
    if (!(key in dictionary.en)) throw new Error('unknown i18n key: ' + key);
    return dictionary[lang][key];
  },
  locale: undefined,
});

let gameRows = [];
const useMyUpcomingGames = () => ({ data: gameRows, isPending: false, isError: false, refetch: () => {} });
const useUpcomingGameParticipants = () => ({ data: [], isPending: false, isError: false, refetch: () => {} });

const cache = new Map();
const EXTENSIONS = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];

function resolveAlias(id) {
  if (!id.startsWith('@/')) return null;
  for (const extension of EXTENSIONS) {
    const file = path.join(root, 'src', id.slice(2) + extension);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function loadFile(file, mocks) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  if (file.endsWith('.css')) return exports;
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', output)((id) => {
    if (id in mocks) return mocks[id];
    const aliased = resolveAlias(id);
    if (aliased) return loadFile(aliased, mocks);
    return require(id);
  }, exports);
  return exports;
}

const h = React.createElement;
const stub = (name) => () => h('div', { 'data-stub': name });
const mocks = {
  '@/lib/useRealtime': { useRealtime: () => {} },
  '@/components/games/game-teams': { GameTeamsButton: stub('teams') },
  '@/components/games/join-game-dialog': { JoinGameDialog: () => null },
  '@/components/shared/playground-distance': { PlaygroundDistance: () => null },
  '@/components/shared/directions-links': { DirectionsLinks: () => null },
  '@/lib/queries': { useMyUpcomingGames, useUpcomingGameParticipants },
  '@/lib/i18n': { useI18n },
};

const { MyUpcomingGames } = loadFile(path.join(root, 'src/components/dashboard/my-upcoming-games.tsx'), mocks);

const TODAY = todayISO();
const game = (over = {}) => ({
  id: 'g1',
  creator_id: 'someone-else',
  title: 'Night match',
  sport: 'Volleyball',
  game_date: TODAY,
  start_time: '18:00',
  status: 'open',
  share_price: 120,
  host_pays: false,
  duration_hours: 1,
  area: 'Maadi',
  location: null,
  invite_code: 'ABC123',
  ...over,
});
const row = (over = {}, gameOver = {}) => ({ id: 'p1', is_waitlisted: false, pay_status: 'unpaid', game: game(gameOver), ...over });
const render = () => renderToStaticMarkup(h(MyUpcomingGames, { memberId: 'member-1' }));
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const times = (html, needle) => (html.match(new RegExp(esc(needle), 'g')) || []).length;

// --- empty state carries a way forward -------------------------------------
gameRows = [];
let html = render();
assert.ok(html.includes(dictionary.en.games_my_upcoming_empty), 'empty state explains the situation');
assert.ok(html.includes('href="/dashboard/games"'), 'empty state links to browsing games');
assert.ok(!html.includes(dictionary.en.games_share_pay_now), 'no payment CTA without games');
console.log('PASS: empty upcoming-games state renders a message plus a browse CTA');

// --- payment state surfaces, once per game ---------------------------------
gameRows = [
  row({ id: 'due', pay_status: 'unpaid' }, { id: 'g_due', share_price: 120 }),
  row({ id: 'pend', pay_status: 'pending' }, { id: 'g_pend', share_price: 60 }),
  row({ id: 'ok', pay_status: 'approved' }, { id: 'g_ok', share_price: 60 }),
  row({ id: 'wl', is_waitlisted: true, pay_status: 'unpaid' }, { id: 'g_wl', share_price: 60 }),
  row({ id: 'free', pay_status: 'unpaid' }, { id: 'g_free', share_price: 0 }),
];
html = render();
assert.equal(times(html, dictionary.en.dash_share_due_badge), 1, 'only the unpaid game is flagged as due');
assert.equal(times(html, dictionary.en.games_share_pending), 1);
assert.equal(times(html, dictionary.en.dash_share_paid_badge), 1);
assert.equal(times(html, 'Waitlisted'), 1);
assert.equal(times(html, dictionary.en.games_share_pay_now), 1, 'only the genuinely unpaid game offers payment');
assert.ok(html.includes('120'), 'the outstanding amount is shown');
assert.ok(!html.includes('>60<'), 'settled games do not repeat an amount');
console.log('PASS: due, pending, paid, waitlisted and free games each render their own state exactly once');

// --- day grouping ---------------------------------------------------------
gameRows = [
  row({ id: 'later', pay_status: 'approved' }, { id: 'g3', title: 'Later match', game_date: addDaysISO(TODAY, 2), start_time: '18:00' }),
  row({ id: 'tonight', pay_status: 'approved' }, { id: 'g1', title: 'Tonight match', game_date: TODAY, start_time: '20:00' }),
];
html = render();
// Rendered twice on purpose: once as the visible heading, once as the group label.
assert.ok(times(html, dictionary.en.dash_today) >= 1, 'today gets its own header');
assert.ok(html.includes(dictionary.en.dash_tomorrow) === false, 'nothing lands under tomorrow here');
assert.ok(html.indexOf('Tonight match') < html.indexOf('Later match'), 'today renders before later days');
assert.ok(html.includes('aria-label="' + dictionary.en.dash_today + '"'), 'the day group is labelled for screen readers');
assert.ok(html.includes(dictionary.en.dash_games_count.replace('{n}', '2').replace('{s}', 's')), 'the header shows the game count');
console.log('PASS: games group under day headers in chronological order with a total count');

// --- tomorrow and weekday buckets ------------------------------------------
gameRows = [
  row({ id: 'a', pay_status: 'approved' }, { id: 'g1', game_date: addDaysISO(TODAY, 1) }),
  row({ id: 'b', pay_status: 'approved' }, { id: 'g2', game_date: addDaysISO(TODAY, 5) }),
];
html = render();
assert.ok(times(html, dictionary.en.dash_tomorrow) >= 1, 'tomorrow is named explicitly');
console.log('PASS: tomorrow and weekday buckets both render named headers');

// --- countdown ------------------------------------------------------------
gameRows = [row({ id: 'soon', pay_status: 'approved' }, { id: 'g1', game_date: TODAY, start_time: '23:30' })];
html = render();
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const hoursOut = Math.floor((new Date(TODAY + 'T23:30:00').getTime() - Date.now()) / 3_600_000);
if (hoursOut >= 1 && hoursOut < 24) {
  assert.ok(
    html.includes(dictionary.en.dash_in_hours.replace('{n}', String(hoursOut))),
    'a game later today shows an hours countdown'
  );
} else {
  assert.ok(!html.includes(dictionary.en.dash_in_hours), 'too close for an hours countdown, so none is shown');
}
gameRows = [row({ id: 'far', pay_status: 'approved' }, { id: 'g1', game_date: addDaysISO(TODAY, 9) })];
html = render();
assert.ok(!html.includes(dictionary.en.dash_in_hours) && !html.includes(dictionary.en.dash_in_minutes), 'distant games show no countdown');
assert.ok(startOfToday instanceof Date);
console.log('PASS: countdowns appear only when they add information');

// --- arabic ---------------------------------------------------------------
lang = 'ar';
gameRows = [
  row({ id: 'due', pay_status: 'unpaid' }, { id: 'g_due' }),
  row({ id: 'wl', is_waitlisted: true, pay_status: 'unpaid' }, { id: 'g_wl' }),
];
html = render();
assert.ok(html.includes(dictionary.ar.dash_share_due_badge), 'Arabic share-due badge');
assert.ok(html.includes(dictionary.ar.games_share_pay_now), 'Arabic payment CTA');
assert.ok(html.includes('قائمة الانتظار'), 'Arabic waitlist badge');
assert.ok(html.includes(dictionary.ar.dash_today), 'Arabic day header');
lang = 'en';

console.log('PASS: dashboard cards render correctly in both languages');
// Discovery CTAs depend on membership, even when public listings are empty.
let joined = false;
const discoveryQuery = (data = []) => ({ data, isPending: false, isError: false, refetch: () => {} });
Object.assign(mocks['@/lib/queries'], {
  useFriendlyGames: () => discoveryQuery(),
  useAllTournaments: () => discoveryQuery(),
  usePlaygrounds: () => discoveryQuery(),
  usePublicAcademies: () => discoveryQuery(),
  useMyUpcomingGames: () => discoveryQuery(joined ? [{ id: 'game' }] : []),
  useMyTournaments: () => discoveryQuery(joined ? [{ participant_id: 'entry' }] : []),
  useMyAcademyFollows: () => discoveryQuery(joined ? [{ academy_id: 'academy' }] : []),
});
mocks['@/components/academies/academy-logo'] = { AcademyLogo: () => null };
const { MemberDiscoveryCards } = loadFile(path.join(root, 'src/components/dashboard/member-discovery-cards.tsx'), mocks);
const renderDiscovery = (hasAcademy = false) => renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy }));
html = renderDiscovery();
for (const label of ['Find games', 'Find tournaments', 'Find an academy', 'Find playgrounds']) {
  assert.ok(html.includes(label), `empty discovery includes ${label}`);
}
for (const href of ['/dashboard/games', '/dashboard/tournaments', '/academies', '/playgrounds']) {
  assert.ok(html.includes(`href="${href}"`), `discovery links to ${href}`);
}
assert.ok(renderDiscovery(true).includes('Discover more academies'), 'academy membership changes the academy CTA');
joined = true;
html = renderDiscovery();
for (const section of ['games', 'tournaments', 'academies']) {
  assert.ok(html.includes(`Discover more ${section}`), `joined members can discover more ${section}`);
}
lang = 'ar';
html = renderDiscovery();
assert.ok(html.includes('اكتشف المزيد من المباريات'));
assert.ok(html.includes('اكتشف المزيد من البطولات'));
assert.ok(html.includes('اكتشف المزيد من الأكاديميات'));
joined = false;
html = renderDiscovery();
assert.ok(html.includes('ابحث عن مباراة'));
assert.ok(html.includes('ابحث عن بطولة'));
assert.ok(html.includes('ابحث عن أكاديمية'));
lang = 'en';
console.log('PASS: discovery CTAs reflect membership in English and Arabic, including empty listings');
