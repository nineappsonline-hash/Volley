const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"app_metadata":{"role":"admin"}}'::jsonb $$;
 CREATE FUNCTION public.current_academy_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000002'::uuid $$;
 CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true) = 'yes' $$;
 CREATE TABLE tournaments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academy_id uuid,format text);
 CREATE TABLE teams(id uuid PRIMARY KEY,academy_id uuid);
 CREATE TABLE tournament_teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,name text,created_at timestamptz DEFAULT now());
 CREATE TABLE tournament_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tournament_id uuid,member_id uuid);
 CREATE TABLE tournament_team_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,participant_id uuid);
 CREATE TABLE tournament_matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,team_a_id uuid,team_b_id uuid,score_a integer,score_b integer,goals_a integer,goals_b integer,round_name text,prev_match_a_id uuid,prev_match_b_id uuid,slot integer,status text,notes text);
 SET test.admin='yes';`);
 const sql=fs.readFileSync('supabase/migrations/20261126000000_tournament_team_leagues.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 for (const n of [2,3,4,5,6]) {
 const {rows:[{id}]}=await db.query("INSERT INTO tournaments(format) VALUES('league') RETURNING id");
 await db.query("INSERT INTO tournament_teams(tournament_id,name) SELECT $1,'Team '||i FROM generate_series(1,$2::int) i",[id,n]);
 await db.query('SELECT generate_tournament_fixtures($1)',[id]);
 const {rows:matches}=await db.query('SELECT * FROM tournament_matches WHERE tournament_id=$1',[id]);
 assert.equal(matches.length,n*(n-1)/2);
 assert(matches.every(m=>m.team_a_id && m.team_b_id && m.team_a_id!==m.team_b_id));
 assert.equal(new Set(matches.map(m=>[m.team_a_id,m.team_b_id].sort().join('/'))).size,matches.length);
 await db.query('SELECT submit_tournament_score($1,2,1)',[matches[0].id]);
 await assert.rejects(db.query('SELECT generate_tournament_fixtures($1)',[id]),/cannot be regenerated/);
 await db.query('SELECT submit_tournament_score($1,1,1)',[matches[0].id]);
 await db.exec("SET test.admin='no'");
 await assert.rejects(db.query('SELECT submit_tournament_score($1,1,0)',[matches[0].id]),/Not authorized/);
 await db.query('UPDATE tournaments SET academy_id=current_academy_id() WHERE id=$1',[id]);
 await db.query('SELECT submit_tournament_score($1,3,1)',[matches[0].id]);
 await db.exec("SET test.admin='yes'");
 }
 const {rows:[{id:tid}]}=await db.query("INSERT INTO tournaments(format) VALUES('league') RETURNING id");
 const {rows:rosterTeams}=await db.query("INSERT INTO tournament_teams(tournament_id,name) VALUES($1,'A'),($1,'B') RETURNING id",[tid]);
 const {rows:[{id:pid}]}=await db.query('INSERT INTO tournament_participants(tournament_id) VALUES($1) RETURNING id',[tid]);
 await db.query('INSERT INTO tournament_team_members(team_id,participant_id) VALUES($1,$2)',[rosterTeams[0].id,pid]);
 await assert.rejects(db.query('INSERT INTO tournament_team_members(team_id,participant_id) VALUES($1,$2)',[rosterTeams[1].id,pid]),/already assigned/);
 const {rows:[{id:otherPid}]}=await db.query('INSERT INTO tournament_participants(tournament_id) VALUES(gen_random_uuid()) RETURNING id');
 await assert.rejects(db.query('INSERT INTO tournament_team_members(team_id,participant_id) VALUES($1,$2)',[rosterTeams[0].id,otherPid]),/same tournament/);
 const ts=require('typescript');
 const compiled=ts.transpileModule(fs.readFileSync('src/lib/tournament-results.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const mod={exports:{}};new Function('module','exports',compiled)(mod,mod.exports);
 const teams=[{id:'a',name:'Alpha'},{id:'b',name:'Beta'},{id:'c',name:'Charlie'}];
 const matches=[{team_a_id:'a',team_b_id:'b',status:'completed',score_a:2,score_b:0},{team_a_id:'b',team_b_id:'c',status:'completed',score_a:1,score_b:1},{team_a_id:'a',team_b_id:'c',status:'scheduled'}];
 assert.deepEqual(mod.exports.computeLeagueStandings(matches,teams).map(r=>[r.team_id,r.points]),[['a',3],['c',1],['b',1]]);
 const remaining=mod.exports.computeRemainingGames(matches,teams);
 assert.equal(remaining[0].count,1);assert.equal(remaining[0].opponents[0].name,'Charlie');assert.equal(remaining[1].count,0);
 console.log('PASS: roster integrity, standings, remaining opponents; 2–6 team leagues, unique pairings, no byes, score correction, result protection, academy and super-admin access, unauthorized denial, migration rerun');
 } finally {await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
