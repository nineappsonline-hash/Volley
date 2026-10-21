const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const file = path.resolve(__dirname, '../src/store/useLanguage.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load() {
  const exports = {};
  new Function('require', 'exports', code)(createRequire(file), exports);
  return exports.useLanguage;
}
const values = new Map([['volley-lang', JSON.stringify({state:{lang:'ar'},version:0})]]);
global.localStorage = { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) };
const language = load();
assert.equal(language.getState().lang, 'ar', 'server and first client render default to Arabic');
language.persist.rehydrate();
assert.equal(language.getState().lang, 'ar', 'saved Arabic preference is restored after hydration');
language.getState().toggleLang();
assert.equal(language.getState().lang, 'en');
assert.equal(JSON.parse(values.get('volley-lang')).state.lang, 'en', 'language changes remain saved');
values.set('volley-lang', JSON.stringify({state:{lang:'invalid'},version:0}));
language.persist.rehydrate();
assert.equal(language.getState().lang, 'ar', 'invalid saved values fall back to Arabic');
delete global.localStorage;
assert.equal(load().getState().lang, 'ar', 'server can render without browser storage');
console.log('PASS: consistent server/client initial language, deferred Arabic restoration, persistence and invalid preference fallback');
