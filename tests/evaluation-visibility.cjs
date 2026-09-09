const {PGlite}=require('@electric-sql/pglite');
const {readFileSync}=require('node:fs');const {join}=require('node:path');const assert=require('node:assert/strict');
async function main(){const db=new PGlite();await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,guardian_id uuid,role text,is_active boolean,academy_id uuid);
CREATE TABLE player_evaluations(id integer PRIMARY KEY,member_id uuid,academy_id uuid,notes text);
ALTER TABLE player_evaluations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON profiles TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON player_evaluations TO authenticated;
INSERT INTO profiles VALUES
('00000000-0000-0000-0000-000000000001',null,'admin',true,'10000000-0000-0000-0000-000000000000'),
('00000000-0000-0000-0000-000000000002',null,'member',true,'10000000-0000-0000-0000-000000000000'),
('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','member',true,'10000000-0000-0000-0000-000000000000'),
('00000000-0000-0000-0000-000000000004',null,'member',true,'10000000-0000-0000-0000-000000000000'),
('00000000-0000-0000-0000-000000000005',null,'admin',true,'20000000-0000-0000-0000-000000000000');
INSERT INTO player_evaluations VALUES(1,'00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','Parent feedback'),(2,'00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000000','Child feedback');`);
const sql=readFileSync(join(__dirname,'../supabase/migrations/20260909040000_evaluation_visibility.sql'),'utf8');await db.exec(sql);await db.exec(sql);
await db.exec(`SET ROLE authenticated; SET test.uid='00000000-0000-0000-0000-000000000002'`);
assert.equal((await db.query('SELECT * FROM player_evaluations')).rows.length,2);
assert.equal((await db.query("UPDATE player_evaluations SET notes='changed' RETURNING id")).rows.length,0);
assert.equal((await db.query('DELETE FROM player_evaluations RETURNING id')).rows.length,0);
await assert.rejects(db.exec("INSERT INTO player_evaluations VALUES(3,auth.uid(),'10000000-0000-0000-0000-000000000000','Fake')"));
await db.exec("SET test.uid='00000000-0000-0000-0000-000000000004'");assert.equal((await db.query('SELECT * FROM player_evaluations')).rows.length,0);
await db.exec("SET test.uid='00000000-0000-0000-0000-000000000005'");assert.equal((await db.query('SELECT * FROM player_evaluations')).rows.length,0);
await db.exec("SET test.uid='00000000-0000-0000-0000-000000000001'");assert.equal((await db.query("UPDATE player_evaluations SET notes='Coach update' RETURNING id")).rows.length,2);
await assert.rejects(db.exec("UPDATE player_evaluations SET academy_id='20000000-0000-0000-0000-000000000000'"));
await db.exec("SET test.uid=''");assert.equal((await db.query('SELECT * FROM player_evaluations')).rows.length,0);
console.log('PASS: rerun, self/child reads, unrelated members, cross-academy admins, member writes denied, academy admin edits, anonymous access');await db.close();}
main().catch(e=>{console.error(e);process.exitCode=1});
