const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let lang = 'en';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  const exports = {};
  cache.set(file, exports);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', output)(id => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === '@/lib/i18n') return { useI18n: () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t:key=>dictionary[lang][key]??key }) };
    if (id === '@/components/shared/app-logo') return { AppLogo: () => React.createElement('span', null, 'Playza') };
    if (id === '@/components/layout/language-toggle') return { LanguageToggle: () => null };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const resolved = ['', '.tsx', '.ts'].map(ext => base + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved) return load(resolved);
    }
    return require(id);
  }, exports);
  return exports;
}
const { LandingPage } = load(path.join(root, 'src/components/marketing/landing.tsx'));
const content = load(path.join(root, 'src/lib/landing-content.ts'));
const seo = load(path.join(root, 'src/lib/seo.ts'));
const {dictionary}=load(path.join(root,'src/lib/i18n/dictionary.ts'));
const {formatMoney}=load(path.join(root,'src/lib/constants.ts'));
for (lang of ['en', 'ar']) {
  const html = renderToStaticMarkup(React.createElement(LandingPage));
  const section = html.match(/<article id="beach-volleyball"[\s\S]*?<\/article>/)?.[0];
  assert.ok(html.includes('id="tennis"'));
  assert.ok(!html.includes('<section id="archery"'));
  assert.ok(html.includes('<article id="archery"'));
  assert.ok(html.includes(content.ARCHERY_DESCRIPTION[lang]));
  assert.ok(html.includes('href="/sports/archery"'));
  assert.ok(!html.includes(lang === 'ar' ? '>لاقي ملعب<' : 'Find a playground'));
  assert.ok(html.includes('heroJoin'));
  assert.match(html, /<a[^>]*class="[^"]*heroJoin[^"]*"[^>]*href="\/dashboard"/, 'hero game CTA opens the dashboard');
  assert.ok(html.includes(lang === 'ar' ? 'شوف الماتش المناسب' : 'Find a Game'));
  assert.ok(html.includes('href="/sports/tennis"'));
  assert.ok(html.includes('id="padel"'));
  assert.ok(html.includes('id="basketball"'));
  assert.ok(html.includes(content.TENNIS_DESCRIPTION[lang]));
  assert.ok(section, 'beach sport card must be present in server-rendered HTML');
  const sports = html.match(/<section id="sports"[\s\S]*?<\/section>/)?.[0];
  for (const id of ['padel','tennis','volleyball','basketball','beach-volleyball','archery']) assert.ok(sports.includes(`id="${id}"`));
  assert.ok(!html.includes('id="beach-challenge"'), 'the 3D game is replaced');
  assert.ok(html.includes('id="playza-shop"'));
  assert.ok(html.includes(lang === 'ar' ? 'تسوّق ملابس رياضية.' : 'Shop Sportswear.'));
  assert.ok(html.includes('sportswear-model-blue.webp'), 'shop uses the supplied T-shirt photograph');
  for (const color of (lang === 'ar' ? ['أسود','أزرق','أبيض'] : ['Black','Blue','White'])) {
    assert.ok(html.includes(`aria-label="${color}"`), 'color preview has accessible controls');
  }
  assert.ok(html.includes(lang === 'ar' ? '>المتجر<' : '>Shop<'), 'top menu links to the shop');
  assert.ok(html.includes('href="/shop"'), 'shop CTA opens the product catalog');
  assert.ok(!html.includes('data-shop-products'), 'product cards live only inside the shop');
  assert.ok(html.indexOf('id="playground-owners"') < html.indexOf('id="playza-shop"'));
  assert.ok(html.indexOf('class="finalCta"') > html.indexOf('id="playza-shop"'), 'the court CTA follows the shop');
  assert.ok(section.includes(content.BEACH_DESCRIPTION[lang]));

  assert.ok(section.includes('href="/sports/beach-volleyball"'));

  assert.ok(html.includes('aria-pressed="false"'), 'motion control exposes its initial state');
  assert.ok(section.includes('aria-hidden="true"'), 'decorative art is excluded from the reading order');
  assert.ok(!html.includes('/beach-volleyball/cairo'), 'do not link to a nonexistent nested route');
  assert.ok(html.includes('id="academy-management"'), 'owners have a visible homepage entry point');
  assert.ok(html.includes(`href="${lang === 'ar' ? '/ar' : ''}/academy-management"`), 'management exploration opens the owner management page');
  const viewportDir = lang === 'ar' ? 'rtl' : 'ltr';
  assert.ok(html.includes(`dir="${viewportDir}"`));
}
assert.ok(renderToStaticMarkup(React.createElement(LandingPage)).includes('href="/ar/courts"'));
// Public game previews must preserve prices, dates and the destination game.
const games = [
  { id: 'paid', title: 'Friday beach game', sport: 'Beach Volleyball', game_date: '2026-11-01', start_time: '20:00', share_price: 145, area: 'New Cairo', playground: { name: 'Sand court', area: 'New Cairo', governorate: 'Cairo', photos:['https://example.invalid/landing-court.jpg'] } },
  { id: 'host', title: 'Hosted game', sport: 'Volleyball', game_date: '2026-11-02', start_time: '18:00', share_price: 200, host_pays: true },
  { id: 'unknown', title: '<script>unsafe</script>', sport: 'Volleyball', game_date: '2026-11-03', start_time: '18:00', share_price: null },
].map(game=>({max_players:12,min_players:6,joined:3,status:'open',gender:'mixed',creator_name:'Host',...game}));
for (lang of ['en', 'ar']) {
  const html = renderToStaticMarkup(React.createElement(LandingPage, { upcomingGames: games }));
  const section = html.match(/<section id="upcoming-games"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section.includes('Friday beach game'));
  assert.ok(section.includes('src="https://example.invalid/landing-court.jpg"'));
  assert.ok(section.includes('3/12'));
  assert.ok(section.includes('aria-expanded="false"'), 'shared cards expose their collapsed details control');
  assert.ok(!section.includes('href="/dashboard?focus=paid"'));
  assert.ok(section.includes('Sand court'));
  assert.match(section, /datetime="2026-11-01"/i);
  assert.ok(section.includes('href="/games/paid"'));
  assert.ok(section.includes(formatMoney(145,lang)));
  assert.ok(section.includes(lang === 'ar' ? 'مجاني' : 'Free'));
  assert.ok(section.includes('—'));
  assert.ok(!section.includes('<script>unsafe</script>'));
  assert.ok(!html.includes('id="find-your-court"'), 'discovery section was removed from the homepage');
  assert.ok(html.indexOf('id="upcoming-games"') < html.indexOf('id="sports"'));
  const empty = renderToStaticMarkup(React.createElement(LandingPage));
  assert.ok(empty.includes(lang === 'ar' ? 'شوف المواعيد المتاحة' : 'Check the games page'));
  assert.ok(!empty.includes('Friday beach game'));
}
const metadata = content.landingPageJsonLd(seo.SITE_URL);
assert.equal(metadata.hasPart.find(part => part.url.endsWith("/#beach-volleyball")).description, content.BEACH_DESCRIPTION.en);
assert.equal(metadata.hasPart.find(part => part.url.endsWith("/#beach-volleyball")).url, `${seo.SITE_URL}/#beach-volleyball`);
assert.ok(metadata.about.some(topic => topic.name === 'Beach Volleyball'));
assert.equal(JSON.parse(seo.jsonLdStringify(metadata)).name, content.LANDING_TITLE);
const sitemap = fs.readFileSync(path.join(root, 'src/app/sitemap.ts'), 'utf8');
assert.ok(sitemap.includes('DISCOVERY_SPORTS'), 'existing sitemap covers both discovery languages');
console.log('PASS: Beach Volleyball renders in both languages with valid discovery links, accessible artwork and matching homepage structured data');
