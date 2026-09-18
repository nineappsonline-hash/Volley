const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/auth-redirect.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
for (const path of ['/coaches/invitations/abc','/schedule?date=2026-10-20','/games?join=INVITE','/members?search=Sarah']) assert.equal(api.authDestination(path),path);
for (const path of [null,'','https://example.com','//example.com','/\\example.com','/login','/signup?mode=tenant','/auth/callback','/foo/../login','/\n/example.com']) assert.equal(api.authDestination(path),'/dashboard');
console.log('PASS: member, coach, owner return links, query preservation, external redirect and authentication loop rejection');
