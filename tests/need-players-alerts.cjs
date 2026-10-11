const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,is_active boolean,notify_game_alerts boolean,interested_sports text[],skill_level text,availability_days integer[]);
 CREATE TABLE friendly_games(id uuid PRIMARY KEY,creator_id uuid,is_public boolean,status text,game_date date,start_time time,max_players integer,title text,sport text,skill_level text,invite_code text);
 CREATE TABLE friendly_game_participants(game_id uuid,member_id uuid,is_waitlisted boolean);
 CREATE TABLE blocks(blocker_id uuid,blocked_id uuid);
 CREATE TABLE notifications(recipient_id uuid,type text,title text,body text,link text);
 SET test.uid='00000000-0000-0000-0000-000000000001';
 INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,NULL FROM generate_series(1,4) n;
 INSERT INTO profiles SELECT id,'member',true,true,ARRAY['Volleyball'],NULL,ARRAY[]::integer[] FROM auth.users;
 UPDATE profiles SET notify_game_alerts=false WHERE id='00000000-0000-0000-0000-000000000004';
 INSERT INTO friendly_games VALUES('10000000-0000-0000-0000-000000000001',auth.uid(),true,'open',current_date+1,'18:00',3,'Evening game','Volleyball',NULL,'JOINME');
 INSERT INTO friendly_game_participants VALUES('10000000-0000-0000-0000-000000000001',auth.uid(),false),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',true);`);
 await db.exec(fs.readFileSync('supabase/migrations/20270106000000_need_players_alerts.sql','utf8'));
 const call = () => db.query("SELECT request_game_players('10000000-0000-0000-0000-000000000001') AS sent");
 assert.equal((await call()).rows[0].sent,1);
 const alert = (await db.query('SELECT * FROM notifications')).rows[0];
 assert.equal(alert.title,'We need 2 more players');
 assert.equal(alert.link,'/dashboard/games?join=JOINME');
 await assert.rejects(call(),/once every 24 hours/);
 await db.exec("SET test.uid='00000000-0000-0000-0000-000000000002'");
 await assert.rejects(call(),/Only the organizer/);
 await db.exec("SET test.uid='00000000-0000-0000-0000-000000000001'; UPDATE friendly_games SET is_public=false");
 await assert.rejects(call(),/upcoming public open/);
 await db.exec("UPDATE friendly_games SET is_public=true,max_players=1");
 await assert.rejects(call(),/full/);
 await db.exec("UPDATE friendly_games SET max_players=3; DELETE FROM game_recruitment_alerts; INSERT INTO blocks VALUES('00000000-0000-0000-0000-000000000002',auth.uid())");
 assert.equal((await call()).rows[0].sent,0);
 assert.equal((await db.query('SELECT * FROM game_recruitment_alerts')).rows.length,0);
 console.log('PASS: matching opted-in recipients, spot count, participant exclusions, cooldown, organizer authorization, private/full rejection, blocks, zero-recipient retry');
 } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
