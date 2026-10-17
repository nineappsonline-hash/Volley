const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.profiles(id text, notify_game_alerts boolean, interested_sports text[]);
      INSERT INTO public.profiles VALUES ('host',true,ARRAY['Volleyball']),('follower',true,ARRAY['Volleyball']),('optout',false,ARRAY['Volleyball']),('other-sport',true,ARRAY['Padel']);
      CREATE TABLE public.notifications(recipient_id text, type text, title text, body text, link text);
      CREATE FUNCTION public.create_friendly_game(p_is_public boolean, p_sport text) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE v_member text := 'host'; v_game uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT p.id, 'game_alert', 'New game', 'Test',
    '/games'
  FROM public.profiles p
  WHERE p.id <> v_member
    AND p.notify_game_alerts = TRUE
    AND p.interested_sports @> ARRAY[btrim(p_sport)];
  RETURN v_game;
END;
$fn$;
    `);
    const definition = (await db.query("SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE proname = 'create_friendly_game'")).rows[0].definition;
    await db.exec(definition.replace('p_sport text)', 'p_sport text, p_extra integer)'));
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20270107000001_public_game_alert_links.sql'), 'utf8');
    await db.exec(migration);
    await db.query("SELECT public.create_friendly_game(false, 'Volleyball')");
    assert.equal((await db.query('SELECT * FROM notifications')).rows.length, 0, 'private games never alert sport followers');
    await db.query("SELECT public.create_friendly_game(true, 'Volleyball')");
    const rows = (await db.query('SELECT * FROM notifications')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].recipient_id, 'follower');
    assert.equal(rows[0].link, '/games/00000000-0000-0000-0000-000000000001');
    await db.query("SELECT public.create_friendly_game(false, 'Volleyball', 1)");
    assert.equal((await db.query('SELECT * FROM notifications')).rows.length, 1, 'overloads must also exclude private alerts');
    await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM notifications')).rows.length, 1, 'replaying the migration never sends alerts');
    const patched = (await db.query("SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE proname = 'create_friendly_game' AND pronargs = 2")).rows[0].definition;
    await db.exec(patched.replace("'/games/' || v_game::text", "'/unexpected'"));
    await assert.rejects(db.exec(migration), /Unexpected create_friendly_game/, 'drift guard prevents editing an unexpected version');
    console.log('PASS: notification delivery excludes private games, host, opt-outs and unrelated sports; public alerts deep-link to the game');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
