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
      CREATE TABLE public.friendly_games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID,
        creator_name TEXT,
        creator_nickname TEXT,
        sport TEXT,
        title TEXT,
        description TEXT,
        area TEXT,
        location TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        game_date DATE,
        start_time TIME,
        max_players INTEGER,
        min_players INTEGER,
        duration_hours NUMERIC,
        playground_hourly_rate NUMERIC,
        share_price NUMERIC,
        skill_level TEXT,
        is_public BOOLEAN,
        status TEXT,
        source_game_id UUID,
        recurrence TEXT,
        playground_id UUID,
        court_number INTEGER,
        host_pays BOOLEAN,
        host_total NUMERIC,
        invite_code TEXT UNIQUE
      );
      CREATE TABLE public.friendly_game_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES public.friendly_games(id),
        member_id UUID,
        role TEXT,
        player_name TEXT,
        is_waitlisted BOOLEAN DEFAULT false,
        share_amount NUMERIC,
        pay_status TEXT
      );
      -- Parent weekly game with a code, as created by create_friendly_game.
      INSERT INTO public.friendly_games
        (id, creator_id, game_date, start_time, max_players, min_players, duration_hours,
         is_public, status, recurrence, invite_code)
      VALUES
        ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
         CURRENT_DATE - 7, '18:00', 12, 2, 1, true, 'open', 'weekly', 'ABC123');
      INSERT INTO public.friendly_game_participants (game_id, member_id, role, player_name, is_waitlisted)
      VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
              'organizer', 'Organizer', false),
             ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
              'player', 'Player', true);
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261119000000_materialized_games_invite_codes.sql'), 'utf8');
    await db.exec(migration);

    // Weekly instances are created and each gets its own unique invite code.
    await db.query('SELECT public.materialize_recurring_games()');
    const instances = (await db.query(
      `SELECT id, invite_code, game_date FROM public.friendly_games WHERE source_game_id = '00000000-0000-0000-0000-000000000001' ORDER BY game_date`
    )).rows;
    assert.ok(instances.length >= 8, 'a weekly series should materialize several instances, got ' + instances.length);
    for (const inst of instances) {
      assert.match(inst.invite_code, /^[A-Z0-9]{6}$/, 'every instance must have its own code');
      assert.notEqual(inst.invite_code, 'ABC123', 'code must differ from the parent code');
    }
    // Distinct from every other game's code (unique index also enforces this).
    const distinct = (await db.query(
      'SELECT COUNT(DISTINCT invite_code) AS n, COUNT(*) AS total FROM public.friendly_games WHERE invite_code IS NOT NULL'
    )).rows[0];
    assert.equal(Number(distinct.n), Number(distinct.total), 'codes must be unique across games');

    // Roster carry-over still works (waitlisted players are skipped).
    const rosterCounts = (await db.query(
      `SELECT game_id, COUNT(*) FILTER (WHERE NOT is_waitlisted) AS confirmed,
              COUNT(*) FILTER (WHERE is_waitlisted) AS waitlisted
       FROM public.friendly_game_participants
       WHERE game_id = ANY($1::uuid[]) GROUP BY game_id`, [instances.map((i) => i.id)]
    )).rows;
    assert.ok(rosterCounts.length >= 1, 'roster carried over to instances');
    for (const r of rosterCounts) {
      assert.equal(Number(r.confirmed), 1, 'only the confirmed organizer carries over');
      assert.equal(Number(r.waitlisted), 0, 'waitlisted players must not carry over');
    }

    // Host-pays branch still applies the host_total to the organizer share.
    await db.exec(`UPDATE public.friendly_games SET host_pays = true, host_total = 400 WHERE id = '00000000-0000-0000-0000-000000000001'`);
    await db.query(`DELETE FROM public.friendly_game_participants WHERE game_id = ANY($1::uuid[])`, [instances.map((i) => i.id)]);
    await db.query(`DELETE FROM public.friendly_games WHERE id = ANY($1::uuid[])`, [instances.map((i) => i.id)]);
    await db.query('SELECT public.materialize_recurring_games()');
    const recreated = (await db.query(
      `SELECT id, invite_code FROM public.friendly_games WHERE source_game_id = '00000000-0000-0000-0000-000000000001'`
    )).rows;
    assert.equal(recreated.length, instances.length, 're-materialization recreates the series');
    const hostOrganizer = (await db.query(
      `SELECT share_amount, pay_status FROM public.friendly_game_participants
       WHERE role = 'organizer' AND game_id = $1`, [recreated[0].id]
    )).rows[0];
    assert.equal(Number(hostOrganizer.share_amount), 400);
    assert.equal(hostOrganizer.pay_status, 'unpaid');
    for (const inst of recreated) {
      assert.match(inst.invite_code, /^[A-Z0-9]{6}$/, 'recreated instances also get unique codes');
    }

    // Backfill: a game inserted without a code gets one.
    await db.exec(`
      INSERT INTO public.friendly_games
        (id, creator_id, game_date, start_time, max_players, min_players, duration_hours,
         is_public, status, recurrence, invite_code)
      VALUES
        ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002',
         CURRENT_DATE + 1, '19:00', 10, 2, 1, true, 'open', null, null);
    `);
    await db.exec(migration);
    const backfilled = (await db.query(
      `SELECT invite_code FROM public.friendly_games WHERE id = '00000000-0000-0000-0000-000000000009'`
    )).rows[0].invite_code;
    assert.match(backfilled, /^[A-Z0-9]{6}$/, 'backfill must assign a unique code');

    // Migration is idempotent (re-run does not duplicate or change codes).
    const before = (await db.query(`SELECT id, invite_code FROM public.friendly_games ORDER BY id`)).rows;
    await db.exec(migration);
    const after = (await db.query(`SELECT id, invite_code FROM public.friendly_games ORDER BY id`)).rows;
    assert.deepEqual(after, before, 're-running the migration must not change codes');

    console.log('PASS: weekly instances mint unique invite codes, roster carry-over and host-pays intact, backfill assigns codes, migration is idempotent');
  } finally { await db.close(); }
})().catch((err) => { console.error(err); process.exitCode = 1; });
