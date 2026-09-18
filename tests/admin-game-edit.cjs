// Run with PGLITE_PATH pointing to an installed @electric-sql/pglite package.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin', true) = 'yes' $$;
    CREATE TABLE friendly_games(id uuid PRIMARY KEY, title text, description text, sport text, game_date date, start_time time,
      duration_hours numeric, min_players integer, max_players integer, playground_id uuid, court_number integer,
      area text, location text, lat double precision, lng double precision, skill_level text, gender text, min_age integer,
      max_age integer, is_public boolean, recurrence text, playground_hourly_rate numeric, share_price numeric,
      host_pays boolean, host_total numeric, status text, invite_code text);
    CREATE TABLE friendly_game_participants(game_id uuid, member_id uuid, is_waitlisted boolean, share_amount numeric, pay_status text);
    CREATE TABLE venues(id uuid PRIMARY KEY, court_count integer);
    CREATE TABLE venue_rentals(id uuid, venue_id uuid, court_number integer, rental_date date, start_time time, hours numeric);
    CREATE TABLE notifications(recipient_id uuid, type text, title text, body text, link text);
  `);
  const courts = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260923000000_play_courts.sql'), 'utf8');
  await db.exec(courts.slice(courts.indexOf('CREATE OR REPLACE FUNCTION public.minutes_of_day'), courts.indexOf('-- Atomic booking')));
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261020000000_admin_edit_friendly_game.sql'), 'utf8'));
  const id = '00000000-0000-0000-0000-000000000010';
  const venue = '00000000-0000-0000-0000-000000000020';
  await db.exec(`INSERT INTO venues VALUES ('${venue}', 1);
    INSERT INTO friendly_games (id,title,sport,game_date,start_time,duration_hours,min_players,max_players,gender,is_public,host_pays,share_price,status,invite_code)
    VALUES ('${id}','Original','Football','2026-12-01','18:00',1,2,2,'mixed',true,false,50,'full','INVITE');
    INSERT INTO friendly_game_participants VALUES ('${id}','00000000-0000-0000-0000-000000000001',false,50,'approved'),
    ('${id}','00000000-0000-0000-0000-000000000002',false,50,'pending');`);
  const edit = changes => db.query('SELECT admin_update_friendly_game($1, $2::jsonb)', [id, JSON.stringify(changes)]);
  await assert.rejects(edit({title:'Unauthorized'}), /Only a super admin/);
  await db.exec("SET test.admin = 'yes'");
  await assert.rejects(edit({status:'cancelled'}), /Unsupported/);
  await assert.rejects(edit({max_players:1}), /Minimum players/);
  await assert.rejects(edit({duration_hours:-1}), /duration/);
  await assert.rejects(edit({min_age:40,max_age:18}), /age range/);
  await assert.rejects(edit({share_price:-1}), /Prices/);
  await assert.rejects(edit({host_pays:true,share_price:10}), /zero player share/);
  await edit({ title:'Updated', game_date:'2026-12-02', start_time:'19:00', max_players:8, playground_id:venue, court_number:null });
  let row = (await db.query('SELECT * FROM friendly_games WHERE id=$1',[id])).rows[0];
  assert.equal(row.title,'Updated'); assert.equal(row.status,'open'); assert.equal(row.court_number,1); assert.equal(row.invite_code,'INVITE');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n,2);
  assert.deepEqual((await db.query('SELECT share_amount, pay_status FROM friendly_game_participants ORDER BY member_id')).rows.map(r => [Number(r.share_amount),r.pay_status]), [[50,'approved'],[50,'pending']]);
  await db.exec(`INSERT INTO venue_rentals VALUES ('00000000-0000-0000-0000-000000000030','${venue}',1,'2026-12-03','19:00',1)`);
  await assert.rejects(edit({game_date:'2026-12-03'}), /already booked/);
  row = (await db.query('SELECT game_date::text FROM friendly_games WHERE id=$1',[id])).rows[0];
  assert.equal(row.game_date,'2026-12-02');
  await edit({max_players:2});
  assert.equal((await db.query('SELECT status FROM friendly_games WHERE id=$1',[id])).rows[0].status,'full');
  await db.close();
  console.log('PASS: admin authorization, field validation, booking conflicts, status updates, notifications, and payment preservation');
})().catch(error => { console.error(error); process.exitCode=1; });
