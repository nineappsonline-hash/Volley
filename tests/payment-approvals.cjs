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
for(lang of ['en','ar']){
 const html=renderToStaticMarkup(React.createElement(PaymentApprovals));
 assert.ok(html.includes('aria-expanded="false"'), 'payment approval panel starts collapsed');
 assert.ok(html.includes('hidden=""'), 'filter and payment content is hidden by default');
 assert.equal((html.match(/<details /g)||[]).length,6,'each mobile/desktop payment has independently expandable context');
 assert.ok(!html.includes('<details open'), 'payment details start collapsed');
 assert.ok(html.includes(lang==='en'?'Payment details':'تفاصيل الدفع'));
 for(const value of [game.title,game.sport,'Sand court','New Cairo','Cairo','Organizer name','2026-11-01','Guest player','Payer name','Elite academy','game-123','share-123','rent-123','sub-123','academy-123',dictionary[lang].plans_tier_plus,dictionary[lang].checkout_cycle_yearly])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('member-sub'), 'unconfirmed card checkout is excluded from Pending');
 assert.ok(html.includes(lang==='en'?'Payment reference':'مرجع الدفع'));
 assert.equal((html.match(/Sand court/g)||[]).length,4,'share and rent show venue in mobile and desktop layouts');
 missing=true;const unavailable=renderToStaticMarkup(React.createElement(PaymentApprovals));assert.ok(unavailable.includes(lang==='en'?'Game details unavailable':'تفاصيل الماتش غير متاحة'));assert.ok(unavailable.includes(lang==='en'?'Academy details unavailable':'بيانات الأكاديمية غير متاحة'));assert.ok(unavailable.includes('game-123'));missing=false;
 error=true;const failed=renderToStaticMarkup(React.createElement(PaymentApprovals));assert.ok(failed.includes('role="alert"'));assert.ok(!failed.includes('share-123'));error=false;
}
console.log('PASS: bilingual share/rent game context, subscription plan/cycle/academy, payer and player distinction, references, missing relations and query errors on mobile and desktop');
// Exercise the panel toggle without a session, receipt access, or payment writes.
let expanded=false;
mocks.react={...React,useEffect:()=>{},useRef:()=>({current:false}),useId:()=> 'payment-panel',useMemo:fn=>fn(),useState:initial=>[typeof initial==='boolean'?expanded:initial,value=>{if(typeof value==='boolean')expanded=value;}]};
cache.delete(path.resolve('src/components/super-admin/payment-approvals.tsx'));
const TogglePanel=load('src/components/super-admin/payment-approvals.tsx').PaymentApprovals;
function find(node,predicate){if(!node||typeof node!=='object')return; if(predicate(node))return node;let result;React.Children.forEach(node.props?.children,child=>{result??=find(child,predicate)});return result;}
for(lang of ['en','ar']){
 expanded=false;
 for(const expected of [false,true,false]){
  const tree=TogglePanel();
  const toggle=find(tree,n=>n.type==='button'&&n.props['aria-controls']==='payment-panel');
  const panel=find(tree,n=>n.props?.id==='payment-panel');
  assert.equal(toggle.props['aria-expanded'],expected);
  assert.equal(panel.props.hidden,!expected);
  toggle.props.onClick();
 }
}
console.log('PASS: payment panel opens/closes through its accessible toggle in both languages without accessing receipts or changing payments');
// Render All statuses with a real confirmed card record and assert that the
// override control is available in both layouts, while Pending excludes it.
let stateIndex=0;
mocks.react={...React,useEffect:()=>{},useRef:()=>({current:false}),useId:()=> 'payment-panel',useMemo:fn=>fn(),useState:initial=>{const index=stateIndex++;return [index===0?true:initial==='pending'?'all':initial,()=>{}]}};
mocks['@/lib/queries'].useCardPaymentOrders=()=>query([{id:'card-order',kind:'subscription',target_id:'member-sub',status:'paid',details:{}}]);
cache.delete(path.resolve('src/components/super-admin/payment-approvals.tsx'));
const AllStatuses=load('src/components/super-admin/payment-approvals.tsx').PaymentApprovals;
for(lang of ['en','ar']){
 stateIndex=0;const html=renderToStaticMarkup(React.createElement(AllStatuses));
 assert.ok(html.includes('member-sub'));
 assert.ok(html.includes(lang==='en'?'Admin review does not charge or refund':'قرار الإدارة لا يخصم'));
 const reject=dictionary[lang].super_admin_fee_reject;
 assert.equal((html.match(new RegExp('>'+reject+'<','g'))||[]).length,8,'confirmed card rows retain Reject controls in both layouts');
}
console.log('PASS: confirmed Kashier payments are reviewable from All payments in both languages/layouts');

