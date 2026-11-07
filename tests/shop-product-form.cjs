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
mocks.react={...React,useEffect(){},useMemo:fn=>fn(),useRef:()=>({current:null}),useState:initial=>{const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],v=>{values[index]=typeof v==='function'?v(values[index]):v}];}};
mocks['@tanstack/react-query']={useQueryClient:()=>({invalidateQueries:async()=>{}})};
const saved=[];mocks['@/lib/supabase/client']={createClient:()=>({rpc:async(name,payload)=>{saved.push(payload);return {error:null}}})};
const {ShopProductForm}=load('src/components/shop/shop-product-form.tsx');
const product={id:'product',name:'Shirt',name_ar:'',description:'',description_ar:'',price:350,gender:'unisex',published:false,variants:[],size_chart:[{size:'M',chest:50,length:70}]};
function find(node,test){if(!node||typeof node!=='object')return;if(test(node))return node;let found;React.Children.forEach(node.props?.children,c=>{found??=find(c,test)});return found;}
const hasText=(n,text)=>React.Children.toArray(n.props?.children).includes(text);
const render=()=>{cursor=0;return ShopProductForm({product,onSaved(){}})};
function field(tree,label,type='input'){return find(find(tree,n=>n.type==='label'&&hasText(n,label)),n=>n.type===type);}
(async()=>{
let tree=render();find(tree,n=>hasText(n,'Add color')).props.onClick();tree=render();
field(tree,'Stock quantity per color / size').props.onChange({target:{value:'6'}});tree=render();
find(tree,n=>hasText(n,'Generate selected combinations')).props.onClick();tree=render();
assert.equal(field(tree,'Stock').props.value,6,'explicit new stock is applied to generated sizes');
field(tree,'Stock quantity per color / size').props.onChange({target:{value:'10'}});tree=render();
find(tree,n=>hasText(n,'Generate selected combinations')).props.onClick();tree=render();
assert.equal(field(tree,'Stock').props.value,6,'regeneration preserves existing stock');
field(tree,'Stock').props.onChange({target:{value:'0'}});tree=render();
find(tree,n=>hasText(n,'Fill zero stock for selected sizes')).props.onClick();tree=render();
assert.equal(field(tree,'Stock').props.value,10,'existing zero-stock enabled sizes can be filled explicitly');
field(tree,'Gender','select').props.onChange({target:{value:'women'}});tree=render();
await tree.props.onSubmit({preventDefault(){}});
assert.equal(saved[0].p_product.gender,'women');assert.equal(saved[0].p_variants.length,1);assert.equal(saved[0].p_variants[0].stock,10);assert.equal(saved[0].p_variants[0].active,true);
console.log('PASS: generated sizes get explicitly entered stock, regeneration preserves inventory and gender is saved');
})().catch(e=>{console.error(e);process.exit(1)});
