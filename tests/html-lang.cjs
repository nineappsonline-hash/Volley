const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/html-lang.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = {};
new Function('exports', 'require', code)(mod, require);
const { htmlLocaleForPath, isUrlLocalizedPublicPath, publicPathMatcherSource } = mod;

assert.deepEqual(htmlLocaleForPath('/sports/padel'), { lang: 'en-EG', dir: 'ltr' });
assert.deepEqual(htmlLocaleForPath('/games'), { lang: 'en-EG', dir: 'ltr' });
assert.deepEqual(htmlLocaleForPath('/academies'), { lang: 'en-EG', dir: 'ltr' });
assert.deepEqual(htmlLocaleForPath('/guides/join-volleyball-without-team'), { lang: 'en-EG', dir: 'ltr' });
assert.deepEqual(htmlLocaleForPath('/book-courts'), { lang: 'en-EG', dir: 'ltr' });
assert.deepEqual(htmlLocaleForPath('/'), { lang: 'en-EG', dir: 'ltr' });

assert.deepEqual(htmlLocaleForPath('/ar'), { lang: 'ar-EG', dir: 'rtl' });
assert.deepEqual(htmlLocaleForPath('/ar/sports/padel'), { lang: 'ar-EG', dir: 'rtl' });
assert.deepEqual(htmlLocaleForPath('/ar/guides/beach-volleyball-beginners'), { lang: 'ar-EG', dir: 'rtl' });
assert.deepEqual(htmlLocaleForPath('/ar/courts'), { lang: 'ar-EG', dir: 'rtl' });
assert.deepEqual(htmlLocaleForPath('/ar/list-your-court'), { lang: 'ar-EG', dir: 'rtl' });

assert.equal(isUrlLocalizedPublicPath('/sports/padel'), true);
assert.equal(isUrlLocalizedPublicPath('/games'), true);
assert.equal(isUrlLocalizedPublicPath('/ar/sports/padel'), true);
assert.equal(isUrlLocalizedPublicPath('/a/some-slug'), true);
assert.equal(isUrlLocalizedPublicPath('/p/abc'), true);
assert.equal(isUrlLocalizedPublicPath('/dashboard'), false);
assert.equal(isUrlLocalizedPublicPath('/dashboard/games'), false);
assert.equal(isUrlLocalizedPublicPath('/playgrounds'), false);
assert.equal(isUrlLocalizedPublicPath('/login'), false);
assert.equal(isUrlLocalizedPublicPath('/academy'), false);

global.location = { pathname: '/sports/padel' };
assert.equal(new Function(`return ${publicPathMatcherSource()}`)(), true);
global.location = { pathname: '/dashboard' };
assert.equal(new Function(`return ${publicPathMatcherSource()}`)(), false);
global.location = { pathname: '/ar/sports/padel' };
assert.equal(new Function(`return ${publicPathMatcherSource()}`)(), true);
delete global.location;

console.log('PASS: HTML lang/dir mapping and public-path detection');
