// Run with PGLITE_MODULE_PATH pointing to a local @electric-sql/pglite install.
const { PGlite } = require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.venues (id UUID, name TEXT, contact_phone TEXT);
      GRANT SELECT (id, name) ON public.venues TO anon, authenticated;
      ALTER TABLE public.venues ADD COLUMN court_count INTEGER DEFAULT 1;
      ALTER TABLE public.venues ADD COLUMN unavailable_slots JSONB DEFAULT '[]';
      CREATE TABLE public.friendly_games (
        id UUID PRIMARY KEY, creator_id UUID NOT NULL, is_public BOOLEAN,
        invite_code TEXT UNIQUE, title TEXT
      );
      INSERT INTO public.friendly_games VALUES
        ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true, null, 'Test');
      SET ROLE authenticated;
    `);
    await assert.rejects(db.query('SELECT court_count, unavailable_slots FROM public.venues'), /permission denied/);
    await db.exec('RESET ROLE');
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261006000000_game_filters_and_visibility.sql'), 'utf8'));
    await db.exec('SET ROLE authenticated');
    await db.query('SELECT court_count, unavailable_slots FROM public.venues');
    await assert.rejects(db.query('SELECT contact_phone FROM public.venues'), /permission denied/);
    const change = (value) => db.query('SELECT public.set_friendly_game_visibility($1, $2)', ['00000000-0000-0000-0000-000000000001', value]);
    await assert.rejects(change(false), /Authentication required/);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", ['00000000-0000-0000-0000-000000000003']);
    await assert.rejects(change(false), /Only the game creator/);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", ['00000000-0000-0000-0000-000000000002']);
    await assert.rejects(change(null), /Visibility is required/);
    await change(false);
    await db.exec('RESET ROLE');
    let row = (await db.query('SELECT * FROM public.friendly_games')).rows[0];
    assert.equal(row.is_public, false);
    assert.match(row.invite_code, /^[A-F0-9]{32}$/);
    const privateCode = row.invite_code;
    await db.exec('SET ROLE authenticated');
    await change(false);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT invite_code FROM public.friendly_games')).rows[0].invite_code, privateCode);
    await db.exec('SET ROLE authenticated');
    await change(true);
    await db.exec('RESET ROLE');
    row = (await db.query('SELECT * FROM public.friendly_games')).rows[0];
    assert.equal(row.is_public, true);
    assert.equal(row.invite_code, null);
    assert.equal(row.title, 'Test');
    await db.exec('SET ROLE anon');
    await assert.rejects(change(false), /permission denied/);
    console.log('PASS: reproduced/fixed venue permissions; contacts remain private; creator-only visibility, invite generation and clearing, null rejection, anonymous denial');
  } finally { await db.close(); }
})().catch((err) => { console.error(err); process.exitCode = 1; });
