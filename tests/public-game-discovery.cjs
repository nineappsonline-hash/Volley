const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const id = '00000000-0000-0000-0000-000000000001';
const privateId = '00000000-0000-0000-0000-000000000002';
const game = { id, title: 'New Cairo volleyball', description: 'A real public game', sport: 'Volleyball', area: 'New Cairo', location: null, game_date: '2099-10-19', start_time: '20:00:00', max_players: 12, min_players: 6, status: 'open', skill_level: 'intermediate', gender: 'mixed', share_price: 145, host_pays: false, host_total: null, creator_name: 'Organizer', duration_hours: 2, min_age: 18, max_age: null, joined: 1, playground: { id: 'court', name: 'Court A', area: 'New Cairo', governorate: 'Cairo', country: 'Egypt', address: 'Venue entrance', cover_url: null, location_link: null } };
let queryCount = 0;
let requestedColumns = '';
const db = { from(table) {
  assert.equal(table, 'friendly_games'); queryCount++;
  let rows = [
    { ...game, is_public: true, participants: [{ is_waitlisted: false }, { is_waitlisted: true }] },
    { ...game, id: privateId, is_public: false },
    { ...game, id: '00000000-0000-0000-0000-000000000003', sport: 'Football', is_public: true },
  ];
  return {
    select(columns) { requestedColumns = columns; assert.ok(!/invite_code|player_name|member_id|pay_receipt/.test(columns)); return this; },
    eq(field, value) { rows = rows.filter(row => row[field] === value); return this; },
    in(field, values) { rows = rows.filter(row => values.includes(row[field])); return this; },
    gte(field, value) { rows = rows.filter(row => row[field] >= value); return this; },
    order() { return this; },
    range: async (a,b) => ({ data: rows.slice(a,b+1).map(({ id }) => ({ id })), error: null }),
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
  };
}};
let listing = [game];
const overrides = {
  '@/components/games/game-alert-follow': { GameAlertFollow: () => null },
  '@/components/games/game-share-actions': { GameShareActions: () => null },
  'next/cache': { unstable_noStore() {} },
  'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/lib/supabase/admin': { createAdminClient: () => db },
  '@/components/shared/app-logo': { AppLogo: () => React.createElement('span', null, 'Playza') },
  '@/components/shared/directions-links': { DirectionsLinks: () => null },
  '@/components/games/player-joining-guide': { PlayerJoiningGuide: () => null },
  '@/components/games/public-game-join': { PublicGameJoin: ({ returnTo }) => React.createElement('button', { 'data-return-to': returnTo }, 'Join this game') },
  '@/lib/public-playgrounds': { getPublicCourtDirectory: async () => [{ id: 'court', name: 'Approved court', area: 'New Cairo', governorate: 'Cairo' }, { id: 'other', name: 'Elsewhere court', area: 'Alexandria' }] },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', js)(id => {
    if (overrides[id]) return overrides[id];
    if (id === 'react') return { ...React, cache: fn => fn };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(['', '.tsx', '.ts'].map(ext => base + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()));
    }
    return require(id);
  }, exports);
  return exports;
}
(async () => {
  const api = load(path.join(root, 'src/lib/public-games.ts'));
  const seo = load(path.join(root, 'src/lib/game-discovery.ts'));
  const local = load(path.join(root, 'src/lib/local-games.ts'));
  const detail = await api.getPublicGame(id);
  assert.equal(detail.joined, 1, 'waitlisted players are not confirmed players');
  assert.ok(!('participants' in detail), 'player records stay on the server');
  assert.equal(await api.getPublicGame(privateId), null, 'private IDs must not resolve');
  assert.equal(await api.getPublicGame('00000000-0000-0000-0000-000000000003'), null, 'paused sports are absent from public discovery');
  assert.deepEqual(await api.getPublicGames('Football'), []);
  const before = queryCount;
  assert.equal(await api.getPublicGame('invalid'), null);
  assert.equal(queryCount, before, 'invalid IDs skip the admin query');
  assert.deepEqual(await api.getPublicGameIds(), [id]);
  assert.equal(seo.cairoGameStart('2026-01-15', '20:00').toISOString(), '2026-01-15T18:00:00.000Z');
  assert.equal(seo.cairoGameStart('2026-07-15', '20:00:00').toISOString(), '2026-07-15T17:00:00.000Z');
  assert.equal(seo.cairoGameStart('2026-01-15', '00:30').toISOString(), '2026-01-14T22:30:00.000Z');
  const event = seo.publicGameEvent(game);
  assert.equal(event['@type'], 'SportsEvent');
  assert.equal(event.offers.price, 145);
  assert.equal(event.offers.priceCurrency, 'EGP');
  assert.equal(Date.parse(event.endDate) - Date.parse(event.startDate), 7200000);
  assert.equal(event.url, `https://playza.nineapps.online/games/${id}`);
  assert.equal(event.location.address.addressLocality, 'New Cairo');
  assert.equal(seo.publicGameEvent({ ...game, host_pays: true }).offers.price, 0);
  assert.equal(seo.publicGameEvent({ ...game, share_price: null }).offers, undefined);
  assert.equal(seo.publicGameEvent({ ...game, playground: null }), null);
  assert.equal(seo.publicGameEvent({ ...game, status: 'full' }).offers.availability, 'https://schema.org/SoldOut');
  assert.equal(seo.publicGameEvent({ ...game, status: 'cancelled' }).eventStatus, 'https://schema.org/EventCancelled');
  assert.equal(seo.gameIsJoinable({ ...game, status: 'completed' }), false);
  assert.equal(seo.gameIsJoinable({ ...game, game_date: '2000-01-01' }), false);
  assert.ok(seo.publicGameMetadata(game).alternates.canonical.endsWith(`/games/${id}`));
  const page = load(path.join(root, 'src/app/games/[id]/page.tsx'));
  let html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id }) }));
  assert.ok(html.includes(`<h1 class="text-3xl font-bold sm:text-4xl">${game.title}</h1>`));
  assert.ok(html.includes(`data-return-to="/games/${id}"`));
  assert.ok(html.includes('EGP 145 per player'));
  assert.ok(html.includes('SportsEvent'));
  for (const status of ['completed', 'cancelled']) {
    game.status = status;
    html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id }) }));
    assert.ok(!html.includes('data-return-to='), 'closed games do not offer joining');
    assert.ok(html.includes(status === 'cancelled' ? 'EventCancelled' : 'Completed'));
  }
  game.status = 'open';
  await assert.rejects(page.default({ params: Promise.resolve({ id: privateId }) }), /NOT_FOUND/);
  await assert.rejects(page.generateMetadata({ params: Promise.resolve({ id: privateId }) }), /NOT_FOUND/);
  overrides['@/lib/public-games'] = { getPublicGames: async () => listing };
  const localPage = load(path.join(root, 'src/components/public/local-game-page.tsx'));
  for (const lang of ['en', 'ar']) for (const guide of local.LOCAL_GAME_GUIDES) {
    listing = [game, { ...game, id: 'out-of-area', title: 'Other area', area: 'Alexandria', playground: null }, { ...game, id: 'out-of-sport', title: 'Other sport', sport: 'Football' }];
    html = renderToStaticMarkup(await localPage.LocalGamePage({ lang, slug: guide.slug }));
    assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
    assert.ok(html.includes(guide[lang].title));
    assert.ok(!html.includes('Other area') && !html.includes('Other sport'));
    assert.ok(!html.includes('Elsewhere court'));
    assert.ok(html.includes(`href="${local.localGamePath(lang === 'ar' ? 'en' : 'ar', guide.slug)}"`));
    assert.ok(!html.includes('SportsEvent'), 'listing pages do not mark up individual events');
    if (guide.sport === 'Volleyball') assert.ok(html.includes(`/games/${id}`));
    else assert.ok(html.includes(lang === 'ar' ? 'مفيش ماتشات منشورة' : 'No upcoming public games'));
    const meta = local.localGameMetadata(lang, guide);
    assert.equal(meta.alternates.canonical, local.localGamePath(lang, guide.slug));
  }
  await assert.rejects(localPage.LocalGamePage({ lang: 'en', slug: 'invented-city' }), /NOT_FOUND/);
  console.log('PASS: public-only queries, private 404s, roster minimization, Cairo DST, truthful event schema, join return path, and bilingual local inventory filtering');
})().catch(e => { console.error(e); process.exitCode = 1; });
