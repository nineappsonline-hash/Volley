const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const text=fs.readFileSync('src/lib/queries.ts','utf8');
const source=text.slice(text.indexOf('export function useAllGamePayments()'),text.indexOf('export function useReviewRentPayment()'));
let rootRows=[{id:'payer',pay_status:'pending',share_amount:100,game:[{title:'Match'}]}],guestError=null,ranges=[],parentFilter=false;
let guests=Array.from({length:501},(_,i)=>({id:`guest-${i}`,player_name:`Guest ${i}`,share_amount:10,sponsor_participant_id:'payer'}));
const client={from(table){assert.equal(table,'friendly_game_participants');return {
 select(){return this},is(column,value){assert.equal(column,'sponsor_participant_id');assert.equal(value,null);parentFilter=true;return this},
 in(column,values){if(column==='sponsor_participant_id')assert.deepEqual(values,['payer']);return this},order(){return this},
 async limit(n){assert.equal(n,200);assert.ok(parentFilter);return {data:rootRows,error:null}},
 async range(start,end){ranges.push([start,end]);return {data:guests.slice(start,end+1),error:guestError}},
}}};
const out={};new Function('exports','useQuery','supabase',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,options=>options,()=>client);
(async()=>{
 let rows=await out.useAllGamePayments().queryFn();
 assert.equal(rows.length,1);assert.equal(rows[0].guests.length,501);assert.equal(rows[0].game.title,'Match');
 assert.deepEqual(ranges,[[0,499],[500,999]]);
 guestError=new Error('guest query failed');await assert.rejects(out.useAllGamePayments().queryFn(),/guest query failed/);
 guestError=null;rootRows=[];ranges=[];rows=await out.useAllGamePayments().queryFn();assert.deepEqual(rows,[]);assert.deepEqual(ranges,[]);
 console.log('PASS: payer filtering before limit, complete guest pagination, normalized booking, empty results and no partial totals on guest-fetch failure');
})().catch(e=>{console.error(e);process.exitCode=1});
