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
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.css'))return {default:styles};const exports={};cache.set(file,exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports',source)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/'))return load(resolve(path.join('src',id.slice(2))));if(id.startsWith('.'))return load(resolve(path.join(path.dirname(file),id)));return require(id);},exports);return exports;}
function resolve(file){for(const ext of ['', '.tsx','.ts','.css'])if(fs.existsSync(file+ext)&&fs.statSync(file+ext).isFile())return file+ext;throw Error(file);}


const filters=[],calls=[];
const id='a1111111-1111-4111-8111-111111111111',variant='b1111111-1111-4111-8111-111111111111';
const order={hold_until:new Date(Date.now()+1800000).toISOString(),pay_method:null,id,member_id:null,product_name:'Guest shirt',product_image:'/shirt.webp',total:440};
const uploads=[];
const db={storage:{from:()=>({upload:async(path,file)=>{uploads.push(path);return {error:null}},remove:async()=>({error:null})})},rpc:async(name,args)=>{calls.push({name,args});return {data:id,error:null}},from:table=>{const query={select(fields){assert.ok(!fields.includes('guest_hash'),'private hash must not be selected for responses');return this},eq(key,value){filters.push({key,value});return this},is(key,value){filters.push({key,value});return this},order(){return this},limit:async()=>({data:[order],error:null}),single:async()=>({data:order,error:null}),maybeSingle:async()=>({data:order,error:null})};return query;}};
mocks['@/lib/supabase/admin']={createAdminClient:()=>db};
const route=load('src/app/api/shop/guest/orders/route.ts');
const guest=load('src/lib/shop-guest.ts');
const base='https://playza.test/api/shop/guest/orders';
const payload={variant,quantity:1,fulfillment:'delivery',name:'Guest Buyer',phone:'01011111111',address:'123 Cairo Egypt',requestId:'c1111111-1111-4111-8111-111111111111',total:1,member_id:'forged'};
(async()=>{
let response=await route.GET(new Request(base));assert.deepEqual(await response.json(),{orders:[]});
response=await route.POST(new Request(base,{method:'POST',headers:{origin:'https://evil.test'},body:JSON.stringify(payload)}));assert.equal(response.status,403);assert.equal(calls.length,0);
response=await route.POST(new Request(base,{method:'POST',headers:{origin:'https://playza.test','content-type':'application/json'},body:JSON.stringify(payload)}));assert.equal(response.status,200);
const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=lax/i);
const token=cookie.match(/playza_shop_guest=([a-f0-9]{64})/)[1];
assert.equal(calls[0].name,'create_guest_shop_order');assert.equal(calls[0].args.p_guest_hash,guest.guestHash(token));assert.ok(!('total' in calls[0].args));assert.ok(!('member_id' in calls[0].args));
filters.length=0;response=await route.GET(new Request(base,{headers:{cookie:`playza_shop_guest=${token}`}}));assert.equal(response.status,200);assert.ok(filters.some(f=>f.key==='guest_hash'&&f.value===guest.guestHash(token)));assert.match(response.headers.get('cache-control'),/no-store/);
assert.equal(await guest.ownsGuestShopPayment(new Request(base),{kind:'shop',target_id:id,user_id:null}),false);
assert.equal(await guest.ownsGuestShopPayment(new Request(base,{headers:{cookie:`playza_shop_guest=${token}`}}),{kind:'shop',target_id:id,user_id:null}),true);
assert.equal(await guest.ownsGuestShopPayment(new Request(base,{headers:{cookie:`playza_shop_guest=${token}`}}),{kind:'share',target_id:id,user_id:null}),false);
const receiptRoute=load('src/app/api/shop/guest/receipt/route.ts');
let receiptResponse=await receiptRoute.POST(new Request('https://playza.test/api/shop/guest/receipt',{method:'POST',headers:{origin:'https://playza.test'}}));assert.equal(receiptResponse.status,403);assert.equal(uploads.length,0);
const form=new FormData();form.set('order',id);form.set('method','instapay');form.set('receipt',new File(['receipt'],'receipt.png',{type:'image/png'}));
receiptResponse=await receiptRoute.POST(new Request('https://playza.test/api/shop/guest/receipt',{method:'POST',headers:{origin:'https://playza.test',cookie:`playza_shop_guest=${token}`},body:form}));assert.equal(receiptResponse.status,200);assert.ok(uploads[0].startsWith(`guest/${id}/`));assert.equal(calls[1].name,'submit_guest_shop_receipt');assert.equal(calls[1].args.p_guest_hash,guest.guestHash(token));
console.log('PASS: guest checkout without auth, secure cookie, server pricing inputs, origin checks, private scoped order reads and shop-only card ownership');
})().catch(e=>{console.error(e);process.exit(1)});
