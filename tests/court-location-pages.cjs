const assert = require('node:assert/strict');
const fs = require('fs');
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
const active = modules['@/lib/active-sports'] = load('src/lib/active-sports.ts');
const seo = modules['@/lib/seo'] = load('src/lib/seo.ts');
const slugs = modules['@/lib/sport-slugs'] = load('src/lib/sport-slugs.ts');
const discovery = modules['@/lib/sport-discovery'] = load('src/lib/sport-discovery.ts', { '@/lib/seo': seo, '@/lib/sport-slugs': slugs, '@/lib/active-sports': active });
const locs = load('src/lib/court-locations.ts', { './seo': seo, './sport-discovery': discovery });

const courts = [
  { id: 'a', name: 'Padel A', area: 'New Cairo', governorate: 'Cairo', country: 'Egypt', sport: { name: 'Padel' }, photos: [], cover_url: null, booking_price: { per_player: 150, full_court: 700, minimum_players: 4, hours: 1 }, rental_hours: 1 },
  { id: 'b', name: 'Padel B', area: 'التجمع الخامس', governorate: 'Cairo', country: 'Egypt', sport: { name: 'Padel' }, photos: [], cover_url: null, booking_price: null, rental_hours: 1 },
  { id: 'c', name: 'Tennis C', area: 'Maadi', governorate: 'Cairo', country: 'Egypt', sport: { name: 'Tennis' }, photos: [], cover_url: null, booking_price: null, rental_hours: 1 },
];

(async () => {
  // Slug mapping recognises Arabic and informal aliases.
  assert.equal(locs.locationSlugFor('New Cairo'), 'new-cairo');
  assert.equal(locs.locationSlugFor('التجمع الخامس'), 'new-cairo');
  assert.equal(locs.locationSlugFor('Tagamoa'), 'new-cairo');
  assert.equal(locs.locationSlugFor('6 October'), '6th-of-october');
  assert.equal(locs.locationSlugFor('الإسكندرية'), 'alexandria');
  assert.equal(locs.locationSlugFor('Some Unknown Area'), 'some-unknown-area');
  assert.equal(locs.locationSlugFor(''), '');

  // Inventory eligibility: only real sport+location combos.
  assert.deepEqual(locs.locationSlugsWithInventory(courts, 'Padel'), ['new-cairo']);
  assert.deepEqual(locs.locationSlugsWithInventory(courts, 'Tennis'), ['maadi']);
  assert.deepEqual(locs.locationSlugsWithInventory(courts, 'Volleyball'), []);
  assert.equal(locs.courtsForLocation(courts, 'Padel', 'new-cairo').length, 2);
  assert.equal(locs.courtsForLocation(courts, 'Padel', 'maadi').length, 0);

  // Metadata: unique, canonical, bilingual alternates.
  const en = locs.courtLocationMetadata('en', 'padel', 'new-cairo');
  const ar = locs.courtLocationMetadata('ar', 'padel', 'new-cairo');
  assert.ok(en.title.includes('New Cairo'));
  assert.ok(ar.title.includes('القاهرة الجديدة'));
  assert.notEqual(en.title, ar.title);
  assert.equal(en.alternates.canonical, '/courts/padel/new-cairo');
  assert.equal(ar.alternates.canonical, '/ar/courts/padel/new-cairo');
  assert.equal(en.alternates.languages['ar-EG'], '/ar/courts/padel/new-cairo');

  // Page component renders real courts, uses one H1, bilingual, and no empty page.
  const page = load('src/components/public/court-location-page.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
    '@/components/shared/app-logo': { AppLogo: () => null },
    '@/lib/public-playgrounds': { getPublicCourtDirectory: async () => courts },
    '@/lib/sport-discovery': discovery,
    '@/lib/sport-slugs': slugs,
    '@/lib/court-locations': locs,
    '@/lib/constants': { formatMoney: (n, lang) => `${lang} ${n}` },
    '@/lib/seo': seo,
  });
  for (const lang of ['en', 'ar']) {
    const html = renderToStaticMarkup(await page.CourtLocationPage({ lang, sport: 'padel', location: 'new-cairo' }));
    assert.ok(html.includes(`lang="${lang}"`));
    assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
    assert.equal((html.match(/<h1/g) || []).length, 1);
    assert.ok(html.includes('/p/a'));
    assert.ok(html.includes('/p/b'));
    assert.ok(!html.includes('/p/c'));
    assert.ok(html.includes('/list-your-court'));
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(json['@graph'].find(n => n['@type'] === 'ItemList').numberOfItems, 2);
    assert.ok(json['@graph'].some(n => n['@type'] === 'BreadcrumbList'));
  }
  await assert.rejects(() => page.CourtLocationPage({ lang: 'en', sport: 'padel', location: 'alexandria' }), /NOT_FOUND/);
  await assert.rejects(() => page.CourtLocationPage({ lang: 'en', sport: 'invented', location: 'new-cairo' }), /NOT_FOUND/);
  console.log('PASS: location slug mapping (EN/AR/aliases), inventory eligibility, unique bilingual metadata, canonical/hreflang, real-listings SSR, 404 for empty combos');
})().catch(e => { console.error(e); process.exitCode = 1; });
