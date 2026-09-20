const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/password-recovery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(api);
(async () => {
  let ready = false, verified = 0;
  const auth = {
    initialize: async () => { ready = true; return { error: null }; },
    getUser: async () => { assert.ok(ready); return { data: { user: { id: 'test' } }, error: null }; },
    verifyOtp: async ({ type }) => { assert.equal(type, 'recovery'); verified++; return { error: null }; },
    exchangeCodeForSession: () => { throw Error('must not exchange twice'); },
    setSession: () => { throw Error('must not reapply fragment'); },
  };
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password?code=once');
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password#access_token=test&type=recovery');
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password?token_hash=test&type=recovery');
  assert.equal(verified, 1);
  await assert.rejects(api.establishPasswordRecovery(auth, 'https://example.com/?error_code=otp_expired'));
  await assert.rejects(api.establishPasswordRecovery(auth, 'https://example.com/?token_hash=test&type=invite'));
  await assert.rejects(api.establishPasswordRecovery({ ...auth, initialize: async () => ({ error: Error('expired') }) }, 'https://example.com/?code=used'));
  await assert.rejects(api.establishPasswordRecovery({ ...auth, getUser: async () => ({ data: { user: null }, error: null }) }, 'https://example.com/'));
  console.log('PASS: recovery initialization, no duplicate exchanges, direct tokens, expired links and missing sessions');
})();
