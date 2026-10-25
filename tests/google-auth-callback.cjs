const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
let exchangeError=null,user={id:'account'},profile={role:'member',phone:'provided',gender:'provided',birth_date:'provided'},exchanges=0;
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(id=>{
 if(id==='@/lib/supabase/server')return {createClient:()=>({auth:{exchangeCodeForSession:async()=>{exchanges++;return {error:exchangeError}},getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile})})})})})};
 if(id.startsWith('@/'))return load(path.resolve('src',id.slice(2))+'.ts');return require(id);
},out);return out;}
const {GET}=load('src/app/auth/callback/route.ts');
async function callback(query){const response=await GET(new Request('https://playza.example/auth/callback'+query));assert.equal(response.headers.get('cache-control'),'private, no-store');return new URL(response.headers.get('location'));}
(async()=>{
 let url=await callback('?code=TEST&next=%2Fgames%3Fjoin%3Dinvite');assert.equal(url.pathname,'/games');assert.equal(url.searchParams.get('join'),'invite');assert.equal(exchanges,1);
 profile={role:'member',phone:null,gender:null,birth_date:null};url=await callback('?code=TEST&next=%2Fprofile%23details');assert.equal(url.pathname,'/complete-profile');assert.equal(url.searchParams.get('next'),'/profile#details');
 user=null;url=await callback('?code=TEST');assert.equal(url.pathname,'/login');assert.equal(url.searchParams.get('reason'),'provider');
 exchangeError={code:'flow_state_expired',message:'PRIVATE provider details'};url=await callback('?code=TEST');assert.equal(url.searchParams.get('reason'),'expired');assert.ok(!url.href.includes('PRIVATE'));
 const previous=exchanges;url=await callback('?error=access_denied&error_description=PRIVATE&next=https://evil.example');assert.equal(exchanges,previous);assert.equal(url.searchParams.get('reason'),'cancelled');assert.equal(url.searchParams.get('redirectedFrom'),'/dashboard');assert.ok(!url.href.includes('PRIVATE'));
 url=await callback('?error=server_error&error_description=PRIVATE');assert.equal(url.searchParams.get('reason'),'provider');assert.ok(!url.href.includes('PRIVATE'));
 url=await callback('');assert.equal(url.pathname,'/login');
 console.log('PASS: Google callback code exchange, verified session, profile completion, destination preservation, expired/cancelled/provider failures, no-cache redirects and private error exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
