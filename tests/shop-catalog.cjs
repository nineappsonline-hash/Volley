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
let lastEffect;
mocks.react={...React,useEffect:fn=>{lastEffect=fn},useState:initial=>{const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],v=>{values[index]=typeof v==='function'?v(values[index]):v}];}};
const {ShopProductCard}=load('src/components/shop/shop-catalog.tsx');
const {Dialog}=load('src/components/ui/dialog.tsx');
const product={id:'p',name:'Playza Shirt',name_ar:'تيشيرت بلايزا',price:350,description:'Training shirt',description_ar:'تيشيرت تمرين',size_chart:[{size:'M',chest:50,length:70}],published:true,variants:[
 {id:'purple',product_id:'p',color:'Purple',color_ar:'بنفسجي',color_hex:'#4c1d95',size:'M',images:['/purple-front.jpg','/purple-back.jpg'],stock:3,active:true},
 {id:'black',product_id:'p',color:'Black',color_ar:'أسود',color_hex:'#111111',size:'M',images:['/black-front.jpg','/black-back.jpg'],stock:2,active:true},
 {id:'sold-out',product_id:'p',color:'Black',color_hex:'#111111',size:'L',images:['/black-front.jpg'],stock:0,active:true},
]};
function find(node,test){if(!node||typeof node!=='object')return;if(test(node))return node;let found;React.Children.forEach(node.props?.children,c=>{found??=find(c,test)});return found;}
for(lang of ['en','ar']){
 values=[];
 const render=()=>{cursor=0;return ShopProductCard({product})};
 let tree=render();assert.equal(find(tree,n=>n.type==='img').props.src,'/purple-front.jpg');
 find(tree,n=>n.type==='button'&&n.props.children==='M').props.onClick();tree=render();assert.ok(find(tree,n=>n.props?.href==='/shop/checkout?variant=purple'));
 find(tree,n=>n.props?.['aria-label']===(lang==='ar'?'أسود':'Black')).props.onClick();tree=render();assert.equal(find(tree,n=>n.type==='img').props.src,'/black-front.jpg');assert.ok(!find(tree,n=>n.props?.href==='/shop/checkout?variant=purple'));
 find(tree,n=>n.type==='button'&&n.props.children==='M').props.onClick();tree=render();assert.ok(find(tree,n=>n.props?.href==='/shop/checkout?variant=black'));
 assert.equal(find(tree,n=>n.type==='button'&&n.props.children==='L').props.disabled,true);
 find(tree,n=>n.props?.['aria-label']===(lang==='ar'?'صورة 2':'Photo 2')).props.onClick();tree=render();assert.equal(find(tree,n=>n.type==='img').props.src,'/black-back.jpg');
 find(tree,n=>n.props?.['aria-label']===(lang==='ar'?'بنفسجي':'Purple')).props.onClick();tree=render();assert.equal(find(tree,n=>n.type==='img').props.src,'/purple-front.jpg');
 find(tree,n=>n.type==='button'&&React.Children.toArray(n.props.children).includes(lang==='ar'?'جدول المقاسات':'Size guide')).props.onClick();tree=render();assert.equal(find(tree,n=>n.type===Dialog).props.open,true);
}
values=[];cursor=0;
const availableColor={...product,gender:'women',variants:[{...product.variants[0],stock:0},product.variants[1]]};
let availableTree=ShopProductCard({product:availableColor});
assert.equal(find(availableTree,n=>n.type==='img').props.src,'/black-front.jpg','prefer a color with available stock');
assert.ok(renderToStaticMarkup(availableTree).includes(lang==='ar'?'حريمي':'Women'));
values=[];cursor=0;lang='en';
let callback,cleared=false;
global.window={matchMedia:()=>({matches:false}),setInterval:fn=>{callback=fn;return 7},clearInterval:id=>{cleared=id===7}};global.document={hidden:false};
let slideshow=ShopProductCard({product});const cleanup=lastEffect();assert.equal(typeof callback,'function');callback();cursor=0;slideshow=ShopProductCard({product});assert.equal(find(slideshow,n=>n.type==='img').props.src,'/purple-back.jpg');
cleanup();assert.ok(cleared,'timer is cleaned up');
find(slideshow,n=>n.props?.['aria-label']==='Pause product slideshow').props.onClick();cursor=0;slideshow=ShopProductCard({product});callback=null;lastEffect();assert.equal(callback,null,'explicit pause stops the slideshow');
console.log('PASS: bilingual color-specific galleries, photo reset, size selection/reset, correct checkout variant, sold-out size and size-chart dialog');
