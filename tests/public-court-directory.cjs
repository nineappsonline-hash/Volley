const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',code)(id=>mocks[id]??require(id),exports);return exports;}
const fixture=(id,status='approved',country='Egypt')=>({id,name:`Court ${id}`,approval_status:status,country,address:'Real address',area:'New Cairo',governorate:'Cairo',rental_cost:1200,rental_hours:2,capacity:12,court_count:1,photos:[],cover_url:null,sport:{name:'Volleyball'},owner_id:'PRIVATE',owner_email:'PRIVATE'});
let rows=Array.from({length:1001},(_,i)=>fixture(String(i)));rows.push(fixture('pending','pending'),fixture('rejected','rejected'),fixture('elsewhere','approved','Saudi Arabia'));let fail=false;let selected;
const admin = {
  from(table) {
    assert.equal(table, 'venues');
    const filters = [];
    return {
      select(fields) { selected = fields; return this; },
      eq(k, v) { filters.push(r => r[k] === v); return this; },
      in(k, v) { filters.push(r => v.includes(r[k])); return this; },
      order() { return this; },
      range(a, b) { return Promise.resolve(fail ? { data: null, error: { message: 'offline' } } : { data: rows.filter(r => filters.every(f => f(r))).slice(a, b + 1), error: null }); },
    };
  },
};
const directory=load('src/lib/public-playgrounds.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}});
const seo=load('src/lib/seo.ts');const slugs=load('src/lib/sport-slugs.ts');const discovery=load('src/lib/sport-discovery.ts',{'@/lib/seo':seo,'@/lib/sport-slugs':slugs});const courtMeta=load('src/lib/court-discovery.ts',{'./seo':seo,'./sport-discovery':discovery});
const component=load('src/components/public/court-directory.tsx',{
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}},
 '@/components/shared/app-logo':{AppLogo:()=>null},'@/lib/public-playgrounds':directory,'@/lib/court-discovery':courtMeta,'@/lib/sport-discovery':discovery,'@/lib/sport-slugs':slugs,'@/lib/seo':seo,'@/lib/constants':{formatMoney:n=>`EGP ${n}`},
});
(async()=>{
 const publicRows=await directory.getPublicCourtDirectory();assert.equal(publicRows.length,1001);assert.ok(!selected.includes('owner'));assert.ok(publicRows.every(r=>!('owner_id'in r)&&!('owner_email'in r)));assert.equal((await directory.getPublicCourtDirectory('Beach Volleyball')).length,0);
 rows=[fixture('public'),{...fixture('beach'),sport:[{name:'Beach Volleyball'}]}, {...fixture('unpriced'),rental_cost:null,rental_hours:null},fixture('private','pending')];
 for(const lang of ['en','ar']){const html=renderToStaticMarkup(await component.CourtDirectory({lang,slug:'volleyball'}));assert.ok(html.includes('/p/public'));assert.ok(html.includes('/p/unpriced'));assert.ok(!html.includes('/p/beach'));assert.ok(!html.includes('/p/private'));assert.ok(!html.includes('PRIVATE'));assert.ok(html.includes('EGP 1200 / 2'));assert.ok(html.includes(lang==='ar'?'راجع صفحة الملعب للأسعار':'Check the venue page for pricing'));const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];assert.equal(graph.find(x=>x['@type']==='ItemList').numberOfItems,2);const meta=courtMeta.courtDirectoryMetadata(lang,'volleyball');assert.equal(meta.alternates.canonical,`${lang==='ar'?'/ar':''}/courts?sport=volleyball`);}
 await assert.rejects(()=>component.CourtDirectory({lang:'en',slug:'invented'}),/NOT_FOUND/);fail=true;assert.deepEqual(await directory.getPublicCourtDirectory(),[]);
 console.log('PASS: approved Egypt-only public courts, pagination, sport relations/filtering, no owner fields, bilingual SSR, real/missing prices, canonicals, unknown sports and database failure');
})().catch(e=>{console.error(e);process.exitCode=1});
