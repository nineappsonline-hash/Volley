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
mocks.react={...React,useEffect(){},useRef:()=>({current:null}),useState:initial=>{const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],v=>{values[index]=typeof v==='function'?v(values[index]):v}];}};
const products=[{id:'one',name:'Blue shirt',price:350,published:true,variants:[{active:true,images:['/blue.webp']}]},{id:'two',name:'Draft shirt',price:400,published:false,variants:[]}];
const calls=[];
mocks['@tanstack/react-query']={useQuery:({queryKey})=>({data:queryKey[0]==='shop-admin-products'?products:[],isPending:false}),useQueryClient:()=>({invalidateQueries:async()=>{}})};
mocks['@/lib/supabase/client']={createClient:()=>({rpc:async(name,payload)=>{calls.push({name,payload});return {error:null}}})};
mocks['./shop-product-form']={ShopProductForm:()=>null,blankProduct:()=>({id:'new',name:''})};
global.window={confirm:()=>true};
const {ShopAdmin}=load('src/components/shop/shop-admin.tsx');
function find(node,test){if(!node||typeof node!=='object')return;if(test(node))return node;let found;React.Children.forEach(node.props?.children,c=>{found??=find(c,test)});return found;}
function label(node){return React.Children.toArray(node.props?.children).filter(c=>typeof c==='string').join('');}
const render=()=>{cursor=0;return ShopAdmin()};
(async()=>{
let tree=render();const html=renderToStaticMarkup(tree);
assert.ok(html.includes('Blue shirt')&&html.includes('Draft shirt'),'all products, including drafts, show without selection');
assert.ok(!find(tree,n=>n.type==='select'),'no product dropdown');
find(tree,n=>label(n)==='Edit').props.onClick();tree=render();assert.ok(find(tree,n=>n.props?.['aria-label']==='Product editor'));
await find(tree,n=>label(n)==='Delete').props.onClick();
assert.deepEqual(calls,[{name:'delete_shop_product',payload:{p_product:'one'}}]);
assert.ok(!find(render(),n=>n.props?.['aria-label']==='Product editor'));
console.log('PASS: all products visible, no dropdown, edit opens chosen product and delete calls authorized RPC');
})().catch(e=>{console.error(e);process.exit(1)});
