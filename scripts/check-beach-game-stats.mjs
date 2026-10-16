import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
await db.exec(readFileSync('supabase/migrations/20261016174203_beach_game_statistics.sql','utf8'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(let n=1;n<=5;n++)await db.query("INSERT INTO beach_game_sessions(id,token_hash,started_at) VALUES($1,'hash',now()-$2::interval)",[id(n),n===4?'1 second':n===5?'25 hours':'100 seconds']);
await db.exec('SET ROLE service_role');
const complete=async(n,p,c,token='hash')=>(await db.query('SELECT finish_beach_game($1,$2,$3,$4) AS totals',[id(n),token,p,c])).rows[0].totals;
assert.deepEqual(await complete(1,7,3),{totalGames:1,playerWins:1,cpuWins:0,draws:0});
assert.equal((await complete(1,0,9)).totalGames,1); // Retry, even with a different score, cannot change a recorded result.
assert.deepEqual(await complete(2,1,8),{totalGames:2,playerWins:1,cpuWins:1,draws:0});
assert.deepEqual(await complete(3,4,4),{totalGames:3,playerWins:1,cpuWins:1,draws:1});
await assert.rejects(()=>complete(4,1,0),/eligible/);await assert.rejects(()=>complete(5,1,0),/eligible/);
await assert.rejects(()=>complete(2,1,0,'wrong'),/token/);await assert.rejects(()=>complete(2,-1,0),/score/);
assert.equal((await db.query('SELECT read_beach_game_totals() AS t')).rows[0].t.totalGames,3);
for(const role of ['anon','authenticated']){await db.exec(`RESET ROLE;SET ROLE ${role}`);await assert.rejects(()=>db.query('SELECT * FROM beach_game_totals'),/permission denied/);await assert.rejects(()=>db.query('SELECT read_beach_game_totals()'),/permission denied/);await assert.rejects(()=>complete(1,7,3),/permission denied/);}
await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int AS n FROM beach_game_sessions WHERE finished_at IS NULL')).rows[0].n,2);
const seed=readFileSync('supabase/migrations/20261016174923_beach_game_starting_totals.sql','utf8');
for(let attempt=0;attempt<2;attempt++){await db.exec(seed);assert.deepEqual((await db.query('SELECT read_beach_game_totals() AS t')).rows[0].t,{totalGames:235,playerWins:30,cpuWins:167,draws:38});}
await db.close();console.log('Stats database tests passed: win/loss/draw totals, duplicate retry, token and duration validation, abandoned exclusion, anonymous access denied.');
