const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let handler, sent = [], saved = 0, failSend = false;
const item = { id: '00000000-0000-4000-8000-000000000001', member_id: 'member', item: 'Verified game payment', amount: 120, method: 'instapay', created_at: new Date().toISOString() };
let row = item;
const db = { from(table) { return { select() { return { eq() { return {
  maybeSingle: async () => ({data: row}),
  single: async () => ({data: {email:'payer@example.invalid',name:'<script>payer</script>'}}),
}; } }; }, update() { return {eq: async()=>{ saved++; return {error:null}; }}; } }; } };
class Resend { constructor() { this.emails = {send: async ()=>{ throw Error('Use idempotent queue delivery'); }}; } }
global.fetch = async (url, options) => { sent.push([JSON.parse(options.body), {idempotencyKey:options.headers['Idempotency-Key']}]); return {ok:!failSend}; };
const source = ts.transpileModule(fs.readFileSync('supabase/functions/notify-email/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function('require','exports','Deno',source)(name=>name.includes('welcome-email')?{buildWelcomeEmail:()=>({})}:name.includes('supabase')?{createClient:()=>db}:{Resend},{},{env:{get:key=>({SUPABASE_URL:'https://example.com',SUPABASE_SERVICE_ROLE_KEY:'test',RESEND_API_KEY:'test',PAYMENT_RECEIVED_EMAIL:'reviewer@example.invalid'})[key]},serve:fn=>handler=fn});
const request=(event='confirmed_payment')=>new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer eyJtest'},body:JSON.stringify({event,queue_id:item.id,recipient_id:'attacker',amount:999999})});
(async()=>{
assert.equal((await handler(request('game_payment_review'))).status,200);
assert.equal(sent.length,0,'unverified legacy review requests never send receipts');
assert.equal((await handler(request())).status,200);
assert.equal(sent[0][0].to,'payer@example.invalid');
assert.equal(sent[1][0].to,'reviewer@example.invalid');
assert.ok(sent[0][0].html.includes('&lt;script&gt;'));
assert.ok(sent[0][0].html.includes('120 EGP'));
assert.ok(!sent[0][0].html.includes('999999'));
assert.equal(sent[0][1].idempotencyKey,`confirmed-payment/${item.id}/member`);
assert.equal(sent[1][1].idempotencyKey,`confirmed-payment/${item.id}/admin`);
assert.equal(saved,1);
row={...item,sent_at:new Date().toISOString()};await handler(request());assert.equal(sent.length,2);
row=null;await handler(request());assert.equal(sent.length,2);
row=item;failSend=true;assert.equal((await handler(request())).status,503);assert.equal(saved,1);
console.log('PASS: confirmed payment queue only, persisted facts, member/admin recipients, escaped content, idempotency and failures stay queued');
})().catch(e=>{console.error(e);process.exitCode=1});
