-- ────────────────────────────────────────────────────────────
-- ACADEMY INSIGHTS & PREDICTION DASHBOARD
-- Transparent, rules-based predictions and smart alerts.
-- Every score is decomposed into stored factors (predictable,
-- explained, auditable). A SQL SECURITY DEFINER engine recomputes
-- snapshot scores + alerts; the UI only ever reads results.
--
-- Security model:
--   * admins (owners) see the full academy picture.
--   * coaches (profiles linked to staff records) see only their teams.
-- Mutations run through SECURITY DEFINER RPCs.
-- ────────────────────────────────────────────────────────────

-- ── 1. PREDICTION SETTINGS ──────────────────────────────────

-- Per-academy, configurable thresholds + which alert types are enabled.
--   thresholds: {"payment_gap_days":90,"attendance_gap_days":30,
--                "utilization_low_pct":30,"revenue_drop_pct":20,
--                "churn_high":70,"churn_medium":40}
--   enabled_alerts: [] means all enabled; else a subset like
--                ["no_attendance","payment_overdue","utilization_low"]
CREATE TABLE IF NOT EXISTS public.prediction_settings (
  academy_id UUID PRIMARY KEY REFERENCES public.academies(id) ON DELETE CASCADE,
  thresholds JSONB NOT NULL DEFAULT '{
    "payment_gap_days": 90,
    "attendance_gap_days": 30,
    "utilization_low_pct": 30,
    "revenue_drop_pct": 20,
    "churn_high": 70,
    "churn_medium": 40
  }',
  enabled_alerts JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.prediction_settings ENABLE ROW LEVEL SECURITY;

-- ── 2. SNAPSHOT INSIGHTS ────────────────────────────────────

-- Period snapshots of academy KPIs (computed by the engine).
CREATE TABLE IF NOT EXISTS public.academy_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  -- ISO period key, e.g. '2026-W38' or '2026-09'.
  period_key TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academy_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_academy_insights_academy
  ON public.academy_insights(academy_id, period_key DESC);
ALTER TABLE public.academy_insights ENABLE ROW LEVEL SECURITY;

-- ── 3. PREDICTION SCORES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prediction_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('member', 'team', 'academy')),
  entity_id UUID NOT NULL,
  score_type TEXT NOT NULL CHECK (score_type IN (
    'churn_risk',
    'attendance_risk',
    'utilization_risk',
    'revenue_forecast',
    'enrollment_forecast'
  )),
  -- 0..100 risk/health score. NULL when there is not enough data.
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  level TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high', 'not_enough_data')),
  -- Transparent driver summary ({thresholds applied, headline reasons}).
  explanation JSONB NOT NULL DEFAULT '{}',
  model_version TEXT NOT NULL DEFAULT 'rules-v1',
  period_key TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academy_id, entity_type, entity_id, score_type, period_key)
);
CREATE INDEX IF NOT EXISTS idx_pred_scores_academy
  ON public.prediction_scores(academy_id, score_type, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pred_scores_entity
  ON public.prediction_scores(entity_type, entity_id);
ALTER TABLE public.prediction_scores ENABLE ROW LEVEL SECURITY;

-- Individual factors that explain a score (audit trail / transparency).
CREATE TABLE IF NOT EXISTS public.prediction_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID NOT NULL REFERENCES public.prediction_scores(id) ON DELETE CASCADE,
  factor_key TEXT NOT NULL,
  factor_label TEXT NOT NULL,
  -- positive pushes the score UP (more risk), negative DOWN.
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative', 'neutral')),
  weight NUMERIC NOT NULL DEFAULT 1,
  contribution NUMERIC NOT NULL DEFAULT 0,
  -- snapshot of the raw data that produced this factor.
  data_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pred_factors_score
  ON public.prediction_factors(score_id);
ALTER TABLE public.prediction_factors ENABLE ROW LEVEL SECURITY;

-- ── 4. SMART ALERTS + ACTION CENTER ─────────────────────────

CREATE TABLE IF NOT EXISTS public.academy_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'no_attendance',
    'payment_overdue',
    'retention_trajectory',
    'utilization_low',
    'revenue_drop',
    'enrollment_decline'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('member', 'team', 'academy')),
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
  -- prevent duplicates while an alert is still open
  dedupe_key TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_dedupe
  ON public.academy_alerts(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_alerts_academy_status
  ON public.academy_alerts(academy_id, status, severity DESC, created_at DESC);
ALTER TABLE public.academy_alerts ENABLE ROW LEVEL SECURITY;

-- Audit trail of every action taken on an alert.
CREATE TABLE IF NOT EXISTS public.alert_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.academy_alerts(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'acknowledged', 'assigned', 'in_progress', 'contacted',
    'resolved', 'dismissed', 'note'
  )),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_actions_alert
  ON public.alert_actions(alert_id, created_at DESC);
