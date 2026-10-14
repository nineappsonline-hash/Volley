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
const { AcademyManagementPage } = load(path.join(root, 'src/components/marketing/academy-management-page.tsx'));
const { ACADEMY_MANAGEMENT, academyManagementMetadata, academyManagementPath } = load(path.join(root, 'src/lib/academy-management.ts'));
for (const locale of ['en', 'ar']) {
  const c = ACADEMY_MANAGEMENT[locale];
  const html = renderToStaticMarkup(React.createElement(AcademyManagementPage, { lang: locale }));
  assert.ok(html.includes(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`));
  assert.ok(html.includes(c.title));
  assert.ok(html.includes('href="/signup/tenant"'));
  assert.ok(html.includes(`href="${academyManagementPath(locale === 'ar' ? 'en' : 'ar')}"`));
  const graph = JSON.parse(html.match(/<script[^>]*>(.*?)<\/script>/s)[1])['@graph'];
  const software = graph.find(node => node['@type'] === 'SoftwareApplication');
  assert.deepEqual(software.featureList, c.features.map(([title]) => title));
  assert.equal(software.offers, undefined, 'do not invent software pricing');
  const faq = graph.find(node => node['@type'] === 'FAQPage');
  assert.deepEqual(faq.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), c.faqs.map(pair => [...pair]));
  for (const [q, a] of c.faqs) { assert.ok(html.includes(q)); assert.ok(html.includes(a.replaceAll('’', '&#x27;')) || html.includes(a)); }
  const meta = academyManagementMetadata(locale);
  assert.equal(meta.alternates.canonical, academyManagementPath(locale));
  assert.equal(meta.alternates.languages['ar-EG'], '/ar/academy-management');
  assert.equal(meta.alternates.languages.en, '/academy-management');
}
console.log('PASS: bilingual academy management SSR, reciprocal metadata, registration links and truthful matching structured data');
