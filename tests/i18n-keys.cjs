const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/i18n/dictionary.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const dictionaryModule = {};
new Function('require', 'exports', output)(require, dictionaryModule);
const { dictionary } = dictionaryModule;

const en = dictionary.en;
const ar = dictionary.ar;
const enKeys = Object.keys(en);
const arKeys = Object.keys(ar);

const missingInAr = enKeys.filter((key) => !(key in ar));
const missingInEn = arKeys.filter((key) => !(key in en));
assert.deepEqual(missingInAr, [], 'every English key has an Arabic translation');
assert.deepEqual(missingInEn, [], 'every Arabic key has an English translation');

const empty = [];
for (const lang of ['en', 'ar']) {
  for (const [key, value] of Object.entries(dictionary[lang])) {
    if (typeof value !== 'string' || !value.trim()) empty.push(`${lang}.${key}`);
  }
}
assert.deepEqual(empty, [], 'no translation is blank');

// Placeholders drive runtime .replace() calls, so both languages must consume
// the same set or a translated string silently drops its values.
// `{s}` is the repo's English-only plural suffix and is ignored here.
const slots = (value) => (value.match(/\{[a-z_]+\}/g) ?? []).filter((slot) => slot !== '{s}').slice().sort().join(',');

const extraInArabic = [];
for (const key of enKeys) {
  const arSlots = slots(ar[key]);
  if (arSlots && !slots(en[key]).includes(arSlots.split(',')[0])) {
    extraInArabic.push(`${key}: ar=[${arSlots}] en=[${slots(en[key])}]`);
  }
}
assert.deepEqual(extraInArabic, [], 'Arabic translations never reference a placeholder English lacks');

const mismatched = [];
for (const key of enKeys) {
  // Fixed-phrase singulars (e.g. "one spot left") legitimately omit {n};
  // only compare keys where both languages interpolate something.
  if (!slots(en[key]) || !slots(ar[key])) continue;
  if (slots(en[key]) !== slots(ar[key])) mismatched.push(`${key}: en=[${slots(en[key])}] ar=[${slots(ar[key])}]`);
}
assert.deepEqual(mismatched, [], 'translations interpolate the same placeholders');

console.log(`PASS: ${enKeys.length} keys exist in both languages, all non-empty and interpolating the same placeholders`);