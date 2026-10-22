const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
let result={data:false,error:null};const calls=[];
const analytics=new Proxy({}, {get:(_,key)=>(...args)=>{calls.push([key,...args]);return Promise.resolve();}});
let authResponse={data:{user:{id:'new-user',identities:[{}]},session:{access_token:'never-track'}},error:null};
const client={rpc:async()=>result,auth:{signUp:async()=>authResponse,signInWithOAuth:async()=>({error:null})}};
const mocks={react:{useCallback:fn=>fn},'@/lib/supabase/client':{createClient:()=>client},'@/lib/analytics/registrations':analytics,'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}}),useMutation:opts=>({mutateAsync:async input=>{const data=await opts.mutationFn(input);opts.onSuccess?.(data,input);return data;}})}};
function load(file){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(out,id=>mocks[id]??{});return out;}
const queries=load('src/lib/queries.ts');const auth=load('src/lib/auth.ts').useAuth();global.window={location:{origin:'https://playza.test'}};
(async()=>{
 result={data:false,error:null};await queries.joinPublicAcademy('a');assert.equal(calls.filter(c=>c[0]==='confirmAcademyRegistration').length,0);
 result={data:null,error:new Error('failed')};await queries.joinPublicAcademy('a');assert.equal(calls.filter(c=>c[0]==='confirmAcademyRegistration').length,0);
 result={data:true,error:null};await queries.joinPublicAcademy('a');assert.deepEqual(calls.at(-1),['confirmAcademyRegistration','a']);
 const join=queries.useJoinFriendlyGame();const input={gameId:'g',payMethod:null,payReceiptUrl:null};
 result={data:true,error:null};await join.mutateAsync(input);assert.equal(calls.filter(c=>c[0]==='confirmGameRegistration').length,0);
 result={data:false,error:new Error('failed')};await assert.rejects(join.mutateAsync(input));assert.equal(calls.filter(c=>c[0]==='confirmGameRegistration').length,0);
 result={data:false,error:null};await join.mutateAsync(input);assert.deepEqual(calls.at(-1),['confirmGameRegistration','g']);
 await auth.signUp('PRIVATE','PRIVATE','PRIVATE','PRIVATE');assert.ok(calls.some(c=>c[0]==='confirmPendingSignup'));assert.deepEqual(calls.find(c=>c[0]==='startSignup'),['startSignup','player','email',{sport:undefined,sports:undefined,country:undefined,governorate:undefined,city:undefined}]);
 calls.length=0;authResponse={data:{user:{id:'pending-email',identities:[{}]},session:null},error:null};await auth.signUp('PRIVATE','PRIVATE','PRIVATE','PRIVATE',undefined,{ownerMode:true});assert.equal(calls[0][1],'venue');assert.ok(!calls.some(c=>c[0]==='confirmPendingSignup'));
 calls.length=0;authResponse={data:{user:{id:'new-owner',identities:[{}]},session:{}},error:null};await auth.signUp('PRIVATE','PRIVATE','PRIVATE','PRIVATE',undefined,{newName:'PRIVATE',sports:'Tennis'});assert.equal(calls[0][1],'academy_owner');assert.ok(!JSON.stringify(calls).includes('PRIVATE'));
 calls.length=0;authResponse={data:{},error:new Error('signup failed')};await assert.rejects(auth.signUp('PRIVATE','PRIVATE','PRIVATE','PRIVATE'));assert.ok(calls.some(c=>c[0]==='cancelSignup'));assert.ok(!calls.some(c=>c[0]==='confirmPendingSignup'));
 calls.length=0;authResponse={data:{user:{id:'obfuscated',identities:[]},session:null},error:null};await auth.signUp('PRIVATE','PRIVATE','PRIVATE','PRIVATE');assert.ok(calls.some(c=>c[0]==='cancelSignup'));assert.ok(!calls.some(c=>c[0]==='rememberSignupUser'));
 console.log('PASS: real signup, academy join and game join hooks emit completion signals only for successful responses; no waitlist/error/duplicate-account signals; metadata excludes personal inputs');
})().catch(e=>{console.error(e);process.exitCode=1});
