const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
let lang='en',pathname='/dashboard';
const cache=new Map();
const styles=new Proxy({}, {get:(_,key)=>String(key)});
const mocks={
 'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
 'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>key})},
 '@/lib/queries':{useCurrentProfile:()=>({data:{role:'member'}})},
 '@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')},
 '@/lib/constants':{formatMoney:n=>`EGP ${Number(n).toFixed(2)}`,formatTime12h:v=>v},
 '@/lib/game-costs':{gameBookingPayment:()=>({confirmed:true})},
 './game-card-background':{GameCardBackground:()=>React.createElement('span',{'data-fallback-art':true})},
 sonner:{toast:{success(){},error(){}}},
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.css'))return {default:styles};const exports={};cache.set(file,exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports',source)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/'))return load(resolve(path.join('src',id.slice(2))));if(id.startsWith('.'))return load(resolve(path.join(path.dirname(file),id)));return require(id);},exports);return exports;}
function resolve(file){for(const ext of ['', '.tsx','.ts','.css'])if(fs.existsSync(file+ext)&&fs.statSync(file+ext).isFile())return file+ext;throw Error(file);}


mocks.react = {...React,useEffect(){},useState:initial=>[initial,()=>{}]};
const mutation={isPending:false,mutateAsync:async()=>true};
mocks['@/lib/queries']={useJoinFriendlyGame:()=>mutation,usePayGameShare:()=>mutation,usePayRentRemaining:()=>mutation};
mocks['@/lib/supabase/client']={createClient:()=>({})};
mocks['@/lib/push']={requestPushPrompt(){}};
mocks['@/components/payments/kashier-button']={KashierButton:()=>React.createElement('span',null,'CARD CHECKOUT')};
for(const name of ['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription','DialogFooter']){
 mocks['@/components/ui/dialog'] ??= {};
 mocks['@/components/ui/dialog'][name]=({children})=>React.createElement('div',null,children);
}
const {JoinGameDialog}=load('src/components/games/join-game-dialog.tsx');
for(lang of ['en','ar']){
 for(const host_pays of [true,false]){
  const html=renderToStaticMarkup(React.createElement(JoinGameDialog,{open:true,onOpenChange(){},mode:'join',game:{id:'g',title:'Full game',host_pays,status:'full',max_players:12,participants_count:12,share_price:100,waitlist_count:1}}));
  assert.ok(html.includes(lang==='en'?'Join waiting list':'انضم لقائمة الانتظار'));
  assert.ok(html.includes(lang==='en'?'manual refund':'استرداد المبلغ يدويًا'));
  assert.ok(!html.includes(lang==='en'?'No payment now':'بدون دفع الآن'));
  assert.ok(html.includes('1/2'));assert.ok(!html.includes('CARD CHECKOUT'));assert.ok(!html.includes(lang==='en'?'Bring guests':'ضيوفك'));
  assert.equal(html.includes('disabled=""'),!host_pays,'paid waiting list requires payment details');
 }
 const full=renderToStaticMarkup(React.createElement(JoinGameDialog,{open:true,onOpenChange(){},game:{id:'g',title:'Full game',status:'full',share_price:100,waitlist_count:2}}));
 assert.ok(full.includes('2/2'));assert.ok(full.includes('disabled=""'));
}
console.log('PASS: bilingual free/paid full-game waiting flow, payment required unless host-covered, no guests and 2/2 disabled');
