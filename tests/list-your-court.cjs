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
const seo = modules['@/lib/seo'] = load('src/lib/seo.ts');
const lib = load('src/lib/list-your-court.ts', { '@/lib/seo': seo });
modules['@/lib/academy-management'] = load('src/lib/academy-management.ts', { '@/lib/seo': seo });

(async () => {
  for (const lang of ['en', 'ar']) {
    const meta = lib.listYourCourtMetadata(lang);
    assert.ok(meta.title.length > 10);
    assert.ok(meta.description.length > 40);
    assert.equal(meta.alternates.canonical, lib.listYourCourtPath(lang));
    assert.equal(meta.alternates.languages.en, '/list-your-court');
    assert.equal(meta.alternates.languages['ar-EG'], '/ar/list-your-court');
    assert.equal(meta.alternates.languages['x-default'], '/list-your-court');
    assert.ok(Array.isArray(meta.keywords) && meta.keywords.length > 0);
  }
  assert.notEqual(lib.listYourCourtMetadata('en').title, lib.listYourCourtMetadata('ar').title);

  // Guard the honest-claims rule: content must not promise cancellation elimination.
  const copy = JSON.stringify(lib.LIST_YOUR_COURT).toLowerCase();
  assert.ok(copy.includes('no commission') || copy.includes('عمولة'));
  assert.ok(!/no cancellations|zero cancellations|eliminat/.test(copy));

  const page = load('src/components/marketing/list-your-court-page.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/lib/list-your-court': lib,
    '@/lib/seo': seo,
  });
  for (const lang of ['en', 'ar']) {
    const html = renderToStaticMarkup(page.ListYourCourtPage({ lang }));
    assert.ok(html.includes(`lang="${lang}"`));
    assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
    assert.equal((html.match(/<h1/g) || []).length, 1);
    assert.ok(html.includes('href="/signup/owner"'));
    assert.ok(html.includes('href="/courts?sport=padel"'));
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.ok(json['@graph'].some(n => n['@type'] === 'FAQPage'));
    assert.ok(json['@graph'].some(n => n['@type'] === 'Service'));
    assert.ok(json['@graph'].some(n => n['@type'] === 'BreadcrumbList'));
    assert.equal(json['@graph'].find(n => n['@type'] === 'FAQPage').mainEntity.length, 6);
  }
  console.log('PASS: venue owner landing metadata, canonical/hreflang, honest claims, bilingual SSR, single H1, structured data, CTAs and internal links');
})().catch(e => { console.error(e); process.exitCode = 1; });
