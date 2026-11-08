const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const id = '00000000-0000-0000-0000-000000000001';
const privateId = '00000000-0000-0000-0000-000000000002';
const game = { creation_payment_approved:true, id, title: 'New Cairo volleyball', description: 'A real public game', sport: 'Volleyball', area: 'New Cairo', location: null, game_date: '2099-10-19', start_time: '20:00:00', max_players: 12, min_players: 6, status: 'open', skill_level: 'intermediate', gender: 'mixed', share_price: 145, host_pays: false, host_total: null, creator_name: 'Organizer', duration_hours: 2, min_age: 18, max_age: null, joined: 1, playground: { id: 'court', name: 'Court A', area: 'New Cairo', governorate: 'Cairo', country: 'Egypt', address: 'Venue entrance', cover_url: null, location_link: null } };
let queryCount = 0;
let requestedColumns = '';
const db = { from(table) {
  assert.equal(table, 'friendly_games'); queryCount++;
  let rows = [
    { ...game, is_public: true, participants: [{ is_waitlisted: false, pay_status:"approved" }, { is_waitlisted: true, pay_status:"pending" }] },
    { ...game, id: privateId, is_public: false },
    { ...game, id: '00000000-0000-0000-0000-000000000003', sport: 'Football', is_public: true },
  ];
  return {
    select(columns) { requestedColumns = columns; assert.ok(!/invite_code|player_name|member_id|pay_receipt/.test(columns)); return this; },
    eq(field, value) { rows = rows.filter(row => row[field] === value); return this; },
    in(field, values) { rows = rows.filter(row => values.includes(row[field])); return this; },
    neq(field, value) { rows = rows.filter(row => row[field] !== value); return this; },
    gte(field, value) { rows = rows.filter(row => row[field] >= value); return this; },
    limit() { return this; },
    order() { return this; },
    range: async (a,b) => ({ data: rows.slice(a,b+1).map(({ id }) => ({ id })), error: null }),
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
  };
}};
let listing = [game];
const overrides = {
  '@/components/games/game-alert-follow': { GameAlertFollow: () => null },
  '@/components/games/game-share-actions': { GameShareActions: () => null },
  '@/lib/i18n': { useI18n: () => ({ lang:'en',dir:'ltr',t:key=>({games_gender_mixed:'Mixed',nav_dashboard:'Dashboard'}[key]??key) }) },
  '@/components/layout/language-toggle': { LanguageToggle: () => null },
  './game-share-actions': { GameShareActions: () => React.createElement('button',null,'Share') },
  './game-participant-names': { GameParticipantNames: () => null, SignedInGameParticipantNames: ({publicCount}) => React.createElement('p',null,'Participants ('+publicCount+')') },
  './public-game-join': { PublicGameJoin: ({returnTo}) => React.createElement('button',{'data-return-to':returnTo},'Join this game') },
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
  if (file.endsWith('.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
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
(async()=>{
 const api=load(path.join(root,'src/lib/public-games.ts'));
 const detail=await api.getPublicGame(id);assert.equal(detail.joined,1);assert.ok(!('participants' in detail));
 game.creation_payment_approved=false;assert.equal(await api.getPublicGame(id),null,'an unapproved game cannot be fetched publicly');
 assert.deepEqual(await api.getPublicGameIds(),[],'unapproved creations are excluded from public game IDs');
 game.creation_payment_approved=true;assert.ok(await api.getPublicGame(id));
 console.log('PASS: public detail and game IDs require organizer approval and count approved roster only');
})().catch(e=>{console.error(e);process.exit(1)});
