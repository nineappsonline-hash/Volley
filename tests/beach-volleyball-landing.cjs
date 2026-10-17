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
    if (id === '@/lib/i18n') return { useI18n: () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }) };
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
for (lang of ['en', 'ar']) {
  const html = renderToStaticMarkup(React.createElement(LandingPage));
  const section = html.match(/<section id="beach-volleyball"[\s\S]*?<\/section>/)?.[0];
  assert.ok(html.includes('id="tennis"'));
  assert.ok(html.includes('href="/games?sport=tennis"'));
  assert.ok(!html.includes('Padel') && !html.includes('البادل'));
  assert.ok(html.includes(lang === 'ar' ? 'التنس. ماتشك الجاي يبدأ هنا.' : 'Tennis. Find your next rally.'));
  assert.ok(section, 'beach section must be present in server-rendered HTML');
  assert.ok(section.includes(content.BEACH_DESCRIPTION[lang]));
  assert.ok(section.includes(lang === 'ar' ? 'الكرة الطائرة الشاطئية.' : 'Beach volleyball.'));
  assert.ok(section.includes(`href="${lang === 'ar' ? '/ar' : ''}/sports/beach-volleyball"`));
  assert.ok(section.includes('href="/academies"'));
  assert.ok(section.includes('aria-pressed="false"'), 'motion control exposes its initial state');
  assert.ok(section.includes('aria-hidden="true"'), 'decorative art is excluded from the reading order');
  assert.ok(!html.includes('/beach-volleyball/cairo'), 'do not link to a nonexistent nested route');
  assert.ok(html.includes('id="academy-management"'), 'owners have a visible homepage entry point');
  assert.ok(html.includes(`href="${lang === 'ar' ? '/ar' : ''}/academy-management"`), 'management link follows homepage language');
  const viewportDir = lang === 'ar' ? 'rtl' : 'ltr';
  assert.ok(html.includes(`dir="${viewportDir}"`));
}
assert.ok(renderToStaticMarkup(React.createElement(LandingPage)).includes('href="/ar/courts"'));
// Public game previews must preserve prices, dates and the destination game.
const games = [
  { id: 'paid', title: 'Friday beach game', sport: 'Beach Volleyball', game_date: '2026-11-01', start_time: '20:00', share_price: 145, area: 'New Cairo', playground: { name: 'Sand court', area: 'New Cairo', governorate: 'Cairo' } },
  { id: 'host', title: 'Hosted game', sport: 'Volleyball', game_date: '2026-11-02', start_time: '18:00', share_price: 200, host_pays: true },
  { id: 'unknown', title: '<script>unsafe</script>', sport: 'Volleyball', game_date: '2026-11-03', start_time: '18:00', share_price: null },
];
for (lang of ['en', 'ar']) {
  const html = renderToStaticMarkup(React.createElement(LandingPage, { upcomingGames: games }));
  const section = html.match(/<section id="upcoming-games"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section.includes('Friday beach game'));
  assert.ok(section.includes('Sand court, New Cairo, Cairo'));
  assert.match(section, /datetime="2026-11-01"/i);
  assert.ok(section.includes('href="/games/paid"'));
  assert.ok(section.includes(lang === 'ar' ? '145 جنيه لكل لاعب' : 'EGP 145 per player'));
  assert.ok(section.includes(lang === 'ar' ? 'مجاني' : 'Free — host covers the court'));
  assert.ok(section.includes(lang === 'ar' ? 'التكلفة لم تتحدد بعد' : 'Price to be confirmed'));
  assert.ok(!section.includes('<script>unsafe</script>'));
  assert.ok(html.indexOf('id="upcoming-games"') < html.indexOf('id="find-your-court"'));
  const empty = renderToStaticMarkup(React.createElement(LandingPage));
  assert.ok(empty.includes(lang === 'ar' ? 'راجع صفحة الماتشات' : 'Check the games page'));
  assert.ok(!empty.includes('Friday beach game'));
}
const metadata = content.landingPageJsonLd(seo.SITE_URL);
assert.equal(metadata.hasPart.description, content.BEACH_DESCRIPTION.en);
assert.equal(metadata.hasPart.url, `${seo.SITE_URL}/#beach-volleyball`);
assert.ok(metadata.about.some(topic => topic.name === 'Beach Volleyball'));
assert.equal(JSON.parse(seo.jsonLdStringify(metadata)).name, content.LANDING_TITLE);
const sitemap = fs.readFileSync(path.join(root, 'src/app/sitemap.ts'), 'utf8');
assert.ok(sitemap.includes('DISCOVERY_SPORTS'), 'existing sitemap covers both discovery languages');
console.log('PASS: Beach Volleyball renders in both languages with valid discovery links, accessible artwork and matching homepage structured data');
