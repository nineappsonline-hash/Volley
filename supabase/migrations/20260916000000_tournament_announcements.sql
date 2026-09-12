-- ────────────────────────────────────────────────────────────
-- Tournament announcements: when a tournament is created, every
-- active member of its academy gets an announcement notification.
--
-- The insert into public.notifications is picked up by the existing
-- "notify_push_on_insert" trigger, which forwards each row to the
-- notify-push Edge Function → in-app bell + PWA push.
-- Fires immediately on CREATE (not a cron/reminder window).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.announce_tournament_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.academy_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT
      p.id,
      'tournament_announced',
      'New tournament announced',
      'A new tournament "' || NEW.name || '" has been announced. Register your team!'
        || CASE WHEN NEW.prize IS NOT NULL AND btrim(NEW.prize) <> ''
                THEN ' Prize: ' || btrim(NEW.prize) || '.'
                ELSE '' END,
      '/tournaments'
    FROM public.profiles p
    WHERE p.academy_id = NEW.academy_id
      AND p.is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tournament_created ON public.tournaments;
CREATE TRIGGER on_tournament_created
  AFTER INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.announce_tournament_created();