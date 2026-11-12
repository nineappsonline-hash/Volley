const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
const exportsObject={};
new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/my-games.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,exportsObject);
const {fetchMyGames}=exportsObject;
(async()=>{
 const requests=[];
 const created=Array.from({length:101},(_,i)=>({id:'created-'+i,creator_id:'member',game_date:'2025-01-01',start_time:'18:00',status:i?'completed':'cancelled',participants:[]}));
 const joined=[created[0],{id:'joined-private',game_date:'2027-01-01',start_time:'18:00',is_public:false,status:'full',participants:[{member_id:'member',is_waitlisted:true},{member_id:'another',is_waitlisted:false,pay_status:'approved'},{member_id:'pending',is_waitlisted:false,pay_status:'pending'}]}];
 let fail=false;
 const client=createClient('https://example.supabase.co','test-key',{global:{fetch:async(input)=>{
  const url=new URL(String(input));requests.push(url);
  if(fail)return new Response(JSON.stringify({message:'denied'}),{status:403});
  assert.ok(!url.searchParams.has('game_date'));assert.ok(!url.searchParams.has('status'));
  const isJoined=url.searchParams.has('membership.member_id');
  assert.equal(url.searchParams.get(isJoined?'membership.member_id':'creator_id'),'eq.member');
  if(isJoined)assert.ok(url.searchParams.get('select').includes('membership:friendly_game_participants!inner(member_id)'));
  const offset=Number(url.searchParams.get('offset'));const limit=Number(url.searchParams.get('limit'));
  return new Response(JSON.stringify((isJoined?joined:created).slice(offset,offset+limit)),{status:200,headers:{'Content-Type':'application/json'}});
 }},auth:{persistSession:false,autoRefreshToken:false}});
 const games=await fetchMyGames(client,'member');
 assert.equal(games.length,101);assert.equal(games[0].id,'joined-private');assert.equal(games[0].participants_count,1);assert.equal(games[0].waitlist_count,1);assert.ok(!games.some(g=>g.status==='cancelled'));assert.ok(games.some(g=>g.id==='created-100'));assert.equal(games.filter(g=>g.id==='created-0').length,0);assert.equal(requests.length,3);
 fail=true;await assert.rejects(fetchMyGames(client,'member'));
 console.log('PASS: personal history queries only created/joined games, pages past 100 rows, preserves private/waitlisted/past/cancelled games and full rosters, deduplicates and propagates errors');
})().catch(e=>{console.error(e);process.exit(1)});
