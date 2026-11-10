const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.join(__dirname, '..');
// Classic JSX output calls the global `React`.
globalThis.React = React;

// --- module loader: mirrors the `@/` alias and transpiles TS on the fly -----
const mocks = {};
const cache = new Map();
const EXTS = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];

function resolveImport(id, fromFile) {
  if (id.startsWith('@/')) {
    for (const ext of EXTS) {
      const file = path.join(root, 'src', id.slice(2) + ext);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
    return null;
  }
  if (id.startsWith('.')) {
    for (const ext of EXTS) {
      const file = path.resolve(path.dirname(fromFile), id + ext);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
  }
  return null;
}

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  if (file.endsWith('.css')) return exports;
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', output)((id) => {
    if (id in mocks) return mocks[id];
    const resolved = resolveImport(id, file);
    if (resolved) return load(resolved);
    return require(id);
  }, exports);
  return exports;
}

const dictionary = load(path.join(root, 'src/lib/i18n/dictionary.ts')).dictionary;

let lang = 'en';
mocks['@/lib/i18n'] = {
  useI18n: () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t: (k) => dictionary[lang][k] }),
};

const { academyShareLink, programShareLink, academyShareText } = load(
  path.join(root, 'src/lib/academy-share.ts')
);

// --- links are absolute so they survive pasting into another app -----------
assert.equal(academyShareLink('maadi-swim'), 'https://playza.life/a/maadi-swim');
assert.equal(
  programShareLink('maadi-swim', 'plan-123'),
  'https://playza.life/a/maadi-swim#training-plan-123'
);
console.log('PASS: academy and plan links are absolute and deep-link to the plan anchor');

assert.match(academyShareLink('a b/c'), /\/a\/a%20b%2Fc$/, 'odd slugs are escaped');
assert.match(programShareLink('s', 'p 1'), /#training-p%201$/);
console.log('PASS: slugs and plan ids are url-encoded');

// --- share text stays short and names the plan first ----------------------
assert.equal(academyShareText({ name: 'Maadi Swim' }), 'Maadi Swim');
assert.equal(academyShareText({ name: 'Maadi Swim', area: 'Maadi' }), 'Maadi Swim · Maadi');
assert.equal(
  academyShareText({ name: 'Maadi Swim', area: 'Maadi', governorate: 'Cairo' }),
  'Maadi Swim · Maadi, Cairo'
);
assert.equal(
  academyShareText({ name: 'Maadi Swim', area: 'Maadi' }, { name: 'U12 Juniors' }),
  'U12 Juniors · Maadi Swim · Maadi',
  'a plan share names the plan, then the academy'
);
assert.ok(!academyShareText({ name: 'Maadi Swim' }).includes('undefined'), 'no missing placeholders leak in');
console.log('PASS: share text is one short line, plan-first, with no stray undefined');

// --- translations exist and are distinct per language ---------------------
for (const key of [
  'academy_share',
  'academy_share_title',
  'academy_share_program',
  'academy_share_copy',
  'academy_share_copied',
]) {
  assert.ok(dictionary.en[key], `en.${key} exists`);
  assert.ok(dictionary.ar[key], `ar.${key} exists`);
  assert.notEqual(dictionary.en[key], dictionary.ar[key], `${key} is translated`);
}
assert.match(dictionary.en.academy_share_title, /\{name\}/, 'the accessible label carries the academy name');
console.log('PASS: share labels are translated and the label interpolates a name');

// --- component renders a labelled trigger in both languages --------------
const { AcademyShareButton, ShareIconButton, academyShareTarget } = load(
  path.join(root, 'src/components/academies/academy-share.tsx')
);
const h = React.createElement;
const academy = { name: 'Maadi Swim', slug: 'maadi-swim', area: 'Maadi', governorate: 'Cairo' };

const academyHtml = renderToStaticMarkup(h(AcademyShareButton, { academy }));
assert.ok(
  academyHtml.includes(dictionary.en.academy_share_title.replace('{name}', 'Maadi Swim')),
  'academy button is labelled with the academy name'
);

lang = 'ar';
const arabicHtml = renderToStaticMarkup(h(AcademyShareButton, { academy }));
assert.ok(
  arabicHtml.includes(dictionary.ar.academy_share_title.replace('{name}', 'Maadi Swim')),
  'Arabic academy label'
);
assert.ok(
  !arabicHtml.includes(dictionary.en.academy_share_title.replace('{name}', 'Maadi Swim')),
  'no English label leaks into Arabic'
);

lang = 'en';
const planHtml = renderToStaticMarkup(
  h(ShareIconButton, {
    target: academyShareTarget(academy, { id: 'p1', name: 'U12' }),
    label: dictionary.en.academy_share_program,
  })
);
assert.ok(
  planHtml.includes('aria-label="' + dictionary.en.academy_share_program + '"'),
  'plan button is labelled for screen readers'
);

const target = academyShareTarget(academy, { id: 'p 1', name: 'U12 Juniors' });
assert.match(target.url, /#training-p%201$/, 'a plan target deep-links to its card');
assert.match(target.text, /^U12 Juniors/, 'a plan target leads with the plan name');
assert.equal(academyShareTarget(academy).url, academyShareLink('maadi-swim'));
console.log('PASS: share buttons render labelled triggers in both languages with correct targets');

// --- every placement actually renders the button -------------------------
const shareImport = [
  'src/app/a/[slug]/page.tsx',
  'src/components/academies/training-booking.tsx',
  'src/components/super-admin/super-admin-dashboard.tsx',
];
for (const file of shareImport) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /from\s+"[^"]*academy-share"/, `${file} imports the share component`);
  assert.match(source, /ShareIconButton|AcademyShareButton/, `${file} renders a share button`);
}
// The plan card must pass the plan so the deep link points at that group.
const planCard = fs.readFileSync(path.join(root, 'src/components/academies/training-booking.tsx'), 'utf8');
assert.match(planCard, /academyShareTarget\(\{[^}]*slug:p\.academy_slug/, 'plan share uses the academy slug');
assert.match(planCard, /\{id:p\.id,name:p\.name\}/, 'plan share deep-links to that program');
console.log('PASS: the academy page, plan cards and the admin table all render a share button');

console.log('\nAll academy share tests passed.');