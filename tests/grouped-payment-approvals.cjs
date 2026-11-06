const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
let lang='en',error=false,missing=false;
const cache=new Map();
const query=data=>({data,isPending:false,isError:error,refetch(){}});
const game={title:'Thursday volleyball championship with a long descriptive title',sport:'Beach Volleyball',game_date:'2026-11-01',start_time:'18:00',duration_hours:2,creator_name:'Organizer name',status:'open',playground:{name:'Sand court',area:'New Cairo',governorate:'Cairo'}};
const mocks={
 '@/lib/supabase/client':{createClient(){throw Error('render must not access receipts or mutate payments')}},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>dictionary[lang][key]??key})},
 '@/lib/queries':{
  useCardPaymentOrders:()=>query([{id:"card-order",kind:"subscription",target_id:"member-sub",status:"pending",details:{}}]),
  useCommunityMembers:()=>query([{id:'payer',name:'Payer name',username:'payer'}]),
  useAllGamePayments:()=>query([{id:'share-123',game_id:'game-123',member_id:'payer',player_name:'Guest player',share_amount:100,pay_method:'instapay',joined_at:'2026-10-20T12:00:00Z',pay_status:'pending',game:missing?null:game}]),
  useAllRentPayments:()=>query([{id:'rent-123',game_id:'game-123',member_id:'payer',amount:200,pay_method:'cash',created_at:'2026-10-20T12:00:00Z',pay_status:'pending',game:missing?null:game}]),
  useAllSubscriptions:()=>query([{id:'sub-123',user_id:'payer',academy_id:'academy-123',kind:'academy',plan:'plus',billing_cycle:'yearly',amount:500,method:'instapay',created_at:'2026-10-20T12:00:00Z',receipt_status:'pending',academy:missing?null:{name:'Elite academy'}},{id:'member-sub',user_id:'payer',kind:'member',plan:'pro',billing_cycle:'monthly',amount:100,method:'kashier',created_at:'2026-10-20T12:00:00Z',receipt_status:'pending'}]),
  ...Object.fromEntries(['useReviewParticipantShare','useReviewRentPayment','useReviewSubscription'].map(name=>[name,()=>({isPending:false,mutateAsync(){throw Error('render must not approve payments')}})])),
 },
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);return load(['.tsx','.ts',''].map(x=>base+x).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile()));}return require(id)},out);return out;}
const {dictionary}=load('src/lib/i18n/dictionary.ts');const {PaymentApprovals}=load('src/components/super-admin/payment-approvals.tsx');

const guests=[{id:'guest-a',player_name:'Guest Alpha',share_amount:80},{id:'guest-b',player_name:'Guest Beta',share_amount:95}];
mocks['@/lib/queries'].useAllGamePayments=()=>query([
 {id:'payer-payment',game_id:'game-party',member_id:'payer',player_name:'Payer name',share_amount:120,pay_method:'instapay',joined_at:'2026-10-20T12:00:00Z',pay_status:'pending',game,guests,sponsor_participant_id:null},
 // Defend against old cached responses that still contain separate guest rows.
 ...guests.map(g=>({...g,game_id:'game-party',member_id:null,pay_status:'pending',sponsor_participant_id:'payer-payment',joined_at:'2026-10-20T12:00:00Z'})),
]);
mocks['@/lib/queries'].useAllRentPayments=()=>query([]);
mocks['@/lib/queries'].useAllSubscriptions=()=>query([]);
for(lang of ['en','ar']){
 const html=renderToStaticMarkup(React.createElement(PaymentApprovals));
 assert.equal((html.match(/<details /g)||[]).length,2,'one payer approval, rendered once per viewport');
 for(const name of ['Payer name','Guest Alpha','Guest Beta'])assert.ok(html.includes(name));
 for(const value of ['295','120','80','95'])assert.ok(html.includes(value));
 assert.ok(html.includes(lang==='en'?'Payer &amp; guests':'صاحب الدفع والضيوف'));
 assert.ok(html.includes(lang==='en'?'Payment total':'إجمالي الدفعة'));
 assert.ok(html.includes('payer-payment'));assert.ok(!html.includes('share:guest-a'));
}
console.log('PASS: one approval per payer with complete guest fee total and bilingual booking/payer/guest breakdown');
