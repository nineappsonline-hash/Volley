const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/auth-redirect.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
for (const path of ['/coaches/invitations/abc','/schedule?date=2026-10-20','/games?join=INVITE','/members?search=Sarah']) assert.equal(api.authDestination(path),path);
for (const path of [null,'','https://example.com','//example.com','/\\example.com','/login','/signup?mode=tenant','/auth/callback','/foo/../login','/\n/example.com']) assert.equal(api.authDestination(path),'/dashboard');
console.log('PASS: member, coach, owner return links, query preservation, external redirect and authentication loop rejection');

assert.equal(api.registrationDestination('/games?focus=abc'), '/games?focus=abc');
assert.equal(api.registrationDestination('/dashboard', 'INVITE'), '/games?join=INVITE');
assert.equal(api.registrationDestination('https://evil.example'), '/dashboard');
assert.equal(api.authLink('/signup', '/games?join=A&sport=volleyball'), '/signup?redirectedFrom=%2Fgames%3Fjoin%3DA%26sport%3Dvolleyball');
assert.equal(api.authLink('/login', '//evil.example'), '/login?redirectedFrom=%2Fdashboard');
