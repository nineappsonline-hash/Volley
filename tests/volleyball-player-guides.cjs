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
const { VolleyballGuidePage } = load(path.join(root, 'src/components/public/volleyball-guide-page.tsx'));
const { VOLLEYBALL_GUIDES, guideMetadata, guidePath } = load(path.join(root, 'src/lib/volleyball-guides.ts'));
for (lang of ['en', 'ar']) for (const guide of VOLLEYBALL_GUIDES) {
 const html = renderToStaticMarkup(React.createElement(VolleyballGuidePage, { lang, slug: guide.slug }));
 assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`));
 assert.ok(html.includes(guide[lang].title));
 assert.ok(html.includes(`href="/games?sport=${guide.sport}"`));
 const article = JSON.parse(html.match(/<script[^>]*>(.*?)<\/script>/s)[1])['@graph'].find(n => n['@type'] === 'Article');
 assert.equal(article.articleBody, guide[lang].sections.map(([h, t]) => `${h}\n${t}`).join('\n\n'));
 assert.equal(guideMetadata(lang, guide.slug).alternates.canonical, guidePath(lang, guide.slug));
}
const { PlayerJoiningGuide } = load(path.join(root, 'src/components/games/player-joining-guide.tsx'));
lang = 'en';
assert.ok(renderToStaticMarkup(React.createElement(PlayerJoiningGuide, {skillLevel:'beginner'})).includes('Organizer-listed level: beginner'));
assert.ok(!renderToStaticMarkup(React.createElement(PlayerJoiningGuide, {skillLevel:null})).includes('Organizer-listed level: beginner'));
console.log('PASS: bilingual guides, matching article markup, crawlable activity links, truthful beginner label');