// Mobile browsers block new windows opened after await. Receipt previews must
// remain in-page and ignore a signed-URL response if the viewer was closed.
(async()=>{
 let slots=[],cursor=0,refs=[],refCursor=0,resolveReceipt;
 const oldShares=mocks['@/lib/queries'].useAllGamePayments;
 mocks['@/lib/queries'].useAllGamePayments=()=>query([{id:'receipt-share',game_id:'game',member_id:'payer',player_name:'Player',share_amount:100,pay_method:'instapay',joined_at:'2026-10-20T12:00:00Z',pay_status:'pending',pay_receipt_url:'payer/mobile.jpg',game}]);
 mocks['@/lib/supabase/client']={createClient:()=>({storage:{from:bucket=>({createSignedUrl:async(path,expiry)=>{
  assert.equal(bucket,'game-fee-receipts');assert.equal(path,'payer/mobile.jpg');assert.equal(expiry,600);
  return new Promise(resolve=>{resolveReceipt=resolve});
 }})}})};
 mocks.react={...React,useEffect(){},useId:()=> 'receipt-test',useMemo:fn=>fn(),useRef:initial=>{const i=refCursor++;return refs[i]??=( {current:initial} );},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=i===0?true:initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}];}};
 cache.delete(path.resolve('src/components/super-admin/payment-approvals.tsx'));
 const Component=load('src/components/super-admin/payment-approvals.tsx').PaymentApprovals;
 const {Dialog}=load('src/components/ui/dialog.tsx');
 const render=()=>{cursor=0;refCursor=0;return Component();};
 lang='en';
 let tree=render();
 const view=find(tree,n=>typeof n.props?.onClick==='function'&&React.Children.toArray(n.props.children).includes(dictionary.en.super_admin_fee_view_receipt));
 assert.ok(view);
 let pending=view.props.onClick();
 tree=render();assert.equal(find(tree,n=>n.type===Dialog).props.open,true);
 assert.ok(find(tree,n=>n.props?.role==='status'));
 resolveReceipt({data:{signedUrl:'https://example.test/private-receipt'},error:null});await pending;
 tree=render();assert.equal(find(tree,n=>n.type==='img').props.src,'https://example.test/private-receipt');
 const fullSize=find(tree,n=>n.type==='a'&&n.props.href==='https://example.test/private-receipt');assert.equal(fullSize.props.target,'_blank');
 find(tree,n=>n.type===Dialog).props.onOpenChange(false);
 pending=view.props.onClick();tree=render();find(tree,n=>n.type===Dialog).props.onOpenChange(false);
 resolveReceipt({data:{signedUrl:'https://example.test/stale'},error:null});await pending;
 tree=render();assert.equal(find(tree,n=>n.type===Dialog).props.open,false);
 mocks['@/lib/queries'].useAllGamePayments=oldShares;
 console.log('PASS: mobile receipt opens in-page before signing, displays signed image, offers direct full-size link and ignores closed-viewer responses');
})().catch(e=>{console.error(e);process.exitCode=1;});
