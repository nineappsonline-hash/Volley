const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ts=require('typescript');
const api={};
const seoCode=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/seo.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function siteUrl(value){const seo={};new Function('exports','process',seoCode)(seo,{env:{NEXT_PUBLIC_SITE_URL:value}});return seo.SITE_URL;}
assert.equal(siteUrl(undefined),'https://playza.nineapps.online');
assert.equal(siteUrl('  '),'https://playza.nineapps.online');
assert.equal(siteUrl(' https://playza.nineapps.online/// '),'https://playza.nineapps.online');
let failAcademies=false,failGames=false;
const rows=Array.from({length:1001},(_,i)=>({id:String(i),slug:'academy-'+i}));
const mocks={
 '@/lib/active-sports':{ACTIVE_SPORTS:['Tennis','Volleyball','Beach Volleyball'],isActiveSport:name=>['Tennis','Volleyball','Beach Volleyball'].includes(name)},
 '@/lib/volleyball-guides':{VOLLEYBALL_GUIDES:[{slug:'volleyball-cairo'},{slug:'join-volleyball-without-team'},{slug:'beach-volleyball-beginners'}],guidePath:(lang,slug)=>`${lang==='ar'?'/ar':''}/guides${slug?'/'+slug:''}`},
 '@/lib/guides':{ALL_GUIDES:[{slug:'volleyball-cairo'},{slug:'join-volleyball-without-team'},{slug:'beach-volleyball-beginners'},{slug:'find-basketball-players-cairo'},{slug:'find-padel-partners-cairo'},{slug:'find-tennis-partners-cairo'},{slug:'choose-sports-academy-for-your-child'},{slug:'adult-volleyball-training'},{slug:'beginner-padel-training'}],guidePath:(lang,slug)=>`${lang==='ar'?'/ar':''}/guides${slug?'/'+slug:''}`},
 '@/lib/seo':{SITE_URL:siteUrl(undefined)},
 '@/lib/sport-slugs':{sportToSlug:s=>s.toLowerCase()},
 '@/lib/sport-discovery':{DISCOVERY_SPORTS:[{slug:'football'},{slug:'padel'}],discoveryPath:(lang,slug)=>`${lang==='ar'?'/ar':''}/sports${slug?'/'+slug:''}`},
 '@/lib/local-games':{LOCAL_GAME_GUIDES:[{slug:'volleyball-new-cairo'},{slug:'beach-volleyball-new-cairo'}],localGamePath:(lang,slug)=>`${lang==='ar'?'/ar':''}/play/${slug}`},
 '@/lib/game-discovery':{publicGamePath:id=>`/games/${id}`},
 '@/lib/list-your-court':{listYourCourtPath:lang=>`${lang==='ar'?'/ar':''}/list-your-court`},
 '@/lib/public-playgrounds':{getPublicCourtDirectory:async()=>[{id:'c1',name:'Court 1',area:'New Cairo',sport:{name:'Padel'}},{id:'c2',name:'Court 2',area:'New Cairo',sport:{name:'Football'}}]},
 '@/lib/court-locations':{courtsLocationPath:(lang,sport,location)=>`${lang==='ar'?'/ar':''}/courts/${sport}/${location}`,locationSlugsWithInventory:(courts,sport)=>courts.filter(c=>c.sport.name===sport).map(()=> 'new-cairo').filter((v,i,a)=>a.indexOf(v)===i)},
 '@/lib/public-games':{getPublicGameIds:async()=>{if(failGames)throw Error('offline');return ['public-game'];},getPublicGameSports:async()=>{if(failGames)throw Error('offline');return ['Football','football'];},getPublicTournamentSports:async()=>['Padel']},
 '@/lib/supabase/admin':{createAdminClient:()=>{if(failAcademies)throw Error('unavailable');return {from:()=>({select(){return this;},in(){return this;},eq(k,v){assert.equal(k,'is_public');assert.equal(v,true);return this;},not(){return this;},order(){return this;},range:async(a,b)=>({data:rows.slice(a,b+1),error:null})})};}},
};
new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/app/sitemap.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(api,n=>mocks[n]);
(async()=>{
 let pages=await api.default();
 assert.ok(pages.every(p=>new URL(p.url).origin==='https://playza.nineapps.online'));
 assert.equal(pages.filter(p=>p.url.includes('/a/')).length,1001);
 const discoveryPages=pages.filter(p=>p.url.includes('/sports'));
 assert.equal(discoveryPages.length,6);
 assert.equal(pages.filter(p=>p.url.includes('/guides')).length,20);
 assert.equal(pages.filter(p=>p.url.includes('/play/')).length,4);
 assert.ok(pages.some(p=>p.url.endsWith('/games/public-game')));
 for(const page of discoveryPages){
   assert.ok(pages.some(p=>p.url===page.alternates.languages.en));
   assert.ok(pages.some(p=>p.url===page.alternates.languages['ar-EG']));
 }
 assert.equal(pages.filter(p=>p.url.endsWith('/games?sport=football')).length,1);
 assert.ok(!pages.some(p=>/signup|login|dashboard|join=/.test(p.url)));
 assert.ok(pages.every(p=>!p.lastModified));
 failAcademies=true;pages=await api.default();assert.ok(pages.some(p=>p.url.endsWith('/games?sport=football')));
 failGames=true;pages=await api.default();assert.ok(pages.some(p=>p.url.endsWith('/tournaments?sport=padel')));assert.ok(pages.some(p=>p.url==='https://playza.nineapps.online'));
 console.log('PASS: academy pagination, deduplication, public-only URLs, honest dates, and independent data-source failures');
})().catch(e=>{console.error(e);process.exitCode=1});
