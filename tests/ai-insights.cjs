// PGlite harness for the AI Coach Assistant + Academy Insights migrations.
// Mirrors tests/qr-attendance.cjs: build a minimal stub of the pre-existing
// schema, apply the migrations under test, then exercise the RPCs end-to-end.
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.is_account_blocked() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.blocked',true),'false')='true' $$;

-- Minimum pre-existing tenant schema (subset of supabase/schema.sql).
CREATE TABLE public.academies(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, invite_code TEXT UNIQUE DEFAULT 'A', is_public BOOLEAN DEFAULT FALSE);
CREATE FUNCTION public.current_academy_id() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_academy uuid; BEGIN
    SELECT academy_id INTO v_academy FROM public.profiles WHERE id = auth.uid();
    RETURN v_academy;
  END;
$$;
CREATE TABLE public.academy_branches(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE);
CREATE TABLE public.sports(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID REFERENCES public.academies(id), name TEXT NOT NULL);
CREATE TABLE public.profiles(
  id UUID PRIMARY KEY, academy_id UUID DEFAULT public.current_academy_id(), name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE, join_date DATE DEFAULT CURRENT_DATE,
  guardian_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_sessions INTEGER NOT NULL DEFAULT 0, sessions_attended INTEGER NOT NULL DEFAULT 0,
  checkin_code TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.coaches(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id), team_id UUID, is_active BOOLEAN DEFAULT TRUE);
