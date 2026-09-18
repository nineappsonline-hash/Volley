const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const api = {};
let clears=0;
let error=null;
const mocks={
  react:{useCallback:fn=>fn},
  '@tanstack/react-query':{useQueryClient:()=>({clear:()=>clears++})},
  '@/lib/supabase/client':{createClient:()=>({auth:{signInWithPassword:async()=>({error}),signOut:async()=>({error})}})},
};
new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/auth.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api,name=>mocks[name]);
(async()=>{
  const auth=api.useAuth();
  await auth.signIn('member@example.com','test');assert.equal(clears,1);
  await auth.signOut();assert.equal(clears,2);
  error=new Error('offline');await assert.rejects(auth.signIn('member@example.com','test'),/offline/);await assert.rejects(auth.signOut(),/offline/);assert.equal(clears,2);
  console.log('PASS: account changes clear cached data; failed authentication preserves the current cache');
})().catch(e=>{console.error(e);process.exitCode=1});
