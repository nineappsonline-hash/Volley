const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let handler, sent = [], saved = 0, failSend = false;
const item = { id: '00000000-0000-4000-8000-000000000001', game_id: 'game', member_id: 'member', amount: 120, method: 'instapay', created_at: new Date().toISOString(), payment_kind: 'share' };
let row = item;
const db = { from(table) { return { select() { return { eq() { return {
  maybeSingle: async () => ({data: row}),
  single: async () => ({data: table === 'profiles' ? {name:'<script>payer</script>'} : {title:'Padel & friends',sport:'Padel',game_date:'2026-10-10',start_time:'18:00'}}),
}; } }; }, update() { return {eq: async()=>{ saved++; return {error:null}; }}; } }; } };
class Resend { constructor() { this.emails = {send: async (...args)=>{sent.push(args);return {error:failSend ? {message:'failed'} : null};}}; } }
global.fetch = async (url, options) => { sent.push([JSON.parse(options.body), {idempotencyKey:options.headers['Idempotency-Key']}]); return {ok:!failSend}; };
const source = ts.transpileModule(fs.readFileSync('supabase/functions/notify-email/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function('require','exports','Deno',source)(name=>name.includes('supabase')?{createClient:()=>db}:{Resend},{},{env:{get:key=>({SUPABASE_URL:'https://example.com',SUPABASE_SERVICE_ROLE_KEY:'test',RESEND_API_KEY:'test'})[key]},serve:fn=>handler=fn});
const request=()=>new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer eyJtest'},body:JSON.stringify({event:'game_payment_review',queue_id:item.id,recipient_id:'attacker',amount:999999})});
(async()=>{
assert.equal((await handler(request())).status,200);
assert.equal(sent[0][0].to,'mo.dowaik@gmail.com');
assert.ok(sent[0][0].html.includes('&lt;script&gt;'));
assert.ok(sent[0][0].html.includes('120 EGP'));
assert.ok(sent[0][0].html.includes('game=game'));
assert.equal(sent[0][1].idempotencyKey,`game-payment-review/${item.id}`);
assert.equal(saved,1);
row={...item,sent_at:new Date().toISOString()};await handler(request());assert.equal(sent.length,1);
row=null;await handler(request());assert.equal(sent.length,1);
row={...item,payment_kind:'rent'};failSend=true;assert.equal((await handler(request())).status,502);assert.equal(saved,1);
console.log('PASS: persisted payment facts, fixed recipient, escaped content, review link, idempotency, failures stay queued');
})();
