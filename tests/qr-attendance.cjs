const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
async function main() {
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.is_account_blocked() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.blocked',true),'false')='true' $$;
CREATE TABLE profiles(id uuid PRIMARY KEY, academy_id uuid, role text, name text, is_active boolean DEFAULT true, checkin_code text);
CREATE TABLE training_sessions(id uuid PRIMARY KEY, academy_id uuid, status text);
CREATE TABLE attendance(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,session_id uuid,member_id uuid,is_present boolean,marked_at timestamptz DEFAULT now(),UNIQUE(session_id,member_id));
CREATE TABLE member_badges(member_id uuid,badge_type text,badge_name text,description text,icon text,UNIQUE(member_id,badge_type));
CREATE TABLE activity_feed(academy_id uuid, member_id uuid,activity_type text,description text,metadata jsonb);
INSERT INTO profiles VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','admin','Admin',true,NULL),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','member','Child',true,'ABCD1234'),('00000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000000','member','Other',true,'OTHER123');
INSERT INTO training_sessions VALUES ('30000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','scheduled');`);
const migration=readFileSync(require('node:path').join(__dirname, '../supabase/migrations/20260908190000_qr_attendance.sql'),'utf8');
await db.exec(migration);await db.exec(migration);
await db.exec(`CREATE TRIGGER badges AFTER INSERT OR UPDATE ON attendance FOR EACH ROW WHEN (NEW.is_present=true) EXECUTE FUNCTION check_and_award_badges(); SET test.uid='00000000-0000-0000-0000-000000000001';`);
const scan=async(code='ABCD1234')=>(await db.query(`SELECT check_in_member('30000000-0000-0000-0000-000000000000',$1) AS result`,[code])).rows[0].result;
assert.equal((await scan(' abcd1234 ')).already_present,false);
assert.equal((await scan()).already_present,true);
assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance')).rows[0].n,1);
assert.equal((await db.query('SELECT count(*)::int AS n FROM member_badges')).rows[0].n,1);
assert.equal((await db.query('SELECT count(*)::int AS n FROM activity_feed')).rows[0].n,1);
await assert.rejects(scan('OTHER123'));
await assert.rejects(scan('INVALID1'));
await db.exec(`UPDATE attendance SET is_present=false;`); assert.equal((await scan()).already_present,false);
await db.exec(`UPDATE profiles SET is_active=false WHERE name='Child';`);await assert.rejects(scan());
await db.exec(`UPDATE profiles SET is_active=true; UPDATE training_sessions SET status='canceled';`);await assert.rejects(scan());
await db.exec(`UPDATE training_sessions SET status='scheduled'; SET test.uid='00000000-0000-0000-0000-000000000002';`);await assert.rejects(scan());
await db.exec(`SET test.uid='';`);await assert.rejects(scan());
await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000001'; SET test.blocked='true';`);await assert.rejects(scan());
console.log('PASS: rerun, normalized QR, first/repeat attendance, absent-to-present, unique badge/activity, cross-academy, invalid, inactive, canceled, member, anonymous, blocked');
await db.close();

}
main().catch(error => { console.error(error); process.exitCode = 1; });
