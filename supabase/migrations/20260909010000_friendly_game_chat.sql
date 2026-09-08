-- Private text chat shared only by current game participants.
CREATE TABLE IF NOT EXISTS public.friendly_game_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_messages_history
  ON public.friendly_game_messages(game_id, created_at DESC, id DESC);
ALTER TABLE public.friendly_game_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friendly_game_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.friendly_game_messages TO authenticated;
DROP POLICY IF EXISTS "Participants read game chat" ON public.friendly_game_messages;
CREATE POLICY "Participants read game chat" ON public.friendly_game_messages
FOR SELECT TO authenticated USING (
  NOT public.is_account_blocked() AND EXISTS (
    SELECT 1 FROM public.friendly_game_participants p
    WHERE p.game_id = friendly_game_messages.game_id AND p.member_id = (SELECT auth.uid())
  )
);

-- Sender identity comes from the authenticated account, never the client.
CREATE OR REPLACE FUNCTION public.send_game_message(p_game_id UUID, p_body TEXT, p_message_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
  v_existing public.friendly_game_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  -- Lock membership until insertion finishes so leaving cannot race this send.
  PERFORM 1 FROM public.friendly_game_participants p
    WHERE p.game_id = p_game_id AND p.member_id = v_uid FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only current game participants can send messages' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 OR p_message_id IS NULL THEN
    RAISE EXCEPTION 'Message must contain 1 to 2000 characters';
  END IF;
  SELECT * INTO v_existing FROM public.friendly_game_messages WHERE id = p_message_id;
  IF FOUND THEN
    IF v_existing.sender_id = v_uid AND v_existing.game_id = p_game_id AND v_existing.body = btrim(p_body) THEN
      RETURN p_message_id;
    END IF;
    RAISE EXCEPTION 'Message identifier already used';
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.friendly_game_messages(id, game_id, sender_id, sender_name, body)
  VALUES (p_message_id, p_game_id, v_uid, COALESCE(NULLIF(btrim(v_name), ''), 'Member'), btrim(p_body));
  RETURN p_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_game_message(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_game_message(UUID, TEXT, UUID) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendly_game_messages;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
