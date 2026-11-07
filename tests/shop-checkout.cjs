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


let values=[],cursor=0;
const requestRef={current:'request-reference'};
mocks.react={...React,useEffect(){},useRef:()=>requestRef,useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v}];}};
const product={id:'product',name:'Playza Shirt',price:350,variants:[{id:'purple-m',color:'Purple',size:'M',stock:5,images:['/selected-purple.jpg']}]};
const order={member_id:'member',product_image:'/selected-purple.jpg',id:'order-id',variant_id:'purple-m',product_name:'Playza Shirt',color:'Purple',size:'M',unit_price:350,quantity:2,delivery_fee:90,total:790,fulfillment:'delivery',customer_name:'Buyer Name',phone:'01012345678',address:'123 Cairo Egypt',status:'awaiting_payment',hold_until:new Date(Date.now()+1800000).toISOString()};
let queryData=product,submitted=null,pushed='';
mocks['next/navigation']={useSearchParams:()=>new URLSearchParams('variant=purple-m'),useRouter:()=>({push:url=>{pushed=url},replace(){}})};
mocks['@tanstack/react-query']={useQuery:()=>({data:queryData,isPending:false,isError:false})};
mocks['@/components/payments/kashier-button']={KashierButton:props=>React.createElement('button',{'data-target':JSON.stringify(props.target)},'Card checkout')};
mocks['@/lib/supabase/client']={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'member'}}})},rpc:async(name,args)=>{assert.equal(name,'create_shop_order');submitted=args;return {data:order.id,error:null}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:order,error:null})})})})})};
const {ShopCheckout}=load('src/components/shop/shop-checkout.tsx');
function find(node,test){if(!node||typeof node!=='object')return;if(test(node))return node;let result;React.Children.forEach(node.props?.children,c=>{result??=find(c,test)});return result;}
const render=()=>{cursor=0;return ShopCheckout()};
(async()=>{
 lang='en';let tree=render();
 assert.ok(renderToStaticMarkup(tree).includes('Fifth Settlement'));assert.ok(renderToStaticMarkup(tree).includes('Delivery anywhere in Egypt'));
 assert.ok(find(tree,n=>n.props?.src==='/selected-purple.jpg'),'summary shows the selected photo before payment');
 for(const [auto,value] of [['name','Buyer Name'],['tel','01012345678']])find(tree,n=>n.type==='input'&&n.props.autoComplete===auto).props.onChange({target:{value}});
 find(tree,n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'2'}});
 find(tree,n=>n.type==='input'&&n.props.name==='shop-fulfillment'&&n.props.value==='delivery').props.onChange();
 tree=render();find(tree,n=>n.type==='textarea').props.onChange({target:{value:'123 Cairo Egypt'}});tree=render();
 await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(submitted.p_variant,'purple-m');assert.equal(submitted.p_quantity,2);assert.equal(submitted.p_fulfillment,'delivery');assert.equal(submitted.p_address,'123 Cairo Egypt');
 for(const key of ['price','total','delivery_fee','unit_price'])assert.equal(key in submitted,false);
 tree=render();assert.ok(find(tree,n=>n.props?.src==='/selected-purple.jpg'),'summary keeps the photo after order creation');find(tree,n=>n.type==='input'&&n.props.type==='radio'&&n.props.value==='kashier').props.onChange();tree=render();
 assert.ok(find(tree,n=>n.type==='fieldset'),'payment options are grouped accessibly');
 for(const method of ['instapay','e_wallet','kashier']) assert.ok(find(tree,n=>n.type==='input'&&n.props.type==='radio'&&n.props.value===method));
 assert.ok(!find(tree,n=>n.type==='select'),'payment selection does not use a dropdown');
 const Card=mocks['@/components/payments/kashier-button'].KashierButton;
 assert.deepEqual(find(tree,n=>n.type===Card).props.target,{kind:'shop',targetId:order.id});
 values=[];queryData={...product,resumeOrder:order};tree=render();assert.ok(!find(tree,n=>n.type==='form'),'resuming uses the existing order');
 values=[];queryData={...product,resumeOrder:{...order,hold_until:new Date(Date.now()-1000).toISOString()}};tree=render();assert.ok(find(tree,n=>n.props?.role==='alert'));assert.ok(!find(tree,n=>n.type===Card));
 values=[];queryData=product;
 mocks['@/lib/supabase/client'].createClient=()=>({auth:{getUser:async()=>({data:{user:null}})},rpc:async()=>{throw Error('Guests must not call member RPCs')}});
 const requests=[];global.fetch=async(url,options={})=>{requests.push({url,options});return {ok:true,json:async()=>({order:{...order,member_id:null}})}};
 tree=render();for(const [auto,value] of [['name','Guest Buyer'],['tel','01011111111']])find(tree,n=>n.type==='input'&&n.props.autoComplete===auto).props.onChange({target:{value}});
 tree=render();await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});tree=render();
 assert.equal(requests[0].url,'/api/shop/guest/orders');
 assert.equal(JSON.parse(requests[0].options.body).variant,'purple-m');
 const file=new File(['receipt'],'receipt.png',{type:'image/png'});
 find(tree,n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file]}});tree=render();
 await find(tree,n=>React.Children.toArray(n.props?.children).includes('Submit receipt for review')).props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests[1].url,'/api/shop/guest/receipt');assert.equal(requests[1].options.body.get('order'),order.id);
 console.log('PASS: delivery checkout captures selection without client prices, uses existing card payment target, resumes orders and blocks expired payment controls');
})().catch(e=>{console.error(e);process.exitCode=1});