ALTER TABLE public.alert_actions ENABLE ROW LEVEL SECURITY;

-- Per-user dashboard preferences (filters, KPIs, chart prefs).
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  default_filters JSONB NOT NULL DEFAULT '{}',
  visible_kpis JSONB NOT NULL DEFAULT '[]',
  chart_prefs JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, academy_id)
);
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- ── 5. ACCESS HELPERS ───────────────────────────────────────

-- Insights visible to staff (admins fully; coaches only their teams).
-- Returns TRUE when the authenticated user may read academy-scoped insights.
CREATE OR REPLACE FUNCTION public.can_read_academy_insights()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_academy_staff();
$$;
GRANT EXECUTE ON FUNCTION public.can_read_academy_insights() TO authenticated;

-- ── 6. ROW LEVEL SECURITY ───────────────────────────────────

DROP POLICY IF EXISTS "Insights settings staff" ON public.prediction_settings;
CREATE POLICY "Insights settings staff" ON public.prediction_settings
  FOR SELECT TO authenticated USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_staff()
  );

DROP POLICY IF EXISTS "Insights snapshot staff" ON public.academy_insights;
CREATE POLICY "Insights snapshot staff" ON public.academy_insights
  FOR SELECT TO authenticated USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_staff()
  );

DROP POLICY IF EXISTS "Scores staff" ON public.prediction_scores;
CREATE POLICY "Scores staff" ON public.prediction_scores
  FOR SELECT TO authenticated USING (
    academy_id = public.current_academy_id()
    AND (
      public.is_academy_admin()
      OR (entity_type = 'team' AND entity_id = ANY (public.current_coach_team_ids()))
      OR (entity_type = 'member' AND entity_id = ANY (public.current_coach_player_ids()))
    )
  );

DROP POLICY IF EXISTS "Factors staff" ON public.prediction_factors;
CREATE POLICY "Factors staff" ON public.prediction_factors
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.prediction_scores s
      WHERE s.id = score_id
        AND s.academy_id = public.current_academy_id()
        AND (
          public.is_academy_admin()
          OR (s.entity_type = 'team' AND s.entity_id = ANY (public.current_coach_team_ids()))
          OR (s.entity_type = 'member' AND s.entity_id = ANY (public.current_coach_player_ids()))
        )
    )
  );

DROP POLICY IF EXISTS "Alerts staff" ON public.academy_alerts;
CREATE POLICY "Alerts staff" ON public.academy_alerts
  FOR SELECT TO authenticated USING (
    academy_id = public.current_academy_id()
    AND (
      public.is_academy_admin()
      OR (entity_type = 'team' AND entity_id = ANY (public.current_coach_team_ids()))
      OR (entity_type = 'member' AND entity_id = ANY (public.current_coach_player_ids()))
    )
  );

DROP POLICY IF EXISTS "Alerts admin write" ON public.academy_alerts;
CREATE POLICY "Alerts admin write" ON public.academy_alerts
  FOR UPDATE TO authenticated USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_staff()
  );

DROP POLICY IF EXISTS "Alert actions staff" ON public.alert_actions;
CREATE POLICY "Alert actions staff" ON public.alert_actions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.academy_alerts a
      WHERE a.id = alert_id
        AND a.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Dashboard prefs own" ON public.dashboard_preferences;
CREATE POLICY "Dashboard prefs own" ON public.dashboard_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 7. RULES-BASED ENGINE ───────────────────────────────────
-- Transparent, deterministic, auditable. Recompute for one academy.
-- Safe to re-run: upserts scores/snapshots and creates alerts only when a
-- dedupe key is new (never deletes or fabricates data).

