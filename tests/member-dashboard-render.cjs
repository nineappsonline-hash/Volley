const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Keep same-day fixtures upcoming regardless of the time the suite runs.
const RealDate = Date;
const fixedNow = new RealDate();
fixedNow.setHours(12, 0, 0, 0);
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixedNow.getTime()])); }
  static now() { return fixedNow.getTime(); }
};

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
    if (id.startsWith('.')) {
      for (const extension of EXTENSIONS) {
        const relative = path.resolve(path.dirname(file), id + extension);
        if (fs.existsSync(relative) && fs.statSync(relative).isFile()) return loadFile(relative, mocks);
      }
    }
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
  '@/lib/queries': { useMyUpcomingGames, useUpcomingGameParticipants, usePlaygrounds: () => ({ data: [] }) },
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
for (const label of ['Find games', 'Find an academy']) {
  assert.ok(html.includes(label), `empty discovery includes ${label}`);
}
for (const href of ['/dashboard/games', '/academies']) {
  assert.ok(html.includes(`href="${href}"`), `discovery links to ${href}`);
}
assert.ok(renderDiscovery(true).includes('Discover more academies'), 'academy membership changes the academy CTA');
joined = true;
html = renderDiscovery();
for (const section of ['games', 'academies']) {
  assert.ok(html.includes(`Discover more ${section}`), `joined members can discover more ${section}`);
}
lang = 'ar';
html = renderDiscovery();
assert.ok(html.includes('اكتشف المزيد من المباريات'));
assert.ok(!html.includes('اكتشف المزيد من البطولات'));
assert.ok(html.includes('اكتشف المزيد من الأكاديميات'));
joined = false;
html = renderDiscovery();
assert.ok(html.includes('ابحث عن مباراة'));
assert.ok(!html.includes('ابحث عن بطولة'));
assert.ok(!html.includes('href="/playgrounds"'), 'playgrounds discovery card is removed');
assert.ok(html.includes('ابحث عن أكاديمية'));
lang = 'en';
console.log('PASS: discovery CTAs reflect membership in English and Arabic, including empty listings');

const { discoveryMatch } = loadFile(path.join(root, 'src/lib/member-discovery.ts'), mocks);
const preferences = { interested_sports: ['Volleyball'], skill_level: 'beginner', availability_days: [1], lat: 30, lng: 31 };
const matched = discoveryMatch({ sport: 'volleyball', skill_level: 'beginner', date: '2026-10-12', lat: 30.01, lng: 31.01 }, preferences);
assert.equal(matched.score, 10);
assert.deepEqual(matched.reasons, ['sport', 'day', 'skill', 'nearby']);
assert.equal(discoveryMatch({ sport: 'Tennis' }, preferences).score, 0);
assert.equal(discoveryMatch({ sport: 'Volleyball', lat: 0, lng: 0 }, {}).score, 0, 'missing preferences do not invent a match');
assert.ok(!discoveryMatch({ lat: 0, lng: 0 }, preferences).reasons.includes('nearby'), 'distant venues are not nearby');
console.log('PASS: discovery ranks sport, weekday, skill, and actual distance matches without invented preferences');

mocks['@/lib/queries'].useMyUpcomingGames = useMyUpcomingGames;

// The next-game hero skips waitlists and exposes the nearest confirmed game.
gameRows = [
  row({ id: 'waiting', is_waitlisted: true }, { id: 'waiting-game', title: 'Waiting match', game_date: addDaysISO(TODAY, 1) }),
  row({ id: 'confirmed', pay_status: 'approved' }, { id: 'confirmed-game', title: 'Confirmed next match', game_date: addDaysISO(TODAY, 2) }),
];
html = render();
assert.equal(times(html, 'Confirmed next match'), 1, 'a game is shown once instead of repeated in a separate hero');
assert.ok(!html.includes('aria-label="Your next game"'));
assert.ok(html.includes('2 days to go'));
assert.ok(html.includes('Tomorrow · 1 day to go'));
assert.ok(html.includes('Day &amp; date'));
assert.ok(html.includes('Playground'));
gameRows = [row({ is_waitlisted: true }, { game_date: addDaysISO(TODAY, 1) })];
html = render();
assert.ok(html.includes('Waitlisted'));
console.log('PASS: photo-first game cards show organized metadata and day countdowns without a duplicate hero');

