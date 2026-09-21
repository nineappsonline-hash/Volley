const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$
        SELECT jsonb_build_object('app_metadata', jsonb_build_object('role', current_setting('test.role')))
      $$;
      CREATE FUNCTION public.current_academy_id() RETURNS uuid LANGUAGE sql AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::uuid
      $$;
      CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$
        SELECT current_setting('test.role') = 'super_admin'
      $$;
      CREATE TABLE academies(id uuid PRIMARY KEY, plan text);
      INSERT INTO academies VALUES(current_academy_id(), 'starter');
      CREATE TABLE tournaments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid REFERENCES academies(id));
      CREATE TABLE tournament_matches(id uuid, tournament_id uuid);
      ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT ON academies TO authenticated;
      GRANT ALL ON tournaments TO authenticated;
      SET test.role = 'admin';
    `);
    const visibility = fs.readFileSync('supabase/migrations/20261003000000_tournament_visibility.sql', 'utf8');
    await db.exec(visibility.slice(0, visibility.indexOf('-- 5. Announce')));
    await db.exec(fs.readFileSync('supabase/migrations/20261005000000_tournament_plan_gate.sql', 'utf8'));
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.exec('INSERT INTO tournaments(academy_id) VALUES(current_academy_id())'), /Plus or Enterprise/);
    await db.exec('RESET ROLE');
    const migration = fs.readFileSync('supabase/migrations/20261129000000_tournaments_all_plans.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    for (const plan of ['starter', 'plus', 'elite']) {
      await db.query('UPDATE academies SET plan = $1', [plan]);
      await db.exec("SET ROLE authenticated; SET test.role = 'admin'");
      await db.exec('INSERT INTO tournaments(academy_id) VALUES(current_academy_id())');
      await assert.rejects(db.exec('INSERT INTO tournaments(academy_id) VALUES(NULL)'), /row-level security/);
      await db.exec('RESET ROLE');
    }
    await db.exec("SET ROLE authenticated; SET test.role = 'member'");
    assert.equal((await db.query('SELECT * FROM tournaments')).rows.length, 3);
    await assert.rejects(db.exec('INSERT INTO tournaments(academy_id) VALUES(current_academy_id())'), /row-level security/);
    assert.equal((await db.query('DELETE FROM tournaments RETURNING id')).rows.length, 0);
    await db.exec("SET test.role = 'super_admin'");
    await db.exec('INSERT INTO tournaments(academy_id) VALUES(NULL)');
    console.log('PASS: all academy plans can organize; members can browse; organizer permissions preserved; migration is repeatable');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
