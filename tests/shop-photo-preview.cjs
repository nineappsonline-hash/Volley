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
mocks.react={...React,useState:initial=>{const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],v=>{values[index]=typeof v==='function'?v(values[index]):v}];}};
const {ProductPhotoPreview}=load('src/components/shop/product-photo-preview.tsx');
const {Dialog,DialogClose,DialogTrigger}=load('src/components/ui/dialog.tsx');
function find(node,test){if(!node||typeof node!=='object')return;if(test(node))return node;let found;React.Children.forEach(node.props?.children,c=>{found??=find(c,test)});return found;}
for(lang of ['en','ar']){
 values=[];const render=()=>{cursor=0;return ProductPhotoPreview({src:'/selected-blue.webp',alt:'Blue sports shirt',children:React.createElement('img',{src:'/selected-blue.webp',alt:'Blue sports shirt'})})};
 let tree=render();assert.equal(find(tree,n=>n.type===Dialog).props.open,false);
 const trigger=find(tree,n=>n.type==='button');assert.ok(trigger.props['aria-label'].includes('Blue sports shirt'));assert.ok(find(tree,n=>n.type===DialogTrigger),'native dialog trigger supports keyboard activation and focus restoration');find(tree,n=>n.type===Dialog).props.onOpenChange(true);tree=render();
 assert.equal(find(tree,n=>n.type===Dialog).props.open,true);
 assert.ok(find(tree,n=>n.props?.src==='/selected-blue.webp'));
 const close=find(tree,n=>n.type===DialogClose);assert.ok(close,'enlarged photo has an explicit close control');
 find(tree,n=>n.type===Dialog).props.onOpenChange(false);tree=render();assert.equal(find(tree,n=>n.type===Dialog).props.open,false);
}
console.log('PASS: product photo opens enlarged and has an accessible close control in English and Arabic');