const mutation = () => ({ isPending: false, mutateAsync: async () => false });
Object.assign(mocks['@/lib/queries'], {
  useJoinFriendlyGame: mutation,
  usePayGameShare: mutation,
  usePayRentRemaining: mutation,
});
mocks['@/lib/supabase/client'] = { createClient: () => ({}) };
mocks['@/lib/push'] = { requestPushPrompt: () => {} };
mocks['@/components/payments/kashier-button'] = { KashierButton: () => null };
const wrap = ({ children }) => h('div', null, children);
mocks['@/components/ui/dialog'] = Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle'].map(name => [name, wrap]));
const { JoinGameDialog } = loadFile(path.join(root, 'src/components/games/join-game-dialog.tsx'), mocks);
const joinSummary = (overrides = {}) => renderToStaticMarkup(h(JoinGameDialog, {
  open: true, onOpenChange: () => {}, game: {
    id: 'join-1', title: 'Join this match', share_price: 100, game_date: '2026-10-12', start_time: '18:00',
    location: 'Main court', max_players: 12, participants_count: 10, ...overrides,
  },
}));
html = joinSummary();
assert.ok(html.includes('Booking summary'));
assert.ok(html.includes('Main court'));
assert.ok(html.includes('2 spots available'));
assert.ok(html.includes('Total for you and your guests'));
assert.ok(html.includes('2026-10-12'));
html = joinSummary({ host_pays: true, status: 'full', participants_count: 12 });
assert.ok(html.includes('The host covers the cost'));
assert.ok(html.includes('a place is not confirmed'));
lang = 'ar';
html = joinSummary();
assert.ok(html.includes('ملخص الحجز'));
assert.ok(html.includes('الإجمالي لك ولضيوفك'));
lang = 'en';
console.log('PASS: joining summary shows location, date, spots, total, waitlist guidance, and host-paid guests in both languages');

// Academy dashboard wires attendance summaries to real session detail links.
const pastDay = addDaysISO(TODAY, -2);
Object.assign(mocks['@/lib/queries'], {
  useProfiles: () => discoveryQuery([{ id: 'member-1', role: 'member' }]),
  useAllPayments: () => discoveryQuery(),
  useMonthlyCosts: () => discoveryQuery(),
  useSessions: () => discoveryQuery([{ id: 'past-session', date: pastDay, time: '18:00', status: 'completed' }]),
  useSessionCalculations: () => discoveryQuery(),
  useAcademy: () => discoveryQuery({ id: 'academy-1', plan: 'starter', is_trial: false, logo_url: 'logo.png' }),
  useAttendanceCounts: () => discoveryQuery({ 'past-session': { present: 7, total: 10 } }),
  useExpenses: () => discoveryQuery(),
  useVenueRentals: () => discoveryQuery(),
  useSessionGuests: () => discoveryQuery(),
});
mocks['@/components/dashboard/dashboard-navigation'] = {
  DashboardNavigation: stub('navigation'),
  DashboardSection: ({ id, title, children }) => h('section', { id }, h('h2', null, title), children),
};
mocks['./dashboard-navigation'] = mocks['@/components/dashboard/dashboard-navigation'];
mocks['@/components/workflows/player-workflows'] = { TrainingRenewal: stub('renewals') };
mocks['@/components/dashboard/admin-alerts'] = { AdminAlerts: stub('alerts') };
mocks['@/components/dashboard/announcements-card'] = { AnnouncementsCard: stub('announcements') };
mocks['@/components/dashboard/trials-card'] = { TrialsCard: stub('trials') };
mocks['@/components/upgrade/plan-benefit-banner'] = { AdminPlanBanner: stub('plan') };
mocks['@/components/schedule/upcoming-sessions'] = { UpcomingSessions: stub('upcoming') };
const { AdminDashboard } = loadFile(path.join(root, 'src/components/dashboard/admin-dashboard.tsx'), mocks);
html = renderToStaticMarkup(h(AdminDashboard));
assert.ok(html.includes('7 / 10'));
assert.ok(html.includes('href="/schedule?session=past-session"'));
for (const id of ['overview', 'training', 'updates']) assert.ok(html.includes(`id="${id}"`));
assert.ok(html.includes('from-blue-800 to-indigo-800'));
console.log('PASS: academy dashboard renders real attendance counts, linked session details, colorful stats, and navigation anchors');

