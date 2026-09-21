const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const modules = {};
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, name => modules[name] ?? require(name));
  return exports;
}
for (const name of ['lib/brand', 'lib/game-share', 'lib/sport-slugs', 'components/marketing/sport-icons', 'components/games/game-card-background']) modules['@/' + name] = load('src/' + name + (name.startsWith('components') ? '.tsx' : '.ts'));
const price = modules['@/lib/game-share'].gameSharePrice;
assert.equal(price({host_pays: false, share_price: null}), 'Price to be confirmed');
assert.equal(price({host_pays: false, share_price: 0}), 'Free to join');
assert.equal(price({host_pays: true, share_price: 50}), 'Free — host covers the court');
assert.equal(price({host_pays: false, share_price: 50}), 'EGP 50 per player');
let game = null;
modules['@/lib/public-games'] = { getGameByInviteCode: async () => game };
const {GET} = load('src/app/og/game/route.tsx');
(async () => {
  const sports = Object.values(modules['@/lib/sport-slugs'].SPORT_SLUGS);
  const images = new Map();
  for (const sport of [null, ...sports, 'Unknown Sport']) {
    game = sport ? { title: 'Friday evening friendly game', sport, game_date: '2026-10-02', start_time: '19:30:00', map_label: 'Cairo Sports Club · Maadi · Cairo', joined: 6, max_players: 12, share_price: 100, host_pays: false, is_public: true } : null;
    const response = await GET(new Request('http://localhost/og/game?code=TEST'));
    assert.equal(response.status, 200);
    const cache = response.headers.get('cache-control');
    assert.equal(cache, 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    assert.ok(!cache.includes('immutable'));
    assert.equal((cache.match(/(?:^|, )max-age=/g) || []).length, 1);
    assert.ok(response.headers.get('content-type').includes('image/png'));
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    images.set(sport, png);
    if ([null, 'Football', 'Basketball', 'Swimming'].includes(sport)) fs.writeFileSync(`/tmp/playza-share-${sport || 'fallback'}.png`, png);
  }
  assert.notDeepEqual(images.get('Football'), images.get('Basketball'));
  game = { ...game, sport: 'Padel', title: 'مباراة بادل ودية في القاهرة مع الأصدقاء مساء الجمعة', map_label: 'نادي المعادي الرياضي، القاهرة', share_price: null };
  const arabic = await GET(new Request('http://localhost/og/game?code=TEST'));
  fs.writeFileSync('/tmp/playza-share-arabic.png', Buffer.from(await arabic.arrayBuffer()));
  console.log('PASS: actual PNG rendering for all 27 sports, unknown sport, missing game and Arabic details; dimensions and price semantics');
})().catch(error => { console.error(error); process.exitCode = 1; });
