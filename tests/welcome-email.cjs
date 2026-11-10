const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync('supabase/functions/_shared/welcome-email.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
const email = api.buildWelcomeEmail('<img src=x onerror=alert(1)>', 'Sport & Friends');
assert.ok(email.html.includes('&lt;img'));
assert.ok(email.html.includes('https://playza.life/images/playza-email-logo.png'));
assert.ok(email.html.includes('alt="Playza"'));
assert.ok(fs.existsSync('public/images/playza-email-logo.png'));
assert.ok(email.html.includes('Sport &amp; Friends'));
assert.ok(!email.html.includes('<img src=x'));
for (const path of ['/profile','/games','/academies','/dashboard','/faq']) {
  assert.ok(email.html.includes(`https://playza.life${path}`));
  assert.ok(email.text.includes(`https://playza.life${path}`));
}
assert.ok(!email.html.includes('account is confirmed'));
assert.ok(!api.buildWelcomeEmail('Alex').html.includes('Your academy:'));
assert.ok(api.buildWelcomeEmail(' ').html.includes('Hi there,'));
fs.writeFileSync('/tmp/playza-welcome-email.html',api.buildWelcomeEmail('Alex','Playza Sports Academy').html);
console.log('PASS: safe personalization, onboarding links, plain text, optional academy, no false verification claim');