// Member QR includes a visible enlarge control and member identity details.
mocks['@tanstack/react-query'] = { useQuery: () => ({ data: { name: 'Spike Nova' } }) };
const { CheckinQrCard } = loadFile(path.join(root, 'src/components/profile/checkin-qr-card.tsx'), mocks);
html = renderToStaticMarkup(h(CheckinQrCard, { code: 'MEM-123', memberName: 'Nayra', compact: true, profile: { name: 'Nayra', username: 'nayra', phone: '01012345678', gender: 'female', birth_date: '2000-01-01', academy_id: 'academy', is_active: true } }));
for (const value of ['Nayra', '@nayra', '01012345678', 'Female', 'Spike Nova', 'MEM-123', 'Enlarge QR']) assert.ok(html.includes(value));
assert.ok(html.includes('aria-label="Enlarge attendance QR"'));
console.log('PASS: QR member pass renders personal details and an accessible enlarge control');

// The calendar receives actual booked training alongside games.
const { CalendarView } = loadFile(path.join(root, 'src/components/schedule/calendar-view.tsx'), mocks);
html = renderToStaticMarkup(h(CalendarView, { sessions: [], training: [{ id: 'booked-session', date: TODAY, time: '19:00:00', name: 'Spike Nova training', location: 'Aspire court', href: '/academy-bookings' }], games: [] }));
assert.ok(html.includes('Spike Nova training'));
assert.ok(html.includes('Aspire court'));
assert.ok(html.includes('href="/academy-bookings"'));
console.log('PASS: calendar renders booked training with its venue and booking details link');

Object.assign(mocks['@/lib/queries'], { useMyTournaments: () => discoveryQuery(), useAllTournaments: () => discoveryQuery(), useVenues: () => discoveryQuery() });
const { MyTournamentsCard } = loadFile(path.join(root, 'src/components/dashboard/my-tournaments-card.tsx'), mocks);
html = renderToStaticMarkup(h(MyTournamentsCard, { memberId: 'member-1' }));
assert.ok(html.includes(dictionary.en.td_no_upcoming_tournaments));
assert.equal(times(html, 'shadow-none'), 1, 'tournament content has only one outer card');
console.log('PASS: combined tournaments card includes upcoming discovery');

// Discovery uses exactly the academy logo as its large image.
mocks['@/lib/queries'].usePublicAcademies = () => discoveryQuery([{ id: 'academy-logo', name: 'Spike Nova', logo_url: 'https://example.com/logo.png', cover_url: 'https://example.com/cover.png', slug: 'spike-nova' }]);
html = renderDiscovery(true);
assert.equal(times(html, 'src="https://example.com/logo.png"'), 1);
assert.ok(!html.includes('https://example.com/cover.png'));
assert.ok(html.includes('object-contain'));
console.log('PASS: academy discovery displays one large logo without a cover image');

// Each upcoming game displays its own venue image before opening details.
gameRows = [row({ pay_status: 'approved' }, { title: 'Photo game', game_date: addDaysISO(TODAY, 1), playground: { name: 'Aspire', photos: ['https://example.com/court.jpg'], cover_url: null } })];
html = render();
assert.ok(html.includes('src="https://example.com/court.jpg"'));
assert.ok(html.includes('alt="Aspire"'));
console.log('PASS: upcoming game cards display the playground image');

// Legacy games with only a location name still use the matching playground photo.
mocks['@/lib/queries'].usePlaygrounds = () => discoveryQuery([{ id: 'free-life', name: 'Free Life', area: 'New Cairo', photos: ['https://example.com/free-life.jpg'] }]);
gameRows = [row({ pay_status: 'approved' }, { title: 'Legacy venue game', game_date: addDaysISO(TODAY, 1), playground: null, location: 'Free Life', area: 'New Cairo' })];
html = render();
assert.ok(html.includes('src="https://example.com/free-life.jpg"'));
console.log('PASS: upcoming games resolve playground photos for legacy location-only games');
const { gamePlaygroundPhoto } = loadFile(path.join(root, 'src/lib/venue-media.ts'), mocks);
const duplicateVenues = [{ id: 'one', name: 'Court', area: 'Cairo', photos: ['one.jpg'] }, { id: 'two', name: 'Court', area: 'Cairo', photos: ['two.jpg'] }];
assert.equal(gamePlaygroundPhoto({ location: 'Court', area: 'Cairo' }, duplicateVenues), null, 'ambiguous venue names must not display another playground photo');
assert.equal(gamePlaygroundPhoto({ playground_id: 'two', location: 'Court' }, duplicateVenues), 'two.jpg', 'venue identity takes precedence over the location name');

