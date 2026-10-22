const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const modules = {};
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, name => mocks[name] ?? modules[name] ?? require(name));
  return exports;
}
modules['@/lib/active-sports'] = load('src/lib/active-sports.ts');
modules['@/lib/seo'] = load('src/lib/seo.ts');
modules['@/lib/game-share'] = load('src/lib/game-share.ts');
modules['@/lib/game-discovery'] = load('src/lib/game-discovery.ts');
modules['@/lib/local-games'] = load('src/lib/local-games.ts');
modules['@/lib/sport-slugs'] = load('src/lib/sport-slugs.ts');
modules['@/lib/volleyball-guides'] = load('src/lib/volleyball-guides.ts');
const discovery = modules['@/lib/sport-discovery'] = load('src/lib/sport-discovery.ts');
const { DISCOVERY_SPORTS, discoveryMetadata, discoveryPath } = discovery;
assert.equal(DISCOVERY_SPORTS.length, 6);
assert.equal(new Set(DISCOVERY_SPORTS.map(s => s.advice.en)).size, 6);
assert.equal(new Set(DISCOVERY_SPORTS.map(s => s.advice.ar)).size, 6);
for (const sport of DISCOVERY_SPORTS) {
  for (const lang of ['en', 'ar']) {
    const meta = discoveryMetadata(lang, sport);
    assert.equal(meta.alternates.canonical, discoveryPath(lang, sport.slug));
    assert.equal(meta.alternates.languages.en, discoveryPath('en', sport.slug));
    assert.equal(meta.alternates.languages['ar-EG'], discoveryPath('ar', sport.slug));
    assert.ok(sport.advice[lang].length > 60);
  }
}
let listed = false;
const game = { id: 'g', title: '<script>untrusted</script>', game_date: '2030-01-01', start_time: '18:00', sport: 'Tennis', host_pays: false, share_price: null, playground: { name: 'Court', governorate: 'Cairo', area: 'Maadi' }, location: 'Cairo' };
const page = load('src/components/public/sport-discovery-page.tsx', {
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
  '@/components/marketing/sport-icons': { SportIcon: () => null },
  '@/components/shared/app-logo': { AppLogo: () => 'Playza' },
  '@/lib/public-playgrounds': { getPublicCourtDirectory: async () => [] },
  '@/lib/court-discovery': { courtsPath: (lang, slug) => `${lang === 'ar' ? '/ar' : ''}/courts${slug ? `?sport=${slug}` : ''}` },
  '@/lib/court-locations': { courtsLocationPath: (lang, sport, loc) => `${lang === 'ar' ? '/ar' : ''}/courts/${sport}/${loc}`, locationLabel: (lang, slug) => slug, locationSlugsWithInventory: () => [] },
  '@/lib/public-games': { getPublicGames: async sport => { assert.ok(Object.values(modules['@/lib/sport-slugs'].SPORT_SLUGS).includes(sport)); return listed && sport !== 'Archery' ? [game, { ...game, id: 'other', title: 'Elsewhere', playground: { governorate: 'Alexandria' } }] : []; } },
  '@/lib/public-sport-academies': { getCairoSportAcademies: async () => listed ? [{ name: 'Public Academy', slug: 'public-academy', area: 'Maadi', governorate: 'Cairo' }] : [] },
  '@/lib/constants': { formatTime12h: value => value, formatMoney: value => String(value) },
});
(async () => {
  for (const sport of DISCOVERY_SPORTS) {
    for (const lang of ['en', 'ar']) {
      const html = renderToStaticMarkup(await page.SportDiscoveryPage({ slug: sport.slug, lang }));
      assert.ok(html.includes(`lang="${lang}"`));
      assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
      assert.ok(html.includes(sport.advice[lang]));
      assert.equal((html.match(/<h1/g) || []).length, 1);
      const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
      const faq = json['@graph'].find(node => node['@type'] === 'FAQPage');
      assert.equal(faq.mainEntity.length, 4);
      assert.ok(html.includes(`href="${discoveryPath(lang === 'en' ? 'ar' : 'en', sport.slug)}"`));
    }
  }
  const archery = renderToStaticMarkup(await page.SportDiscoveryPage({ slug: 'archery', lang: 'en' }));
  assert.ok(archery.includes('Choosing archery training for beginners'));
  assert.ok(!archery.includes('/games?sport=archery'));
  assert.equal(discoveryMetadata('en', DISCOVERY_SPORTS.find(s=>s.slug==='archery')).alternates.languages['ar-EG'], '/ar/sports/archery');
  await assert.rejects(page.SportDiscoveryPage({ slug: 'unknown', lang: 'en' }), /NOT_FOUND/);
  listed = true;
  const populated = renderToStaticMarkup(await page.SportDiscoveryPage({ slug: 'tennis', lang: 'en' }));
  assert.ok(populated.includes('href="/a/public-academy"'));
  assert.ok(populated.includes('Confirm the cost'));
  assert.ok(populated.includes('href="/games/g"'));
  const localLinks = renderToStaticMarkup(await page.SportDiscoveryPage({ slug: 'volleyball', lang: 'ar' }));
  assert.ok(localLinks.includes('href="/ar/play/volleyball-new-cairo"'));
  assert.ok(localLinks.includes('href="/ar/play/beach-volleyball-new-cairo"'));
  assert.ok(!populated.includes('Elsewhere'));
  assert.ok(!populated.includes('<script>untrusted</script>'));
  const robots = load('src/app/robots.ts').default();
  for (const name of ['*', 'OAI-SearchBot', 'Google-Extended', 'Claude-SearchBot', 'PerplexityBot']) {
    const rule = robots.rules.find(rule => rule.userAgent === name);
    assert.equal(rule.allow, '/');
    assert.ok(rule.disallow.includes('/api/'));
    assert.ok(!rule.disallow.some(path => '/sports/tennis'.startsWith(path)));
  }
  const llms = await load('src/app/llms.txt/route.ts').GET().text();
  for (const sport of DISCOVERY_SPORTS) assert.ok(llms.includes(`/sports/${sport.slug}`));
  console.log('PASS: featured sports including archery in both languages, SSR content, canonicals, language links, FAQ data, unknown slugs, real listings, escaped content and crawler access');
})().catch(error => { console.error(error); process.exitCode = 1; });
