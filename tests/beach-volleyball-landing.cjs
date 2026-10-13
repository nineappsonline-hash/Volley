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
  assert.ok(section, 'beach section must be present in server-rendered HTML');
  assert.ok(section.includes(content.BEACH_DESCRIPTION[lang]));
  assert.ok(section.includes(lang === 'ar' ? 'الكرة الطائرة الشاطئية.' : 'Beach volleyball.'));
  assert.ok(section.includes(`href="${lang === 'ar' ? '/ar' : ''}/sports/beach-volleyball"`));
  assert.ok(section.includes('href="/academies"'));
  assert.ok(section.includes('aria-pressed="false"'), 'motion control exposes its initial state');
  assert.ok(section.includes('aria-hidden="true"'), 'decorative art is excluded from the reading order');
  assert.ok(!html.includes('/beach-volleyball/cairo'), 'do not link to a nonexistent nested route');
  const viewportDir = lang === 'ar' ? 'rtl' : 'ltr';
  assert.ok(html.includes(`dir="${viewportDir}"`));
}
const metadata = content.landingPageJsonLd(seo.SITE_URL);
assert.equal(metadata.hasPart.description, content.BEACH_DESCRIPTION.en);
assert.equal(metadata.hasPart.url, `${seo.SITE_URL}/#beach-volleyball`);
assert.ok(metadata.about.some(topic => topic.name === 'Beach Volleyball'));
assert.equal(JSON.parse(seo.jsonLdStringify(metadata)).name, content.LANDING_TITLE);
const sitemap = fs.readFileSync(path.join(root, 'src/app/sitemap.ts'), 'utf8');
assert.ok(sitemap.includes('DISCOVERY_SPORTS'), 'existing sitemap covers both discovery languages');
console.log('PASS: Beach Volleyball renders in both languages with valid discovery links, accessible artwork and matching homepage structured data');