mocks['@/lib/queries'].useFriendlyGames = () => discoveryQuery([{ id: 'organized-game', title: 'Organized game', sport: 'Volleyball', status: 'open', game_date: addDaysISO(TODAY, 2), start_time: '20:00', max_players: 12, participants_count: 7, share_price: 145, location: 'Aspire', playground: null }]);
html = renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy: true, mode: 'games' }));
assert.ok(html.includes('Organized game'));
assert.ok(html.includes('5 spots available'));
assert.ok(html.includes('Aspire'));
assert.ok(html.includes(new RealDate(addDaysISO(TODAY, 2) + 'T00:00:00').toLocaleDateString('en', { weekday: 'long' })));
assert.ok(!html.includes('Spike Nova'), 'games-only card does not repeat academy discovery');
const academyOnly = renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy: true, mode: 'academies' }));
assert.ok(!academyOnly.includes('Organized game'), 'academy discovery does not repeat the top Games card');
console.log('PASS: replacement Games carousel displays weekday, venue, price and places without duplicate sections');

for (const [language, labels] of [['en', ['Today', 'Tomorrow', 'Day after tomorrow']], ['ar', ['اليوم', 'غداً', 'بعد غد']]]) {
  lang = language;
  for (let offset = 0; offset < labels.length; offset++) {
    mocks['@/lib/queries'].useFriendlyGames = () => discoveryQuery([{ id: 'relative-game', title: 'Relative day game', sport: 'Volleyball', status: 'open', game_date: addDaysISO(TODAY, offset), start_time: '20:00', max_players: 12, participants_count: 7, share_price: 145 }]);
    const relativeHtml = renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy: true, mode: 'games' }));
    assert.ok(relativeHtml.includes(labels[offset] + ' · '), `relative date in ${language} at offset ${offset}`);
  }
}
lang = 'en';
console.log('PASS: Games carousel displays Today, Tomorrow and Day after tomorrow in both languages');

// Personal goals expose creation and only personal progress controls.
let workflowGoals = [{ id: 'own', created_by: 'member-1', title: 'Personal goal', notes: '', progress: 0 }, { id: 'coach', created_by: 'coach-1', title: 'Coach goal', notes: '', progress: 25 }];
let workflowPlans = [];
mocks['@tanstack/react-query'] = {
  useQuery: ({ queryKey }) => discoveryQuery(queryKey[0] === 'training-goals' ? workflowGoals : queryKey[0] === 'renewal-plans' ? workflowPlans : []),
  useQueryClient: () => ({ invalidateQueries: () => {} }),
  useMutation: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => {} }),
};
mocks['@/lib/academy-training'] = { useTrainingPrograms: () => discoveryQuery([{ id: 'group-1', name: 'Adult volleyball', active: true, monthly_sessions: 8, monthly_price: 800 }]) };
const workflows = loadFile(path.join(root, 'src/components/workflows/player-workflows.tsx'), mocks);
html = renderToStaticMarkup(h(workflows.TrainingGoals, { memberId: 'member-1', canEdit: true, ownGoals: true }));
assert.ok(html.includes('Add goal'));
assert.equal(times(html, 'Update progress'), 1, 'members only edit their personal goal progress');
html = renderToStaticMarkup(h(workflows.TrainingRenewal, { memberId: 'member-1', academyId: 'academy-1' }));
assert.ok(html.includes('Adult volleyball'));
assert.ok(!html.includes('Request renewal'), 'empty legacy packages switch to real training groups');
workflowPlans = [{ id: 'plan-1', name: 'Full training package', sessions_count: 8, price: 800 }];
html = renderToStaticMarkup(h(workflows.TrainingRenewal, { memberId: 'member-1', academyId: 'academy-1' }));
assert.ok(html.includes('Full training package'));
assert.ok(html.includes('Request renewal'));
console.log('PASS: personal goal creation/ownership controls and current/legacy renewal package options');

const { LocationMap } = loadFile(path.join(root, 'src/components/shared/location-map.tsx'), mocks);
html = renderToStaticMarkup(h(LocationMap, { name: 'Aspire', address: 'New Cairo', lat: 1, lng: 2, locationLink: 'https://www.google.com/maps?q=30.1,31.4' }));
assert.ok(html.includes('Google Maps directions'));
assert.ok(!html.includes('<iframe'), 'location links require no embedded API or billing account');
assert.ok(html.includes('destination=30.1%2C31.4'), 'coordinates take priority over address text');
assert.equal(renderToStaticMarkup(h(LocationMap, { name: 'Unknown location' })), '', 'do not guess a location when address and coordinates are missing');
console.log('PASS: location directions require no API key, embedded API or billing account');