CREATE TABLE public.teams(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, coach_id UUID REFERENCES public.coaches(id), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.team_members(team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE, member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, PRIMARY KEY (team_id, member_id));
CREATE TABLE public.training_sessions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE, team_id UUID, date DATE NOT NULL DEFAULT CURRENT_DATE, status TEXT DEFAULT 'scheduled');
CREATE TABLE public.attendance(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE, member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, is_present BOOLEAN NOT NULL DEFAULT TRUE, marked_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (session_id, member_id));
CREATE TABLE public.payments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE, member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, amount NUMERIC(10,2) NOT NULL CHECK (amount > 0), payment_date DATE NOT NULL DEFAULT CURRENT_DATE);
CREATE TABLE public.notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id UUID NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', link TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
`;

async function main() {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(path.join(__dirname, '../supabase/migrations/20260918000000_ai_coach_assistant.sql'), 'utf8'));
  await db.exec(readFileSync(path.join(__dirname, '../supabase/migrations/20260918010000_academy_insights.sql'), 'utf8'));

  // Seed one academy: admin, coach, team + members with payment/attendance data.
  const seed = `
  INSERT INTO public.academies(id, name) VALUES ('10000000-0000-0000-0000-000000000000', 'Test Club');
  INSERT INTO public.academy_branches(id, academy_id) VALUES ('11000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000');
  INSERT INTO public.sports(id, academy_id, name) VALUES ('12000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','volleyball');
  INSERT INTO public.profiles(id, academy_id, name, role, is_active) VALUES
    ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','Owner','admin',true),
    ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','Coach A','member',true),
    ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000000','Tarek','member',true),
    ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000000','Sara','member',true),
    ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000000','Newbie','member',true);
  INSERT INTO public.coaches(id, academy_id, profile_id, is_active) VALUES
    ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000002',true);
  INSERT INTO public.teams(id, academy_id, name, coach_id) VALUES
    ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','U18 Boys','30000000-0000-0000-0000-000000000001');
  INSERT INTO public.team_members(team_id, member_id) VALUES
    ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003'),
    ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004');
  -- Recent training sessions (low / high churn fixture).
  INSERT INTO public.training_sessions(id, academy_id, team_id, date) VALUES
    ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001', CURRENT_DATE - 28),
    ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001', CURRENT_DATE - 21),
    ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001', CURRENT_DATE - 14),
    ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001', CURRENT_DATE - 7);
  INSERT INTO public.attendance(session_id, member_id, is_present) VALUES
    ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',true),
    ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003',true),
    ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003',true),
    ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',true),
    ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004',true),
    ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004',true),
    ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004',true);
  -- Payments: Tarek overdue (120d), Sara recent (10d) + previous period (45d), Newbie none.
  INSERT INTO public.payments(academy_id, member_id, amount, payment_date) VALUES
    ('10000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000003',100, CURRENT_DATE - 120),
    ('10000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000004',100, CURRENT_DATE - 45),
    ('10000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000004',50,  CURRENT_DATE - 10);
  `;
  await db.exec(seed);

  // ── 1. AI COACH: plan lifecycle ─────────────────────────────
  await db.exec(`SET test.uid='20000000-0000-0000-0000-000000000001';`); // admin

  const plan = {
    branch_id: '11000000-0000-0000-0000-000000000000',
    team_id: '40000000-0000-0000-0000-000000000001',
    sport_id: '12000000-0000-0000-0000-000000000000',
    sport: 'volleyball', title: 'Serve + receive block 1', main_objective: 'Improve serve precision',
    intensity_theme: 'moderate', session_duration_min: 90, num_players: 12, num_coaches: 2,
    skill_focus: ['serving', 'reception'],
    sections: [
      { section_type: 'warmup', title: 'Dynamic warmup', duration_min: 10, order_index: 0,
        exercises: [{ name: 'Fast feet ladder', duration_min: 5, num_players: 12, equipment: ['ladder'], ai_generated: true }] },
      { section_type: 'technical', title: 'Serve drill', duration_min: 20, order_index: 1,
        exercises: [{ name: 'Target serving', duration_min: 10, num_players: 12, equipment: ['balls'], instructions: ['aim at zones'], ai_generated: true }] },
    ],
  };
  const planId = (await db.query('SELECT public.save_ai_training_plan($1) AS id', [plan])).rows[0].id;
  assert.ok(planId);
  assert.equal((await db.query('SELECT status, version FROM public.ai_training_plans WHERE id=$1', [planId])).rows[0].status, 'draft');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ai_training_plan_sections WHERE plan_id=$1', [planId])).rows[0].n, 2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.training_exercises WHERE section_id IN (SELECT id FROM public.ai_training_plan_sections WHERE plan_id=$1)', [planId])).rows[0].n, 2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.training_plan_versions WHERE plan_id=$1', [planId])).rows[0].n, 1);

  await db.query('SELECT public.submit_ai_training_plan($1)', [planId]);
  assert.equal((await db.query('SELECT status FROM public.ai_training_plans WHERE id=$1', [planId])).rows[0].status, 'submitted');
  await db.query('SELECT public.decide_ai_training_plan($1, $2, $3)', [planId, true, 'looks good']);
  const decided = (await db.query('SELECT status, approved_by FROM public.ai_training_plans WHERE id=$1', [planId])).rows[0];
  assert.equal(decided.status, 'approved');
  assert.equal(decided.approved_by, '20000000-0000-0000-0000-000000000001');

  // Editing locked once approved.
  await assert.rejects(db.query('SELECT public.save_ai_training_plan($1)', [{ ...plan, id: planId, title: 'hacked' }]), /locked/);

  await db.query('SELECT public.toggle_ai_plan_flags($1,$2,$3)', [planId, true, true]);
  assert.equal((await db.query('SELECT is_favorite, is_template FROM public.ai_training_plans WHERE id=$1', [planId])).rows[0].is_favorite, true);
  const dupId = (await db.query('SELECT public.duplicate_ai_training_plan($1) AS id', [planId])).rows[0].id;
  assert.ok(dupId && dupId !== planId);
  assert.equal((await db.query('SELECT version, status FROM public.ai_training_plans WHERE id=$1', [dupId])).rows[0].version, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ai_training_plan_sections WHERE plan_id=$1', [dupId])).rows[0].n, 2);

  await db.query('SELECT public.assign_ai_training_plan($1,$2)', [planId, ['50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002']]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.training_plan_assignments WHERE plan_id=$1', [planId])).rows[0].n, 2);
  await db.query('SELECT public.unassign_ai_training_plan($1,$2)', [planId, '50000000-0000-0000-0000-000000000001']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.training_plan_assignments WHERE plan_id=$1', [planId])).rows[0].n, 1);

  // Report + development plan.
  const reportId = (await db.query('SELECT public.save_post_session_report($1) AS id', [{ plan_id: planId, completed: true, actual_duration_min: 85, performance_rating: 4, notes: 'Serve zone accuracy up' }])).rows[0].id;
  assert.ok(reportId);
  const devId = (await db.query('SELECT public.save_player_development_plan($1) AS id', [{
    player_id: '20000000-0000-0000-0000-000000000003', position: 'Setter', sport: 'volleyball',
    strengths: ['vision'], areas_to_improve: ['blocking'],
    short_term_goals: ['Clean sets'], long_term_goals: ['Start at U18 regionals'],
    goals: [{ title: 'Clean sets', goal_type: 'short_term', progress: 40 }],
  }])).rows[0].id;
  assert.ok(devId);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.player_development_goals WHERE plan_id=$1', [devId])).rows[0].n, 1);
  await db.query('SELECT public.decide_player_development_plan($1, TRUE)', [devId]);
  assert.equal((await db.query('SELECT status FROM public.player_development_plans WHERE id=$1', [devId])).rows[0].status, 'approved');

  // Coach scope: saved a plan only for own team; blocked for foreign team.
  await db.exec(`SET test.uid='20000000-0000-0000-0000-000000000002';`); // coach
  const coachPlanId = (await db.query('SELECT public.save_ai_training_plan($1) AS id', [plan])).rows[0].id;
  assert.ok(coachPlanId);
  await assert.rejects(db.query('SELECT public.save_ai_training_plan($1)', [{ ...plan, team_id: '99990000-0000-0000-0000-000000000000' }]), /assigned to you/);
  // Dev plans only for own players.
  await assert.rejects(db.query('SELECT public.save_player_development_plan($1)', [{ player_id: '20000000-0000-0000-0000-000000000005' }]), /your teams/);
  await db.exec(`SET test.uid='';`);
  await assert.rejects(db.query('SELECT public.save_ai_training_plan($1)', [plan]), /staff|42501/);

  // ── 2. INSIGHTS: engine, alerts, actions, settings ─────────
  await db.exec(`SET test.uid='20000000-0000-0000-0000-000000000001';`); // admin
  const result = (await db.query('SELECT public.recalculate_academy_insights_for($1) AS r', ['10000000-0000-0000-0000-000000000000'])).rows[0].r;
  assert.equal(result.ok, true);
  assert.ok(result.period);

  // Every member has a churn score; Newbie flagged not_enough_data.
  const churn = await db.query(`SELECT entity_id, score, level FROM public.prediction_scores
    WHERE academy_id='10000000-0000-0000-0000-000000000000' AND score_type='churn_risk' ORDER BY entity_id`);
  assert.equal(churn.rows.length, 4);
  assert.equal(churn.rows.filter((r) => r.level === 'not_enough_data').length, 2, 'Newbie and Coach A have no history');
  const churnCount = (a) => churn.rows.find((r) => r.entity_id === a)?.score;
  assert.ok(churnCount('20000000-0000-0000-0000-000000000003') > churnCount('20000000-0000-0000-0000-000000000004'), 'Tarek (overdue) must score higher than Sara');

  // Persisted factors make scores auditable — 4 factor rows per scored member.
  const factorCount = await db.query(`SELECT count(*)::int AS n FROM public.prediction_factors f
    JOIN public.prediction_scores s ON s.id = f.score_id
    WHERE s.score_type='churn_risk' And s.academy_id='10000000-0000-0000-0000-000000000000' AND s.level <> 'not_enough_data'`);
  assert.equal(factorCount.rows[0].n, 8);

  // Explanation contains the factor breakdown.
  const expl = (await db.query(`SELECT jsonb_array_length(explanation->'score_components')::int AS n FROM public.prediction_scores
    WHERE entity_id='20000000-0000-0000-0000-000000000003' AND score_type='churn_risk'`)).rows[0].n;
  assert.equal(expl, 4);

  // Utilization risk per team.
  const util = await db.query(`SELECT score, level FROM public.prediction_scores
    WHERE academy_id='10000000-0000-0000-0000-000000000000' AND score_type='utilization_risk' AND entity_id='40000000-0000-0000-0000-000000000001'`);
  assert.equal(util.rows.length, 1);
  assert.ok(util.rows[0].level === 'low', 'team with 7/8 attendance should be low risk');

  // Alerts: Tarek overdue; Newbie no attendance + overdue.
  const alerts = await db.query(`SELECT id, alert_type, entity_id, severity FROM public.academy_alerts WHERE academy_id='10000000-0000-0000-0000-000000000000' ORDER BY entity_id`);
  const typesFor = (id) => alerts.rows.filter((a) => a.entity_id === id).map((a) => a.alert_type).sort();
  assert.deepEqual(typesFor('20000000-0000-0000-0000-000000000003'), ['payment_overdue']);
  assert.deepEqual(typesFor('20000000-0000-0000-0000-000000000005'), ['no_attendance', 'payment_overdue']);
  // Revenue drop fired (previous period 100 vs current 50).
  assert.ok(alerts.rows.some((a) => a.alert_type === 'revenue_drop'));

  // Re-run is idempotent: no duplicate alerts, no duplicated factor rows.
  const alertCount = alerts.rows.length;
  await db.query('SELECT public.recalculate_academy_insights_for($1)', ['10000000-0000-0000-0000-000000000000']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.academy_alerts WHERE academy_id=$1', ['10000000-0000-0000-0000-000000000000'])).rows[0].n, alertCount);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.prediction_factors f
    JOIN public.prediction_scores s ON s.id=f.score_id WHERE s.score_type='churn_risk' AND s.academy_id=$1 AND s.level <> 'not_enough_data'`, ['10000000-0000-0000-0000-000000000000'])).rows[0].n, 8);

  // Action Center.
  const alertId = alerts.rows.find((a) => a.alert_type === 'payment_overdue' && a.entity_id === '20000000-0000-0000-0000-000000000003').id;
  await db.query('SELECT public.act_on_alert($1,$2,$3)', [alertId, 'acknowledged', 'will call tomorrow']);
  assert.equal((await db.query('SELECT status FROM public.academy_alerts WHERE id=$1', [alertId])).rows[0].status, 'acknowledged');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.alert_actions WHERE alert_id=$1', [alertId])).rows[0].n, 1);
  await db.query('SELECT public.act_on_alert($1,$2,$3)', [alertId, 'resolved', null]);
  assert.equal((await db.query('SELECT status, resolved_by FROM public.academy_alerts WHERE id=$1', [alertId])).rows[0].status, 'resolved');

  // Settings change the engine.
  await db.query('SELECT public.set_prediction_settings($1, $2)', [
    JSON.stringify({ payment_gap_days: 5, attendance_gap_days: 5, revenue_drop_pct: 5 }),
    JSON.stringify(['no_attendance', 'payment_overdue']),
  ]);
  await db.query('SELECT public.recalculate_academy_insights_for($1)', ['10000000-0000-0000-0000-000000000000']);
  // Sara paid 10d ago → now overdue (gap becomes 5) → revenue_drop previously disabled.
  const saraTypes = (await db.query(`SELECT alert_type FROM public.academy_alerts
    WHERE academy_id=$1 AND entity_id=$2`, ['10000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004'])).rows.map((r) => r.alert_type);
  assert.ok(saraTypes.includes('payment_overdue'), 'lower payment_gap_days should flag Sara');
  assert.ok(saraTypes.includes('no_attendance'), 'attendance_gap_days=5 also flags Sara (last attended 7d ago)');

  // Alert actions from non-staff blocked.
  await db.exec(`SET test.uid='20000000-0000-0000-0000-000000000003';`);
  await assert.rejects(db.query('SELECT public.act_on_alert($1,$2,$3)', [alertId, 'dismissed', null]), /42501|staff/);

  // Dashboard prefs upsert.
  await db.exec(`SET test.uid='20000000-0000-0000-0000-000000000001';`);
  await db.query('SELECT public.save_dashboard_preferences($1, $2, $3)', [JSON.stringify({ tab: 'retention' }), JSON.stringify(['revenue', 'churn']), JSON.stringify({})]);
  await db.query('SELECT public.save_dashboard_preferences($1, $2, $3)', [JSON.stringify({ tab: 'alerts' }), JSON.stringify(['revenue', 'churn', 'util']), JSON.stringify({})]);
  const prefs = await db.query(`SELECT user_id, academy_id, visible_kpis FROM public.dashboard_preferences
    WHERE user_id='20000000-0000-0000-0000-000000000001' AND academy_id=$1`, ['10000000-0000-0000-0000-000000000000']);
  assert.equal(prefs.rows.length, 1, 'prefs upserted, not duplicated');
  assert.equal(prefs.rows[0].visible_kpis.length, 3);

  console.log('PASS: plan lifecycle, versioning, locks, coach scoping, dev plans, reports, churn scoring + factors, utilization, dedupe, action center, settings, prefs');
  await db.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });