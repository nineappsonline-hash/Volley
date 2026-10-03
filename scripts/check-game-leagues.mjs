import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import vm from 'node:vm';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), other = id(2), game = id(10), second = id(11);
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin', true), '') = 'yes' $$;
  CREATE TABLE public.friendly_games(id uuid PRIMARY KEY, creator_id uuid, game_date date, start_time time, status text);
  CREATE TABLE public.friendly_game_participants(id uuid PRIMARY KEY, game_id uuid, player_name text, is_waitlisted boolean);
`);
await db.exec(readFileSync('supabase/migrations/20261227000000_friendly_game_leagues.sql', 'utf8'));
await db.query("SELECT set_config('test.uid', $1, false)", [owner]);
await db.query("INSERT INTO friendly_games VALUES ($1,$3,current_date-1,'10:00','open'),($2,$3,current_date-1,'10:00','open')", [game, second, owner]);
for (let n = 0; n < 8; n++) {
  await db.query('INSERT INTO friendly_game_participants VALUES ($1,$2,$3,false)', [id(100+n), game, `Player ${n+1}`]);
}
await db.query("INSERT INTO friendly_game_participants VALUES ($1,$2,'Waitlisted',true),($3,$4,'Another game',false)", [id(200), game, id(201), second]);
const call = async (action = 'read', revision = null, payload = {}, gameId = game) => (await db.query('SELECT manage_friendly_game_league($1,$2,$3,$4::jsonb) AS league', [gameId, action, revision, JSON.stringify(payload)])).rows[0].league;
const rejects = async (fn, message) => assert.rejects(fn, message);
let league = await call();
assert.equal(league.roster.length, 8);
assert.equal(league.revision, 0);
await db.exec('SET ROLE authenticated');
assert.equal((await call()).revision, 0);
await rejects(() => db.query('SELECT * FROM friendly_game_leagues'), /permission denied/);
await db.exec('RESET ROLE');
await db.query("SELECT set_config('test.uid', $1, false)", [other]);
await rejects(() => call(), /Only the game creator/);
await db.query("SELECT set_config('test.uid', '', false)");
await rejects(() => call(), /Sign in/);
await db.query("SELECT set_config('test.uid', $1, false)", [owner]);
await db.query("UPDATE friendly_games SET game_date = current_date+1 WHERE id=$1", [game]);
await rejects(() => call(), /when the game starts/);
await db.query("UPDATE friendly_games SET game_date = current_date-1, status='cancelled' WHERE id=$1", [game]);
await rejects(() => call(), /cancelled/);
await db.query("UPDATE friendly_games SET status='open' WHERE id=$1", [game]);
const teams = Array.from({ length: 4 }, (_, n) => ({ id: id(300+n), name: `Team ${n+1}`, players: [id(100+n*2), id(101+n*2)] }));
await rejects(() => call('setup', 0, { teams: teams.map((t,n) => n === 0 ? {...t, players:[id(200)]} : t) }), /active player/);
await rejects(() => call('setup', 0, { teams: teams.map((t,n) => n === 0 ? {...t, players:[id(201)]} : t) }), /active player/);
await rejects(() => call('setup', 0, { teams: teams.map((t,n) => n === 1 ? {...t, name:' team 1 '} : t) }), /different/);
await rejects(() => call('setup', 0, { teams: teams.map((t,n) => n === 1 ? {...t, players:[id(100)]} : t) }), /only one team/);
league = await call('setup', 0, { teams });
await rejects(() => call('generate', 0), /league changed/);
league = await call('generate', league.revision);
assert.equal(league.matches.length, 6);
const verifySchedule = (matches, count) => {
  assert.equal(matches.length, count*(count-1)/2);
  assert.equal(new Set(matches.map(m => [m.a,m.b].sort().join(':'))).size, matches.length);
  for (const round of new Set(matches.map(m => m.round))) {
    const players = matches.filter(m => m.round === round).flatMap(m => [m.a,m.b]);
    assert.equal(new Set(players).size, players.length);
  }
};
verifySchedule(league.matches, 4);
await rejects(() => call('generate', league.revision), /already exist/);
await rejects(() => call('setup', league.revision, {teams}), /locked/);
for (const score of [-1, 1.5, 10000, null]) await rejects(() => call('score', league.revision, { match_id:1, score_a:score, score_b:0 }), /whole numbers/);
await rejects(() => call('score', league.revision, {match_id:999,score_a:0,score_b:0}), /Match not found/);
league = await call('score', league.revision, {match_id:1,score_a:25,score_b:20});
assert.equal(league.matches[0].score_a, 25);
await db.query("SELECT set_config('test.uid', $1, false), set_config('test.admin','yes',false)", [other]);
league = await call('score', league.revision, {match_id:1,score_a:20,score_b:25});
assert.equal(league.matches[0].score_a, 20);
await db.query("SELECT set_config('test.uid', $1, false), set_config('test.admin','no',false)", [owner]);
// Odd-team fixtures and roster changes between setup and generation.
const oddTeams = Array.from({length:3}, (_,n) => ({id:id(400+n),name:`Odd ${n}`,players:[id(500+n)]}));
await db.query('DELETE FROM friendly_game_participants WHERE game_id=$1', [second]);
for (let n=0;n<3;n++) await db.query('INSERT INTO friendly_game_participants VALUES($1,$2,$3,false)',[id(500+n),second,`Odd player ${n}`]);
let odd = await call('setup',0,{teams:oddTeams},second);
await db.query('UPDATE friendly_game_participants SET is_waitlisted=true WHERE id=$1',[id(500)]);
await rejects(() => call('generate',odd.revision,{},second), /roster changed/);
await db.query('UPDATE friendly_game_participants SET is_waitlisted=false WHERE id=$1',[id(500)]);
odd = await call('generate',odd.revision,{},second);
verifySchedule(odd.matches,3);
// Pure standings and Cairo kickoff tests, running the real TypeScript module.
const compiled = ts.transpileModule(readFileSync('src/lib/game-league.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports = {};
vm.runInNewContext(compiled, {exports, require:createRequire(import.meta.url), Intl, Date, Map, Set});
let standings = exports.gameLeagueStandings(league.teams,league.matches);
assert.equal(standings[0].id, league.matches[0].b);
assert.equal(standings[0].points,3);
assert.equal(standings.reduce((sum,row)=>sum+row.played,0),2);
const drawn = league.matches.map((m,i)=>i===0?{...m,score_a:0,score_b:0}:m);
assert.equal(exports.gameLeagueStandings(league.teams,drawn).reduce((sum,row)=>sum+row.points,0),2);
assert.equal(exports.hasGameStarted('2026-07-01','15:00',new Date('2026-07-01T11:59:59Z')),false);
assert.equal(exports.hasGameStarted('2026-07-01','15:00',new Date('2026-07-01T12:00:00Z')),true);
assert.equal(exports.hasGameStarted('2026-01-01','15:00',new Date('2026-01-01T13:00:00Z')),true);
await db.close();
console.log('Game league checks passed: authorization, kickoff, roster validation, concurrency, even/odd fixtures, scores, standings and Cairo DST.');
