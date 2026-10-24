const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
let reserved=0,uploaded=0,limited=false,uploadError=false,last;
const admin={
 rpc:async(name,args)=>{assert.equal(name,'reserve_court_signup_photo');assert.match(args.p_fingerprint,/^[a-f0-9]{64}$/);reserved++;return {error:limited?{message:'limit'}:null}},
 storage:{from:bucket=>{
  assert.equal(bucket,'venue-photos');
  return {
   upload:async(path,bytes,options)=>{uploaded++;last={path,bytes,options};return {error:uploadError?{message:'private internal error'}:null}},
   getPublicUrl:path=>({data:{publicUrl:'https://example.invalid/'+path}})
  };
 }}
};
const exports_={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/app/api/court-signup/photos/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(id=>id==='@/lib/supabase/admin'?{createAdminClient:()=>admin}:require(id),exports_);
const url='https://playza.example/api/court-signup/photos';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6uWQAAAAASUVORK5CYII=','base64');
function request(bytes=png,origin='https://playza.example',extra={}){const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'untrusted-name.png');return new Request(url,{method:'POST',headers:{origin,'x-forwarded-for':'192.0.2.1',...extra},body:form});}
(async()=>{
 assert.equal((await exports_.POST(request(png,'https://evil.invalid'))).status,403);
 assert.equal((await exports_.POST(request(png,undefined,{'content-length':String(5*1024*1024)}))).status,413);
 assert.equal((await exports_.POST(request(Buffer.from('not an image')))).status,400);assert.equal(reserved,0);assert.equal(uploaded,0);
 let response=await exports_.POST(request());assert.equal(response.status,200);assert.ok((await response.json()).url.startsWith('https://example.invalid/venues/signup/'));assert.match(last.path,/^venues\/signup\/[a-f0-9-]+\.png$/);assert.equal(last.options.contentType,'image/png');assert.deepEqual(last.bytes,png);
 limited=true;assert.equal((await exports_.POST(request())).status,429);assert.equal(uploaded,1);
 limited=false;uploadError=true;response=await exports_.POST(request());assert.equal(response.status,500);assert.ok(!JSON.stringify(await response.json()).includes('private internal'));
 console.log('PASS: guest signup photo origin, streaming/body limits, image signature checks, private rate reservation, safe filenames/MIME and generic failures');
})().catch(e=>{console.error(e);process.exitCode=1});
