-- Attendance eligibility: cancelled (and not-yet-held) sessions must never
-- count toward a member's attended count, rate, or leaderboard points.
-- Only 'completed' sessions are eligible, matching the frontend attendanceSummary()
-- definition used across dashboards.

CREATE OR REPLACE FUNCTION public.sync_sessions_attended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET sessions_attended = (
    SELECT COUNT(*)::int
    FROM public.attendance a
    JOIN public.training_sessions s ON s.id = a.session_id
    WHERE a.member_id = p.id AND a.is_present AND s.status = 'completed'
  )
  WHERE p.id = COALESCE(NEW.member_id, OLD.member_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Resync attended counts when a session transitions scheduled -> completed (or
-- back to cancelled), so stored counts reflect the same eligibility as the UI.
CREATE OR REPLACE FUNCTION public.sync_sessions_attended_for_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.profiles p
    SET sessions_attended = (
      SELECT COUNT(*)::int
      FROM public.attendance a
      JOIN public.training_sessions s ON s.id = a.session_id
      WHERE a.member_id = p.id AND a.is_present AND s.status = 'completed'
    )
    WHERE p.id IN (
      SELECT a.member_id FROM public.attendance a WHERE a.session_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_sync_count ON public.attendance;
CREATE TRIGGER attendance_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_sessions_attended();

DROP TRIGGER IF EXISTS training_sessions_sync_attended ON public.training_sessions;
CREATE TRIGGER training_sessions_sync_attended
  AFTER UPDATE OF status ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sync_sessions_attended_for_status();

-- Community leaderboard: points only from sessions that were actually held.
DROP VIEW IF EXISTS public.community_leaderboard;
CREATE VIEW public.community_leaderboard AS
WITH played AS (
  SELECT p.member_id, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
  GROUP BY p.member_id
),
attend AS (
  SELECT a.member_id, count(*)::int AS sessions_attended
  FROM public.attendance a
  JOIN public.training_sessions s ON s.id = a.session_id
  WHERE s.status = 'completed'
  GROUP BY a.member_id
)
SELECT
  pr.id AS member_id,
  pr.name,
  COALESCE(played.games_played, 0) AS games_played,
  COALESCE(attend.sessions_attended, 0) AS sessions_attended,
  COALESCE(played.games_played, 0) * 2 + COALESCE(attend.sessions_attended, 0) AS points
FROM public.profiles pr
LEFT JOIN played ON played.member_id = pr.id
LEFT JOIN attend ON attend.member_id = pr.id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY points DESC;
GRANT SELECT ON public.community_leaderboard TO authenticated;

NOTIFY pgrst, 'reload schema';