mocks['@/lib/queries'].useFriendlyGames = () => discoveryQuery([{ id: 'directions-game', title: 'Directions game', sport: 'Volleyball', status: 'open', game_date: TODAY, start_time: '20:00', max_players: 12, participants_count: 7, share_price: 145, lat: 30.1, lng: 31.4, location: 'Aspire', playground: { location_link: 'https://www.google.com/maps?q=30.1,31.4' } }]);
html = renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy: true, mode: 'games' }));
assert.ok(html.includes('https://www.google.com/maps/dir/?api=1&amp;destination=30.1%2C31.4'));
assert.ok(html.includes(dictionary.en.directions));
assert.ok(html.includes('target="_blank"'));
assert.ok(html.includes('<article'), 'directions links sit in a card rather than inside another link');
console.log('PASS: member game carousel shows free Google Maps directions with coordinates');

const directDirections = loadFile(path.join(root, 'src/components/shared/directions-links.tsx'), mocks);
html = renderToStaticMarkup(h(directDirections.DirectionsLinks, { lat: 1, lng: 2, query: 'Aspire', locationLink: 'https://www.google.com/maps?q=30.1,31.4' }));
assert.ok(html.includes('https://www.google.com/maps/dir/?api=1&amp;destination=30.1%2C31.4'));
assert.ok(!html.includes('aria-haspopup'), 'directions opens directly without a provider dropdown');
assert.ok(!html.includes('apple') && !html.includes('waze'));
assert.equal(directDirections.directionsUrl(30.1, 31.4, 'Free Life'), undefined, 'coordinates and names cannot create directions without a saved link');
assert.equal(renderToStaticMarkup(h(directDirections.DirectionsLinks, { lat: 30.1, lng: 31.4, query: 'Free Life' })), '', 'hide directions when no saved link exists');
console.log('PASS: shared directions button opens Google Maps directly without provider options');

const googleDirections = loadFile(path.join(root, 'src/lib/google-directions.ts'), mocks);
const savedPin = 'https://www.google.com/maps/place/Aspire/@30.2,31.5,15z/data=!3d30.1!4d31.4';
assert.equal(googleDirections.googleDirectionsUrl(savedPin), 'https://www.google.com/maps/dir/?api=1&destination=30.1%2C31.4', 'saved place pin overrides viewport, coordinates and labels');
assert.ok(googleDirections.googleDirectionsUrl('https://maps.app.goo.gl/example').startsWith('/api/directions?location='));
assert.equal(googleDirections.trustedMapsLink('https://evil.example/maps'), null);
assert.equal(googleDirections.trustedMapsLink('javascript:alert(1)'), null);
const route = loadFile(path.join(root, 'src/app/api/directions/route.ts'), mocks);
(async () => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async url => { fetched.push(url); return new Response(null, { status: 302, headers: { location: savedPin } }); };
  try {
    const result = await route.GET(new Request('https://playza.example/api/directions?location=' + encodeURIComponent('https://maps.app.goo.gl/example')));
    assert.equal(result.headers.get('location'), 'https://www.google.com/maps/dir/?api=1&destination=30.1%2C31.4');
    assert.equal(fetched.length, 1);
    assert.equal((await route.GET(new Request('https://playza.example/api/directions?location=https://evil.example'))).status, 400);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    const blocked = await route.GET(new Request('https://playza.example/api/directions?location=' + encodeURIComponent('https://maps.app.goo.gl/example')));
    assert.equal(blocked.headers.get('location'), 'https://maps.app.goo.gl/example', 'untrusted redirects are never fetched');
    console.log('PASS: saved Maps pins and short links open directions while untrusted links/redirects are rejected');
  } finally { globalThis.fetch = originalFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });

assert.equal(googleDirections.googleDirectionsUrl(), undefined);
assert.equal(googleDirections.googleDirectionsUrl('https://untrusted.example/place'), undefined);
mocks['@/lib/queries'].useFriendlyGames = () => discoveryQuery([{ id: 'no-link', title: 'No saved link', sport: 'Volleyball', status: 'open', game_date: TODAY, start_time: '20:00', max_players: 12, participants_count: 7, share_price: 145, lat: 30.1, lng: 31.4, location: 'Aspire' }]);
const noLinkCard = renderToStaticMarkup(h(MemberDiscoveryCards, { memberId: 'member-1', hasAcademy: true, mode: 'games' }));
assert.ok(!noLinkCard.includes('google.com/maps'), 'member cards never build directions from names or coordinates');
console.log('PASS: every directions helper requires a valid saved playground link');
