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


for (const name of ['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription']) {
 mocks['@/components/ui/dialog'] ??= {};
 mocks['@/components/ui/dialog'][name] = ({children,...props}) => React.createElement('div', {...props, open:undefined, onOpenChange:undefined}, children);
}
const {CourtRentInfoDialog} = load('src/components/games/court-rent-info-dialog.tsx');
const url='https://playza.nineapps.online/games?join='+ 'LONGCODE'.repeat(50);
for(lang of ['en','ar']) {
 const html=renderToStaticMarkup(React.createElement(CourtRentInfoDialog,{open:true,onOpenChange(){},shareLink:url}));
 assert.ok(html.includes('value="'+url+'"'));
 assert.ok(html.includes('readonly=""'));
 assert.ok(html.includes('overflow-x-hidden'));
 assert.ok(html.includes(lang==='en'?'Copy game link':'انسخ لينك الماتش'));
 assert.ok(html.includes(lang==='en'?'Invite friends to your game':'اعزم أصحابك للماتش'));
 assert.ok(html.includes(lang==='en'?'Receipts awaiting review':'الإيصالات قيد المراجعة'));
 const noLink=renderToStaticMarkup(React.createElement(CourtRentInfoDialog,{open:true,onOpenChange(){}}));
 assert.ok(!noLink.includes('<input'));
 assert.ok(noLink.includes(lang==='en'?'Court rent':'إيجار الملعب'));
}
console.log('PASS: bilingual invitation popup, constrained long links, copy action, booking note and no-link state');
