-- ────────────────────────────────────────────────────────────
-- Per-game chat: photos + pinned results.
--
-- The existing friendly_game_messages table gains an optional image_url
-- and an is_pinned flag. The organizer can pin/unpin messages (results,
-- photos) and submitting a final score auto-pins a result message so the
-- outcome is always visible at the top of the chat. The read policy now
-- also hides messages from members the reader has blocked.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.friendly_game_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_game_messages_pinned
  ON public.friendly_game_messages(game_id, created_at DESC, id DESC) WHERE is_pinned;

-- Messages from blocked senders are hidden from the reader (RLS runs as the
-- authenticated user; a sender we blocked is not visible to us).
DROP POLICY IF EXISTS "Participants read game chat" ON public.friendly_game_messages;
CREATE POLICY "Participants read game chat" ON public.friendly_game_messages
  FOR SELECT TO authenticated USING (
    NOT public.is_account_blocked() AND
    EXISTS (
      SELECT 1 FROM public.friendly_game_participants p
      WHERE p.game_id = friendly_game_messages.game_id
        AND p.member_id = (SELECT auth.uid())
    ) AND
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = (SELECT auth.uid())
        AND b.blocked_id = friendly_game_messages.sender_id
    )
  );

-- send_game_message() accepts an optional p_image_url so a photo can be
-- posted without text (or with a short caption). Sender identity still comes
-- from the authenticated account, never the client.
CREATE OR REPLACE FUNCTION public.send_game_message(
  p_game_id UUID,
  p_body TEXT,
  p_message_id UUID,
  p_image_url TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
  v_username TEXT;
  v_text TEXT;
  v_image TEXT;
  v_existing public.friendly_game_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  -- Lock membership until insertion finishes so leaving cannot race this send.
  PERFORM 1 FROM public.friendly_game_participants p
    WHERE p.game_id = p_game_id AND p.member_id = v_uid AND NOT p.is_waitlisted FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only current game participants can send messages' USING ERRCODE = '42501';
  END IF;
  IF p_message_id IS NULL THEN
    RAISE EXCEPTION 'Message identifier is required';
  END IF;
  v_text := NULLIF(btrim(p_body), '');
  v_image := NULLIF(btrim(p_image_url), '');
  IF (v_text IS NULL OR char_length(v_text) > 2000)
     AND (v_image IS NULL OR char_length(v_image) > 500) THEN
    RAISE EXCEPTION 'A message needs text (1 to 2000 characters) or an image';
  END IF;
  SELECT * INTO v_existing FROM public.friendly_game_messages WHERE id = p_message_id;
  IF FOUND THEN
    IF v_existing.sender_id = v_uid
       AND v_existing.game_id = p_game_id
       AND v_existing.body IS NOT DISTINCT FROM v_text
       AND v_existing.image_url IS NOT DISTINCT FROM v_image THEN
      RETURN p_message_id;
    END IF;
    RAISE EXCEPTION 'Message identifier already used';
  END IF;
  SELECT name, username INTO v_name, v_username FROM public.profiles WHERE id = v_uid;
  -- Chat shows the nickname (falls back to name) like every other surface.
  v_name := public.player_display_name(
    (SELECT p FROM public.profiles p WHERE p.id = v_uid)
  );
  INSERT INTO public.friendly_game_messages
    (id, game_id, sender_id, sender_name, sender_username, body, image_url)
  VALUES (p_message_id, p_game_id, v_uid, COALESCE(v_name, 'Member'), v_username, v_text, v_image);
  RETURN p_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_game_message(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_game_message(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Organizer pins / unpins a chat message (result, photo, announcement).
CREATE OR REPLACE FUNCTION public.pin_game_message(
  p_message_id UUID,
  p_pinned BOOLEAN DEFAULT TRUE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_game_id UUID;
BEGIN
  IF v_uid IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT game_id INTO v_game_id FROM public.friendly_game_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendly_games
    WHERE id = v_game_id AND creator_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Only the organizer can pin messages' USING ERRCODE = '42501';
  END IF;
  UPDATE public.friendly_game_messages
  SET is_pinned = COALESCE(p_pinned, TRUE)
  WHERE id = p_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pin_game_message(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pin_game_message(UUID, BOOLEAN) TO authenticated;

-- Submitting the final score also pins a result message in the game chat so
-- the outcome is visible at the top of the conversation.
CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_game_id UUID,
  p_result_a INTEGER,
  p_result_b INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.creator_id <> v_member THEN
    RAISE EXCEPTION 'Only the organizer can submit the score';
  END IF;
  IF v_game.status = 'cancelled' THEN
    RAISE EXCEPTION 'This game was cancelled';
  END IF;
  IF p_result_a IS NULL OR p_result_b IS NULL OR p_result_a < 0 OR p_result_b < 0 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  UPDATE public.friendly_games
  SET status = 'completed',
      result_a = p_result_a,
      result_b = p_result_b,
      completed_by = v_member,
      completed_at = NOW()
  WHERE id = p_game_id;

  -- Auto-pin the final result in the group chat.
  INSERT INTO public.friendly_game_messages
    (game_id, sender_id, sender_name, body, is_pinned)
  VALUES (
    p_game_id,
    v_member,
    COALESCE(NULLIF(btrim(v_game.creator_nickname), ''), v_game.creator_name, 'Organizer'),
    'Final result: ' || p_result_a || ' – ' || p_result_b,
    TRUE
  );

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    DISTINCT member_id,
    'game_result',
    'Score submitted',
    btrim(v_game.title) || ': ' || p_result_a || ' – ' || p_result_b,
    '/community'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_game_score(UUID, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';