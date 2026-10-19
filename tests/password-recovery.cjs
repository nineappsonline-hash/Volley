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
    setSession: async ({access_token, refresh_token}) => { assert.equal(access_token, 'test'); assert.equal(refresh_token, 'refresh'); return {error:null}; },
  };
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password?code=once');
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password#access_token=test&refresh_token=refresh&type=recovery');
  await api.establishPasswordRecovery(auth, 'https://example.com/auth/update-password?token_hash=test&type=recovery');
  await api.establishPasswordRecovery({ ...auth, initialize: async () => ({error: Error('Not a valid PKCE flow url.')}) }, 'https://example.com/#access_token=test&refresh_token=refresh&type=recovery');
  await assert.rejects(api.establishPasswordRecovery(auth, 'https://example.com/#access_token=test&type=recovery'));
  await assert.rejects(api.establishPasswordRecovery({...auth, setSession: async () => ({error: Error('invalid token')})}, 'https://example.com/#access_token=test&refresh_token=refresh&type=recovery'));
  assert.equal(verified, 1);
  await assert.rejects(api.establishPasswordRecovery(auth, 'https://example.com/?error_code=otp_expired'));
  await api.establishPasswordRecovery({ ...auth, verifyOtp: async ({ type }) => { assert.equal(type, 'invite'); return { error: null }; } }, 'https://example.com/?token_hash=test&type=invite');
  await api.establishPasswordRecovery(auth, 'https://example.com/#access_token=test&refresh_token=refresh&type=invite');
  await assert.rejects(api.establishPasswordRecovery(auth, 'https://example.com/?token_hash=test&type=signup'));
  await assert.rejects(api.establishPasswordRecovery({ ...auth, initialize: async () => ({ error: Error('expired') }) }, 'https://example.com/?code=used'));
  await assert.rejects(api.establishPasswordRecovery({ ...auth, getUser: async () => ({ data: { user: null }, error: null }) }, 'https://example.com/'));
  console.log('PASS: recovery initialization, no duplicate exchanges, direct tokens, expired links and missing sessions');
})();