CREATE OR REPLACE FUNCTION public.recalculate_academy_insights_for(p_academy_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE := (NOW() - INTERVAL '90 days')::DATE;
  v_period_key TEXT := to_char(CURRENT_DATE, 'IYYY-"W"IW');
  v_row RECORD;
  v_settings JSONB;
  v_enabled JSONB;
  v_threshold JSONB;
  v_gap_days INTEGER := 90;
  v_att_gap INTEGER := 30;
  v_util_low NUMERIC := 30;
  v_rev_drop NUMERIC := 20;
  v_churn_high NUMERIC := 70;
  v_churn_med NUMERIC := 40;
  v_score INTEGER;
  v_level TEXT;
  v_att_rate NUMERIC;
  v_recent_rate NUMERIC;
  v_baseline_rate NUMERIC;
  v_summary JSONB := '{}'::JSONB;
  v_forecast_active INTEGER;
  v_expected_paying INTEGER;
  v_expected_revenue NUMERIC;
  v_alert_count INTEGER := 0;
  v_severity TEXT;
  v_alert_type TEXT;
  v_entity_type TEXT;
  v_entity_id UUID;
  v_title TEXT;
  v_body TEXT;
  v_recommend TEXT;
  v_utilization NUMERIC;
  v_growth NUMERIC;
BEGIN
  SELECT thresholds, enabled_alerts INTO v_threshold, v_enabled
    FROM public.prediction_settings WHERE academy_id = p_academy_id;
  IF v_threshold IS NULL THEN
    INSERT INTO public.prediction_settings (academy_id)
    VALUES (p_academy_id)
    RETURNING thresholds INTO v_threshold;
    v_enabled := '[]';
  END IF;
  v_gap_days  := COALESCE((v_threshold ->> 'payment_gap_days')::INTEGER, 90);
  v_att_gap   := COALESCE((v_threshold ->> 'attendance_gap_days')::INTEGER, 30);
  v_util_low  := COALESCE((v_threshold ->> 'utilization_low_pct')::NUMERIC, 30);
  v_rev_drop  := COALESCE((v_threshold ->> 'revenue_drop_pct')::NUMERIC, 20);
  v_churn_high:= COALESCE((v_threshold ->> 'churn_high')::NUMERIC, 70);
  v_churn_med := COALESCE((v_threshold ->> 'churn_medium')::NUMERIC, 40);
  IF v_enabled IS NULL OR jsonb_typeof(v_enabled) <> 'array'
     OR jsonb_array_length(v_enabled) = 0 THEN
    v_enabled := '["no_attendance","payment_overdue","retention_trajectory","utilization_low","revenue_drop","enrollment_decline"]';
  END IF;

  -- ── Per member churn / retention ──────────────────────────
  -- Churn scores are computed in bulk (DRY) and every persisted score carries
  -- an auditable factor breakdown. A temp table keeps both statements in sync.
  DROP TABLE IF EXISTS _churn_stats;
  CREATE TEMP TABLE _churn_stats AS
    WITH stats AS (
      SELECT
        m.id AS member_id,
        m.subscription_sessions,
        COALESCE(m.sessions_attended, 0) AS sessions_attended,
        (SELECT MAX(p.payment_date) FROM public.payments p WHERE p.member_id = m.id) AS last_payment,
        (SELECT COUNT(*) FROM public.payments p
          WHERE p.member_id = m.id AND p.payment_date >= v_period_start) AS payments_90d,
        (SELECT COUNT(*) FROM public.attendance a
          JOIN public.training_sessions s ON s.id = a.session_id
          WHERE a.member_id = m.id AND a.is_present AND s.academy_id = p_academy_id) AS att_total,
        (
          (SELECT COUNT(*) FROM public.payments p WHERE p.member_id = m.id) > 0
          OR
          (SELECT COUNT(*) FROM public.attendance a
            JOIN public.training_sessions s ON s.id = a.session_id
            WHERE a.member_id = m.id AND s.academy_id = p_academy_id) > 0
        ) AS has_history,
        (SELECT COUNT(*) FROM public.attendance a
          JOIN public.training_sessions s ON s.id = a.session_id
          WHERE a.member_id = m.id AND a.is_present AND s.academy_id = p_academy_id
            AND s.date >= CURRENT_DATE - 30)::NUMERIC
          / NULLIF((SELECT COUNT(DISTINCT s.id) FROM public.training_sessions s
            WHERE s.academy_id = p_academy_id AND s.date >= CURRENT_DATE - 30), 0) AS att_rate_30d,
        (SELECT COUNT(*) FROM public.attendance a
          JOIN public.training_sessions s ON s.id = a.session_id
          WHERE a.member_id = m.id AND a.is_present AND s.academy_id = p_academy_id
            AND s.date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE)::NUMERIC
          / NULLIF((SELECT COUNT(DISTINCT s.id) FROM public.training_sessions s
            WHERE s.academy_id = p_academy_id AND s.date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE), 0) AS recent_rate,
        (SELECT COUNT(*) FROM public.attendance a
          JOIN public.training_sessions s ON s.id = a.session_id
          WHERE a.member_id = m.id AND a.is_present AND s.academy_id = p_academy_id
            AND s.date BETWEEN CURRENT_DATE - 46 AND CURRENT_DATE - 15)::NUMERIC
          / NULLIF((SELECT COUNT(DISTINCT s.id) FROM public.training_sessions s
            WHERE s.academy_id = p_academy_id AND s.date BETWEEN CURRENT_DATE - 46 AND CURRENT_DATE - 15), 0) AS baseline_rate
      FROM public.profiles m
      WHERE m.academy_id = p_academy_id AND m.role = 'member' AND m.is_active
    )
    SELECT
      member_id,
      CASE WHEN has_history IS NOT TRUE THEN NULL ELSE LEAST(100, GREATEST(0,
        round(0.35 * CASE WHEN last_payment IS NULL THEN 100 ELSE LEAST(100, ((CURRENT_DATE - last_payment)::NUMERIC / v_gap_days) * 100) END)
      + round(0.30 * (100 - COALESCE(att_rate_30d, 0) * 100))
      + round(0.20 * LEAST(50, GREATEST(-50, (COALESCE(baseline_rate,0) - COALESCE(recent_rate,0)) * 150)))
      + round(0.15 * CASE WHEN COALESCE(subscription_sessions,0) > 0
           THEN LEAST(100, GREATEST(0, (COALESCE(sessions_attended,0))::NUMERIC / subscription_sessions * 100 - 50))
           ELSE 0 END)))::INTEGER END AS score,
      COALESCE(att_rate_30d, 0) AS att_rate_30d,
      COALESCE(recent_rate, 0) AS recent_rate,
      COALESCE(baseline_rate, 0) AS baseline_rate,
      last_payment,
      sessions_attended,
      subscription_sessions
    FROM stats;

  INSERT INTO public.prediction_scores
    (academy_id, entity_type, entity_id, score_type, score, level, explanation, model_version, period_key)
  SELECT
    p_academy_id, 'member', c.member_id, 'churn_risk', c.score,
    CASE WHEN c.score IS NULL THEN 'not_enough_data'
         WHEN c.score >= v_churn_high THEN 'high'
         WHEN c.score >= v_churn_med THEN 'medium'
         ELSE 'low' END,
    jsonb_build_object(
      'headline', 'Based on payment recency, recent attendance and subscription usage',
      'score_components', jsonb_build_array(
        jsonb_build_object('factor', 'payment_recency', 'label', 'Payment recency', 'weight', 0.35,
          'contribution', GREATEST(0, LEAST(100, round(CASE WHEN c.last_payment IS NULL THEN 100 ELSE ((CURRENT_DATE - c.last_payment)::NUMERIC / v_gap_days) * 100 END)))),
        jsonb_build_object('factor', 'attendance_recent', 'label', 'Attendance last 30 days', 'weight', 0.30,
          'contribution', GREATEST(0, LEAST(100, round((100 - c.att_rate_30d * 100))))),
        jsonb_build_object('factor', 'attendance_trend', 'label', 'Attendance trend', 'weight', 0.20,
          'contribution', GREATEST(0, LEAST(50, round((c.baseline_rate - c.recent_rate) * 150)))),
        jsonb_build_object('factor', 'subscription_utilization', 'label', 'Subscription usage', 'weight', 0.15,
          'contribution', CASE WHEN c.subscription_sessions > 0 THEN GREATEST(0, LEAST(100, round((c.sessions_attended::NUMERIC / c.subscription_sessions) * 100 - 50))) ELSE 0 END)
      )
    ),
    'rules-v1', v_period_key
  FROM _churn_stats c
  ON CONFLICT (academy_id, entity_type, entity_id, score_type, period_key)
  DO UPDATE SET score = EXCLUDED.score, level = EXCLUDED.level,
    explanation = EXCLUDED.explanation, model_version = 'rules-v1', computed_at = NOW();

  -- Persist the auditable factor rows for this period's churn scores.
  DELETE FROM public.prediction_factors
  WHERE score_id IN (
    SELECT id FROM public.prediction_scores
    WHERE academy_id = p_academy_id AND score_type = 'churn_risk' AND period_key = v_period_key
  );
  INSERT INTO public.prediction_factors (score_id, factor_key, factor_label, direction, weight, contribution, data_snapshot)
  SELECT
    s.id,
    c.factor_key,
    c.factor_label,
    CASE WHEN c.contribution >= v_churn_med THEN 'negative'
         WHEN c.contribution > 0 THEN 'neutral' ELSE 'positive' END,
    c.weight,
    c.contribution,
    c.data_snapshot
  FROM public.prediction_scores s
  JOIN (
    SELECT
      so.member_id, 'payment_recency' AS factor_key, 'Payment recency' AS factor_label, 0.35 AS weight,
      GREATEST(0, LEAST(100, round(CASE WHEN so.last_payment IS NULL THEN 100 ELSE ((CURRENT_DATE - so.last_payment)::NUMERIC / v_gap_days) * 100 END))) AS contribution,
      jsonb_build_object('days_since_last_payment', CASE WHEN so.last_payment IS NULL THEN NULL ELSE CURRENT_DATE - so.last_payment END, 'threshold_days', v_gap_days) AS data_snapshot
    FROM _churn_stats so
    UNION ALL
    SELECT so.member_id, 'attendance_recent', 'Attendance last 30 days', 0.30,
      GREATEST(0, LEAST(100, round((100 - so.att_rate_30d * 100)))),
      jsonb_build_object('attendance_rate_30d', round(so.att_rate_30d::NUMERIC, 3))
    FROM _churn_stats so
    UNION ALL
    SELECT so.member_id, 'attendance_trend', 'Attendance trend', 0.20,
      GREATEST(0, LEAST(50, round((so.baseline_rate - so.recent_rate) * 150))),
      jsonb_build_object('recent_rate', round(so.recent_rate::NUMERIC, 3), 'baseline_rate', round(so.baseline_rate::NUMERIC, 3))
    FROM _churn_stats so
    UNION ALL
    SELECT so.member_id, 'subscription_utilization', 'Subscription usage', 0.15,
      CASE WHEN so.subscription_sessions > 0 THEN GREATEST(0, LEAST(100, round((so.sessions_attended::NUMERIC / so.subscription_sessions) * 100 - 50))) ELSE 0 END,
      jsonb_build_object('sessions_attended', so.sessions_attended, 'subscription_sessions', so.subscription_sessions)
    FROM _churn_stats so
  ) c ON c.member_id = s.entity_id
  WHERE s.academy_id = p_academy_id AND s.score_type = 'churn_risk'
    AND s.period_key = v_period_key AND s.level <> 'not_enough_data';

  DROP TABLE _churn_stats;

  v_forecast_active := 0;
  v_expected_paying := 0;
  v_expected_revenue := 0;

  FOR v_row IN
    SELECT s.entity_id, s.score, s.level,
      COALESCE((SELECT AVG(p.amount) FROM public.payments p
        WHERE p.member_id = s.entity_id AND p.payment_date >= v_period_start), 0) AS avg_spend
    FROM public.prediction_scores s
    WHERE s.academy_id = p_academy_id AND s.score_type = 'churn_risk'
      AND s.period_key = v_period_key
  LOOP
    IF v_row.level <> 'not_enough_data' THEN
      v_expected_paying := v_expected_paying + 1;
      v_expected_revenue := v_expected_revenue + (v_row.avg_spend * (1 - COALESCE(v_row.score, 50) / 100.0));
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_forecast_active
    FROM public.profiles WHERE academy_id = p_academy_id AND is_active;

  -- ── Team utilization ──────────────────────────────────────
  FOR v_row IN
    SELECT t.id AS team_id
    FROM public.teams t WHERE t.academy_id = p_academy_id
  LOOP
    SELECT
      COALESCE((SELECT COUNT(*) FROM public.attendance a
        JOIN public.team_members tm ON tm.member_id = a.member_id
        JOIN public.training_sessions s ON s.id = a.session_id
        WHERE tm.team_id = v_row.team_id AND a.is_present AND s.academy_id = p_academy_id
          AND s.date >= CURRENT_DATE - 45), 0)::NUMERIC
      / NULLIF((SELECT COUNT(*) FROM public.team_members tm WHERE tm.team_id = v_row.team_id)
          * (SELECT COUNT(DISTINCT s.id) FROM public.training_sessions s
             WHERE s.academy_id = p_academy_id AND s.date >= CURRENT_DATE - 45), 0)
      * 100 INTO v_utilization;
    v_utilization := COALESCE(v_utilization, 0);

    INSERT INTO public.prediction_scores
      (academy_id, entity_type, entity_id, score_type, score, level, explanation, period_key)
    VALUES (p_academy_id, 'team', v_row.team_id, 'utilization_risk',
      LEAST(100, GREATEST(0, round(100 - v_utilization))::INTEGER),
      CASE WHEN v_utilization >= 100 - v_util_low THEN 'low'
           WHEN v_utilization >= 100 - (v_util_low * 2) THEN 'medium' ELSE 'high' END,
      jsonb_build_object('utilization_pct', round(v_utilization::NUMERIC, 1),
                         'threshold_low_pct', v_util_low),
      v_period_key)
    ON CONFLICT (academy_id, entity_type, entity_id, score_type, period_key)
    DO UPDATE SET score = EXCLUDED.score, level = EXCLUDED.level,
      explanation = EXCLUDED.explanation, computed_at = NOW();
  END LOOP;

  -- ── Revenue & enrollment forecasts ────────────────────────
  INSERT INTO public.academy_insights (academy_id, period_key, metrics)
  VALUES (p_academy_id, v_period_key, jsonb_build_object(
    'active_members', v_forecast_active,
    'expected_paying_members', v_expected_paying,
    'expected_revenue_next', round(v_expected_revenue::NUMERIC, 2),
    'model_version', 'rules-v1'
  ))
  ON CONFLICT (academy_id, period_key) DO UPDATE
    SET metrics = jsonb_build_object(
      'active_members', v_forecast_active,
      'expected_paying_members', v_expected_paying,
      'expected_revenue_next', round(v_expected_revenue::NUMERIC, 2),
      'model_version', 'rules-v1'
    ), computed_at = NOW();

  -- ── Alerts ────────────────────────────────────────────────
  -- no_attendance + payment_overdue per member
  FOR v_row IN
    SELECT m.id AS member_id, m.name,
      (SELECT MAX(s.date) FROM public.attendance a
        JOIN public.training_sessions s ON s.id = a.session_id
        WHERE a.member_id = m.id AND a.is_present AND s.academy_id = p_academy_id) AS last_att,
      (SELECT MAX(p.payment_date) FROM public.payments p WHERE p.member_id = m.id) AS last_pay
    FROM public.profiles m
    WHERE m.academy_id = p_academy_id AND m.is_active AND m.role = 'member'
  LOOP
    -- no_attendance and payment_overdue are evaluated independently so a
    -- member can receive both in the same run.
    IF (v_row.last_att IS NULL OR (v_row.last_att IS NOT NULL AND (CURRENT_DATE - v_row.last_att) >= v_att_gap))
      AND v_enabled ? 'no_attendance' THEN
      v_alert_type := 'no_attendance'; v_severity := 'medium'; v_entity_type := 'member'; v_entity_id := v_row.member_id;
      v_title := CASE WHEN v_row.last_att IS NULL
        THEN format('No attendance recorded for %s', v_row.name)
        ELSE format('No attendance from %s in %s days', v_row.name, CURRENT_DATE - v_row.last_att) END;
      v_body := CASE WHEN v_row.last_att IS NULL
        THEN 'This member has no recorded attendance yet this period.'
        ELSE 'This member has not attended in longer than the attendance threshold.' END;
      v_recommend := 'Send a reminder or call to re-engage the member.';
      INSERT INTO public.academy_alerts
        (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
      VALUES (p_academy_id, v_alert_type, v_severity, v_entity_type, v_entity_id,
              v_title, v_body, v_recommend,
              format('%s:%s:%s:%s', v_alert_type, v_entity_type, v_entity_id, v_period_key))
      ON CONFLICT (dedupe_key) DO NOTHING;
      GET DIAGNOSTICS v_alert_count := ROW_COUNT;
    END IF;

    IF (v_row.last_pay IS NULL OR (CURRENT_DATE - v_row.last_pay) >= v_gap_days)
      AND v_enabled ? 'payment_overdue' THEN
      INSERT INTO public.academy_alerts
        (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
      VALUES (p_academy_id, 'payment_overdue', 'high', 'member', v_row.member_id,
              format('Payment overdue for %s', v_row.name),
              format('No payment recorded in the last %s days.', v_gap_days),
              'Send a renewal reminder or follow up on the last payment.',
              format('payment_overdue:member:%s:%s', v_row.member_id, v_period_key))
      ON CONFLICT (dedupe_key) DO NOTHING;
      GET DIAGNOSTICS v_alert_count := ROW_COUNT;
    END IF;
  END LOOP;

  -- retention_trajectory for members flagged high churn
  IF v_enabled ? 'retention_trajectory' THEN
    INSERT INTO public.academy_alerts
      (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
    SELECT p_academy_id, 'retention_trajectory', 'high', 'member', s.entity_id,
      format('Retention risk: %s', m.name),
      'This member shows a negative retention trajectory and is likely to stop attending.',
      'Schedule a personal touchpoint before their subscription lapses.',
      format('retention_trajectory:member:%s:%s', s.entity_id, v_period_key)
    FROM public.prediction_scores s
    JOIN public.profiles m ON m.id = s.entity_id
    WHERE s.academy_id = p_academy_id AND s.score_type = 'churn_risk'
      AND s.level = 'high' AND s.period_key = v_period_key
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  -- utilization_low per team
  IF v_enabled ? 'utilization_low' THEN
    INSERT INTO public.academy_alerts
      (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
    SELECT p_academy_id, 'utilization_low', 'medium', 'team', s.entity_id,
      format('Low utilization on team %s', t.name),
      'Average attendance on this team is below the configured threshold.',
      'Review the schedule, timings and coach availability for this team.',
      format('utilization_low:team:%s:%s', s.entity_id, v_period_key)
    FROM public.prediction_scores s
    JOIN public.teams t ON t.id = s.entity_id
    WHERE s.academy_id = p_academy_id AND s.score_type = 'utilization_risk'
      AND s.level IN ('medium','high') AND s.period_key = v_period_key
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  -- revenue_drop + enrollment_decline at academy scope
  IF v_enabled ? 'revenue_drop' THEN
    INSERT INTO public.academy_alerts
      (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
    SELECT p_academy_id, 'revenue_drop', 'high', 'academy', p_academy_id,
      format('Revenue dropped %s%% vs the previous period',
        round(((100 - (COALESCE(cur.rev, 0)::NUMERIC / NULLIF(prev.rev, 0)) * 100))::NUMERIC, 1)),
      'Payment income this period is below the previous period by more than the configured threshold.',
      'Review pricing, renewals and membership campaigns.',
      format('revenue_drop:academy:%s:%s', p_academy_id, v_period_key)
    FROM (
      SELECT COALESCE(SUM(amount), 0) AS rev FROM public.payments
      WHERE academy_id = p_academy_id AND payment_date >= CURRENT_DATE - 30
    ) cur,
    (
      SELECT COALESCE(SUM(amount), 0) AS rev FROM public.payments
      WHERE academy_id = p_academy_id AND payment_date BETWEEN CURRENT_DATE - 61 AND CURRENT_DATE - 31
    ) prev
    WHERE prev.rev > 0 AND (100 - (cur.rev / prev.rev) * 100) >= v_rev_drop
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  IF v_enabled ? 'enrollment_decline' THEN
    INSERT INTO public.academy_alerts
      (academy_id, alert_type, severity, entity_type, entity_id, title, body, recommended_action, dedupe_key)
    SELECT p_academy_id, 'enrollment_decline', 'medium', 'academy', p_academy_id,
      'Active membership is declining',
      'The number of active members is trending downwards compared to 90 days ago.',
      'Review churn drivers and run a targeted re-engagement campaign.',
      format('enrollment_decline:academy:%s:%s', p_academy_id, v_period_key)
    FROM (
      SELECT COUNT(*) FILTER (WHERE is_active) AS now_active,
        (SELECT COUNT(*) FROM public.profiles WHERE academy_id = p_academy_id AND is_active AND join_date < CURRENT_DATE - 90) AS prev_active
      FROM public.profiles WHERE academy_id = p_academy_id
    ) counts
    WHERE counts.prev_active > 0
      AND (counts.now_active::NUMERIC / counts.prev_active) < 0.95
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('period', v_period_key, 'ok', TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_academy_insights_for(UUID) FROM PUBLIC;

-- Public wrapper: recompute for the caller's academy (admins only; coaches may
-- trigger their scoped teams already covered by the member/team loop of the same
-- academy snapshot).
CREATE OR REPLACE FUNCTION public.recalculate_academy_insights()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy staff can recalculate insights' USING ERRCODE = '42501';
  END IF;
  RETURN public.recalculate_academy_insights_for(public.current_academy_id());
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_academy_insights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_academy_insights() TO authenticated;

-- ── 8. PREDICTION SETTINGS + PREFS ──────────────────────────

CREATE OR REPLACE FUNCTION public.set_prediction_settings(
  p_thresholds JSONB DEFAULT NULL,
  p_enabled_alerts JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy owners can change prediction settings' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.prediction_settings (academy_id, thresholds, enabled_alerts)
  VALUES (public.current_academy_id(),
          COALESCE(p_thresholds, '{}'::JSONB),
          COALESCE(p_enabled_alerts, '[]'::JSONB))
  ON CONFLICT (academy_id) DO UPDATE SET
    thresholds = COALESCE(p_thresholds, public.prediction_settings.thresholds),
    enabled_alerts = COALESCE(p_enabled_alerts, public.prediction_settings.enabled_alerts),
    updated_at = NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.set_prediction_settings(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_prediction_settings(JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_dashboard_preferences(
  p_default_filters JSONB DEFAULT NULL,
  p_visible_kpis JSONB DEFAULT NULL,
  p_chart_prefs JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.dashboard_preferences
    (user_id, academy_id, default_filters, visible_kpis, chart_prefs)
  VALUES (auth.uid(), public.current_academy_id(),
          COALESCE(p_default_filters, '{}'::JSONB),
          COALESCE(p_visible_kpis, '[]'::JSONB),
          COALESCE(p_chart_prefs, '{}'::JSONB))
  ON CONFLICT (user_id, academy_id) DO UPDATE SET
    default_filters = COALESCE(p_default_filters, public.dashboard_preferences.default_filters),
    visible_kpis = COALESCE(p_visible_kpis, public.dashboard_preferences.visible_kpis),
    chart_prefs = COALESCE(p_chart_prefs, public.dashboard_preferences.chart_prefs),
    updated_at = NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.save_dashboard_preferences(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_dashboard_preferences(JSONB, JSONB, JSONB) TO authenticated;

-- ── 9. ACTION CENTER ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.act_on_alert(
  p_alert_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL,
  p_assign_to UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_academy UUID;
  v_severity TEXT;
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy staff can act on alerts' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('acknowledged','assigned','in_progress','contacted','resolved','dismissed','note') THEN
    RAISE EXCEPTION 'Unsupported alert action';
  END IF;

  SELECT status, academy_id INTO v_status, v_academy FROM public.academy_alerts WHERE id = p_alert_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Alert not found'; END IF;
  IF v_academy <> public.current_academy_id() THEN
    RAISE EXCEPTION 'Alert belongs to another academy' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.alert_actions (alert_id, actor_id, action, note)
  VALUES (p_alert_id, auth.uid(), p_action, p_note);

  UPDATE public.academy_alerts SET
    status = CASE p_action
      WHEN 'acknowledged' THEN 'acknowledged'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'resolved' THEN 'resolved'
      WHEN 'dismissed' THEN 'dismissed'
      ELSE status
    END,
    assigned_to = COALESCE(p_assign_to, assigned_to),
    resolved_by = CASE WHEN p_action IN ('resolved','dismissed') THEN auth.uid() ELSE resolved_by END,
    resolved_at = CASE WHEN p_action IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
  WHERE id = p_alert_id;
END;
$$;
REVOKE ALL ON FUNCTION public.act_on_alert(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.act_on_alert(UUID, TEXT, TEXT, UUID) TO authenticated;

-- Create a manual note-style alert (e.g. a coach flags a concern).
CREATE OR REPLACE FUNCTION public.create_manual_alert(
  p_alert_type TEXT,
  p_severity TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_recommended_action TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy staff can create alerts' USING ERRCODE = '42501';
  END IF;
  IF p_alert_type NOT IN ('no_attendance','payment_overdue','retention_trajectory',
                          'utilization_low','revenue_drop','enrollment_decline') THEN
    RAISE EXCEPTION 'Unsupported alert type';
  END IF;
  INSERT INTO public.academy_alerts
    (academy_id, alert_type, severity, entity_type, entity_id, title, body,
     recommended_action, dedupe_key)
  VALUES (public.current_academy_id(), p_alert_type, p_severity, p_entity_type,
          p_entity_id, p_title, p_body, p_recommended_action,
          gen_random_uuid()::TEXT)
  RETURNING id INTO v_id;
  INSERT INTO public.alert_actions (alert_id, actor_id, action, note)
  VALUES (v_id, auth.uid(), 'note', 'Manually created alert');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_manual_alert(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_alert(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 10. DAILY RECALCULATION (pg_cron, idempotent) ───────────
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'cron')) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playza-insights-daily') THEN
      PERFORM cron.unschedule('playza-insights-daily');
    END IF;
    PERFORM cron.schedule('playza-insights-daily', '0 4 * * *', $job$
      SELECT public.recalculate_academy_insights_for(a.id) FROM public.academies a;
    $job$);
  END IF;
END
$do$;