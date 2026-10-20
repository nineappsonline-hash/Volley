const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
let lang='en',error=false,missing=false;
const cache=new Map();
const query=data=>({data,isPending:false,isError:error,refetch(){}});
const game={title:'Thursday volleyball championship with a long descriptive title',sport:'Beach Volleyball',game_date:'2026-11-01',start_time:'18:00',duration_hours:2,creator_name:'Organizer name',status:'open',playground:{name:'Sand court',area:'New Cairo',governorate:'Cairo'}};
const mocks={
 '@/lib/supabase/client':{createClient(){throw Error('render must not access receipts or mutate payments')}},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>dictionary[lang][key]??key})},
 '@/lib/queries':{
  useCommunityMembers:()=>query([{id:'payer',name:'Payer name',username:'payer'}]),
  useAllGamePayments:()=>query([{id:'share-123',game_id:'game-123',member_id:'payer',player_name:'Guest player',share_amount:100,pay_method:'instapay',joined_at:'2026-10-20T12:00:00Z',pay_status:'pending',game:missing?null:game}]),
  useAllRentPayments:()=>query([{id:'rent-123',game_id:'game-123',member_id:'payer',amount:200,pay_method:'cash',created_at:'2026-10-20T12:00:00Z',pay_status:'pending',game:missing?null:game}]),
  useAllSubscriptions:()=>query([{id:'sub-123',user_id:'payer',academy_id:'academy-123',kind:'academy',plan:'plus',billing_cycle:'yearly',amount:500,method:'instapay',created_at:'2026-10-20T12:00:00Z',receipt_status:'pending',academy:missing?null:{name:'Elite academy'}},{id:'member-sub',user_id:'payer',kind:'member',plan:'pro',billing_cycle:'monthly',amount:100,method:'kashier',created_at:'2026-10-20T12:00:00Z',receipt_status:'pending'}]),
  ...Object.fromEntries(['useReviewParticipantShare','useReviewRentPayment','useReviewSubscription'].map(name=>[name,()=>({isPending:false,mutateAsync(){throw Error('render must not approve payments')}})])),
 },
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);return load(['.tsx','.ts',''].map(x=>base+x).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile()));}return require(id)},out);return out;}
const {dictionary}=load('src/lib/i18n/dictionary.ts');const {PaymentApprovals}=load('src/components/super-admin/payment-approvals.tsx');
for(lang of ['en','ar']){
 const html=renderToStaticMarkup(React.createElement(PaymentApprovals));
 for(const value of [game.title,game.sport,'Sand court','New Cairo','Cairo','Organizer name','2026-11-01','Guest player','Payer name','Elite academy','game-123','share-123','rent-123','sub-123','academy-123',dictionary[lang].plans_tier_plus,dictionary[lang].mplan_tier_pro,dictionary[lang].checkout_cycle_yearly])assert.ok(html.includes(value),value);
 assert.ok(html.includes(lang==='en'?'Player membership':'عضوية لاعب'));
 assert.ok(html.includes(lang==='en'?'Payment reference':'مرجع الدفع'));
 assert.equal((html.match(/Sand court/g)||[]).length,4,'share and rent show venue in mobile and desktop layouts');
 missing=true;const unavailable=renderToStaticMarkup(React.createElement(PaymentApprovals));assert.ok(unavailable.includes(lang==='en'?'Game details unavailable':'تفاصيل المباراة غير متاحة'));assert.ok(unavailable.includes(lang==='en'?'Academy details unavailable':'بيانات الأكاديمية غير متاحة'));assert.ok(unavailable.includes('game-123'));missing=false;
 error=true;const failed=renderToStaticMarkup(React.createElement(PaymentApprovals));assert.ok(failed.includes('role="alert"'));assert.ok(!failed.includes('share-123'));error=false;
}
console.log('PASS: bilingual share/rent game context, subscription plan/cycle/academy, payer and player distinction, references, missing relations and query errors on mobile and desktop');
