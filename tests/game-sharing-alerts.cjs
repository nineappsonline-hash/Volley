const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let lang = 'en', lastMessage = '';
const tracked = [];
const modules = { '@/lib/analytics/events': { trackBusinessEvent(name, context) { tracked.push({ name, ...context }); } } };
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, id => mocks[id] ?? modules[id] ?? require(id));
  return exports;
}
modules['@/lib/active-sports'] = load('src/lib/active-sports.ts');
modules['@/lib/seo'] = load('src/lib/seo.ts');
modules['@/lib/sport-slugs'] = load('src/lib/sport-slugs.ts');
modules['@/lib/game-share'] = load('src/lib/game-share.ts');
modules['@/lib/game-alert-preferences'] = load('src/lib/game-alert-preferences.ts');
const { gameSharingTarget } = modules['@/lib/game-share'];
const { updateGameAlertPreferences } = modules['@/lib/game-alert-preferences'];
const game = { id: 'public-id', title: 'Friends & volleyball', sport: 'Volleyball', game_date: '2026-11-01', start_time: '20:00:00', status: 'open', max_players: 12, joined: 9, share_price: 145, is_public: true, invite_code: 'SECRET', place: 'Court A, New Cairo' };
function buttons(node, results = []) {
  if (!node || typeof node !== 'object') return results;
  if (node.props?.onSelect) results.push(node);
  React.Children.forEach(node.props?.children, child => buttons(child, results));
  return results;
}
modules['@/components/ui/dropdown-menu'] = Object.fromEntries(['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'].map(name => [name, ({ children }) => React.createElement('div', null, children)]));
const share = load('src/components/games/game-share-actions.tsx', {
  react: { ...React, useState: () => ['', value => { if (typeof value === "string") lastMessage = value; }] },
  '@/lib/i18n': { useI18n: () => ({ lang }) },
  '@/components/ui/button': { Button: ({ asChild, children, ...props }) => asChild ? children : React.createElement('button', props, children) },
});
(async () => {
  const target = gameSharingTarget(game, 'https://playza.example/');
  assert.equal(new URL(target.url).origin + new URL(target.url).pathname, 'https://playza.example/games/public-id');
  assert.equal(new URL(target.url).searchParams.get('utm_campaign'), 'game_share');
  assert.ok(!target.whatsappUrl.includes('SECRET'));
  const text = new URL(target.whatsappUrl).searchParams.get('text');
  for (const expected of [game.title, '20:00', 'Cairo time', game.place, 'EGP 145', '3 spots', target.url]) assert.ok(text.includes(expected));
  assert.ok(gameSharingTarget({ ...game, host_pays: true }, 'https://example.com').text.includes('Free — host covers'));
  assert.ok(gameSharingTarget({ ...game, share_price: null }, 'https://example.com').text.includes('Price to be confirmed'));
  assert.ok(gameSharingTarget({ ...game, status: 'full' }, 'https://example.com').text.includes('Full; check waitlist'));
  assert.ok(gameSharingTarget({ ...game, status: 'cancelled' }, 'https://example.com').text.includes('Cancelled'));
  assert.ok(gameSharingTarget({ ...game, is_public: false }, 'https://example.com').url.includes('?join=SECRET&'));
  assert.equal(gameSharingTarget({ ...game, is_public: false, invite_code: null }, 'https://example.com'), null);
  for (lang of ['en', 'ar']) {
    const element = share.GameShareActions({ game });
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes(lang === 'ar' ? 'واتساب' : 'WhatsApp'));
    assert.ok(html.includes('https://wa.me/?text='));
    assert.ok(html.includes('rel="noopener noreferrer"'));
    assert.ok(html.includes('readonly=""'));
    for (const domain of ['facebook.com/sharer/sharer.php', 't.me/share/url', 'twitter.com/intent/tweet', 'linkedin.com/sharing/share-offsite']) assert.ok(html.includes(domain));
    assert.ok(html.includes(lang === 'ar' ? 'إنستجرام' : 'Instagram'));
  }
  lang = 'en';
  const compact = share.GameShareActions({ game, compact: true });
  assert.equal(buttons(compact).length, 3, 'compact menu has Instagram, native sharing and copy actions');
  const compactHtml = renderToStaticMarkup(compact);
  assert.ok(!compactHtml.includes('<input') && !compactHtml.includes('Bring a friend'));
  const actions = buttons(share.GameShareActions({ game })).filter(action => React.Children.toArray(action.props.children).some(child => child === "Copy link" || child === "More apps"));
  let copied, nativeCalls = 0;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value; } }, share: async () => { nativeCalls++; throw { name: 'AbortError' }; } } });
  await actions[1].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(new URL(copied).pathname, '/games/public-id');
  assert.equal(lastMessage, 'Game link copied');
  lastMessage = ''; copied = null;
  const beforeCancel = tracked.length;
  await actions[0].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(tracked.length, beforeCancel, 'cancelled share is not tracked');
  assert.equal(nativeCalls, 1); assert.equal(copied, null); assert.equal(lastMessage, '', 'cancel does not trigger fallback');
  navigator.share = async payload => { assert.equal(new URL(payload.url).searchParams.get('utm_source'), 'native_share'); };
  await actions[0].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(tracked.at(-1).share_method, 'native_share');
  await buttons(compact)[0].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(new URL(copied).searchParams.get('utm_source'), 'instagram');
  assert.ok(lastMessage.includes('Open Instagram'));
  navigator.share = undefined;
  await actions[0].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(new URL(copied).pathname, '/games/public-id');
  navigator.clipboard.writeText = async () => { throw Error('denied'); };
  await actions[1].props.onSelect(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(lastMessage.includes('copy it manually'));
  for (const source of ['facebook', 'instagram', 'telegram', 'x', 'linkedin', 'native_share', 'copy_link']) {
    const shared = gameSharingTarget({ ...game, is_public: false }, 'https://example.com', 'en', source);
    assert.equal(new URL(shared.url).searchParams.get('utm_source'), source);
    assert.equal(new URL(shared.url).searchParams.get('join'), 'SECRET');
  }
  const original = { interested_sports: ['Padel', 'volleyball'], notify_game_alerts: false, bio: 'Keep', community_visible: false };
  let updated = updateGameAlertPreferences(original, 'Volleyball', true);
  assert.deepEqual(updated, { interested_sports: ['Padel', 'Volleyball'], notify_game_alerts: true });
  assert.equal(original.bio, 'Keep'); assert.equal(original.community_visible, false);
  updated = updateGameAlertPreferences(updated, 'Volleyball', false);
  assert.deepEqual(updated, { interested_sports: ['Padel'], notify_game_alerts: true });
  assert.deepEqual(updateGameAlertPreferences(updated, 'Padel', false), { interested_sports: [], notify_game_alerts: false });
  assert.ok(updateGameAlertPreferences(original, 'Padel', true).interested_sports.includes('Padel'));
  assert.throws(() => updateGameAlertPreferences(original, 'invalid sport', true), /Unknown sport/);
  let signedIn = true, updateFailure = false, writes = 0;
  let stored = { ...original };
  const db = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'me' } : null }, error: null }) }, from(table) {
    assert.equal(table, 'profiles'); let patch;
    return { select(columns) { assert.equal(columns, 'interested_sports, notify_game_alerts'); return this; },
      eq(field, value) { assert.equal(field, 'id'); assert.equal(value, 'me', 'scope is the authenticated account'); return this; },
      update(values) { assert.deepEqual(Object.keys(values).sort(), ['interested_sports', 'notify_game_alerts']); patch = values; return this; },
      async single() { if (patch && updateFailure) return { data: null, error: Error('denied') }; if (patch) { writes++; stored = { ...stored, ...patch }; } return { data: stored, error: null }; },
    };
  }};
  const route = load('src/app/api/game-alerts/route.ts', { 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } }, '@/lib/supabase/server': { createClient: () => db } });
  const request = (body, origin = 'https://playza.example') => new Request('https://playza.example/api/game-alerts', { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  signedIn = false;
  assert.equal((await route.GET()).headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await route.PATCH(request({ sport: 'Volleyball', following: true }))).status, 401);
  assert.equal(writes, 0);
  signedIn = true;
  assert.equal((await route.PATCH(request({ sport: 'Volleyball', following: true }, 'https://evil.example'))).status, 403);
  assert.equal((await route.PATCH(request({ sport: 'invalid sport', following: true }))).status, 400);
  assert.equal(writes, 0);
  assert.equal((await route.PATCH(request({ sport: 'Volleyball', following: true, id: 'someone-else' }))).status, 200);
  assert.deepEqual(stored.interested_sports, ['Padel', 'Volleyball']);
  assert.equal(stored.bio, 'Keep'); assert.equal(stored.community_visible, false);
  const proxyRequest = new Request('http://localhost:3100/api/game-alerts', { method: 'PATCH', headers: { Host: 'playza.example', Origin: 'https://playza.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ sport: 'Volleyball', following: true }) });
  assert.equal((await route.PATCH(proxyRequest)).status, 200, 'same-site requests survive reverse proxy URL rewriting');
  updateFailure = true;
  assert.equal((await route.PATCH(request({ sport: 'Volleyball', following: false }))).status, 500);
  assert.equal(writes, 2, 'failed saves are not reported as success');
  console.log('PASS: detailed bilingual sharing, private link handling, cancellation, clipboard fallback, opt-in/out, scoped API writes, preserved privacy, and failed saves');
})().catch(error => { console.error(error); process.exitCode = 1; });
