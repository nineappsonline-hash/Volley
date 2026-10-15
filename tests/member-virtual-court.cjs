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
    if (id === '@/lib/i18n') return { useI18n: () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }) };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const resolved = ['', '.tsx', '.ts'].map(ext => base + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved) return load(resolved);
    }
    return require(id);
  }, exports);
  return exports;
}

const { VirtualCourtCard } = load(path.join(root, 'src/components/dashboard/virtual-court-card.tsx'));

// --- English: dashboard shell, full copy, lazy renderer --------------------
let html = renderToStaticMarkup(React.createElement(VirtualCourtCard));
assert.ok(html.includes('from-brand to-brand-900'), 'adopts the dashboard navy gradient header');
assert.ok(html.includes('shadow-none'), 'uses the restrained dashboard card surface');
assert.ok(html.includes('Virtual court'), 'names the card');
assert.ok(html.includes('Step onto the sand.'), 'keeps the homepage headline');
assert.ok(html.includes('Play in 3D.'));
assert.ok(html.includes('Try the 3D experience'), 'offers the same call to action');
assert.ok(html.includes('ACTUAL GAMEPLAY'), 'shows the real gameplay preview');
assert.ok(html.includes('gameplay-preview.png'), 'reuses the homepage preview image');
assert.ok(html.includes('text-primary'), 'uses dashboard lime accents for highlights/accents');
assert.ok(!html.includes('/beach-challenge/index.html'), 'the renderer is not embedded until the member plays');
assert.ok(!html.includes('aria-labelledby="beach-challenge-title"'), 'does not duplicate the homepage-only anchor');
console.log('PASS: member virtual-court card renders the 3D game content in the dashboard shell');

// --- Arabic ----------------------------------------------------------------
lang = 'ar';
html = renderToStaticMarkup(React.createElement(VirtualCourtCard));
assert.ok(html.includes('الملعب الافتراضي'), 'Arabic card title');
assert.ok(html.includes('انزل الرمل من شاشتك.'), 'Arabic headline');
assert.ok(html.includes('جرّب التجربة ثلاثية الأبعاد'), 'Arabic call to action');
assert.ok(html.includes('لقطة من اللعبة'), 'Arabic preview label');
lang = 'en';
console.log('PASS: member virtual-court card renders in Arabic');

// --- The dashboard exposes the card and its anchor -------------------------
const dashboard = fs.readFileSync(path.join(root, 'src/components/dashboard/member-dashboard.tsx'), 'utf8');
assert.ok(dashboard.includes('VirtualCourtCard'), 'member dashboard mounts the card');
assert.ok(dashboard.includes('id="play"'), 'the card has its own dashboard section');
assert.ok(dashboard.includes('NEXT_PUBLIC_BEACH_GAME_ENABLED'), 'the card honours the game feature flag');
console.log('PASS: member dashboard wires the virtual-court card behind the existing game feature flag');
