-- ────────────────────────────────────────────────────────────
-- Transactional emails: registration confirmations + payment receipts
--
-- Registration and payment events now fire an outbound email through the
-- new edge function "notify-email" (Resend) via pg_net, mirroring the
-- existing "notify-push" delivery path:
--   • signup           → AFTER INSERT ON public.profiles  → confirmation
--   • payment          → AFTER INSERT ON public.payments → receipt
--   • plan subscription→ purchase_plan_subscription now also records academy
--                        plan payments in the ledger so a receipt fires for
--                        those too (member Pro already did)
--   • game share       → join_friendly_game queues a share receipt to the
--                        payer the moment they pay a split-share spot
--
-- If pg_net or RESEND_API_KEY isn't configured the DB side no-ops and no
-- email is sent — the in-app flows are unaffected.
-- ────────────────────────────────────────────────────────────

-- ─┐ 1. Internal forwarder ──────────────────────────────────
-- Posts a payload to the notify-email edge function. Uses only non-secret
-- constants (same project URL + anon key as notify_push_forward). Not
-- granted to clients — only the DB is allowed to fire it.
CREATE OR REPLACE FUNCTION public.notify_email_forward(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_functions_url TEXT := 'https://wknaiyouwjobmzzjoutz.supabase.co/functions/v1';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbmFpeW91d2pvYm16empvdXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Mjc1ODYsImV4cCI6MjEwMjEwMzU4Nn0.oNl-1ctScgybJWMwrQSmJrOvLLhkYJ9zO0E_mwWeaB0';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := v_functions_url || '/notify-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := p_payload,
      timeout_milliseconds := 5000
    );
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- ─┐ 2. Registration confirmation ───────────────────────────
CREATE OR REPLACE FUNCTION public.confirmation_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR btrim(COALESCE(NEW.email, '')) = '' THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_email_forward(jsonb_build_object(
    'event', 'welcome',
    'recipient_id', NEW.id::text
  ));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS email_confirmation_on_signup ON public.profiles;
CREATE TRIGGER email_confirmation_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.confirmation_email_on_signup();

-- ─┐ 3. Payment receipt ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receipt_email_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_email_forward(jsonb_build_object(
    'event', 'receipt',
    'recipient_id', NEW.member_id::text,
    'amount', NEW.amount,
    'item', COALESCE(NULLIF(btrim(COALESCE(NEW.notes, '')), ''), 'Payment'),
    'method', NEW.method,
    'date', NEW.payment_date::text
  ));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS email_receipt_on_payment ON public.payments;
CREATE TRIGGER email_receipt_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.receipt_email_on_payment();

-- ─┐ 4. Plan subscriptions: academy purchases also go through ─
-- the payments ledger so the buyer gets a receipt and the amount shows
-- up in accounting (member Pro purchases already did this).
CREATE OR REPLACE FUNCTION public.purchase_plan_subscription(
  p_kind          TEXT,
  p_plan          TEXT,
  p_billing_cycle TEXT,
  p_method        TEXT,
  p_receipt_url   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_amount   NUMERIC;
  v_months   INTEGER;
  v_academy  UUID;
  v_receipt  TEXT;
  v_sub_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_kind NOT IN ('member', 'academy') OR p_plan NOT IN ('pro', 'plus', 'elite') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  IF p_kind = 'member' AND p_plan <> 'pro' THEN
    RAISE EXCEPTION 'Invalid member plan';
  END IF;
  IF p_kind = 'academy' AND p_plan = 'pro' THEN
    RAISE EXCEPTION 'Invalid academy plan';
  END IF;
  IF p_method NOT IN ('instapay', 'e_wallet', 'kashier') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_method = 'kashier' THEN
    RAISE EXCEPTION 'Kashier gateway is not available yet';
  END IF;

  v_amount := public.plan_price(p_kind, p_plan, p_billing_cycle);
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid billing cycle';
  END IF;
  v_months := CASE p_billing_cycle WHEN 'monthly' THEN 1 WHEN 'semi' THEN 6 WHEN 'yearly' THEN 12 END;

  -- Screenshot methods must come with a receipt to verify later.
  v_receipt := NULLIF(btrim(coalesce(p_receipt_url, '')), '');
  IF v_receipt IS NULL THEN
    RAISE EXCEPTION 'A payment screenshot is required for this method';
  END IF;

  IF p_kind = 'academy' THEN
    SELECT academy_id INTO v_academy FROM public.profiles WHERE id = v_uid AND role = 'admin';
    IF v_academy IS NULL THEN
      RAISE EXCEPTION 'Only an academy admin can subscribe for an academy';
    END IF;
  END IF;

  INSERT INTO public.plan_subscriptions
    (user_id, academy_id, kind, plan, billing_cycle, amount, method, receipt_url, receipt_status)
  VALUES
    (v_uid, v_academy, p_kind, p_plan, p_billing_cycle, v_amount, p_method, v_receipt, 'pending')
  RETURNING id INTO v_sub_id;

  IF p_kind = 'member' THEN
    -- Activate premium and extend expiry.
    UPDATE public.profiles
    SET member_plan = 'premium',
        premium_expires_at = GREATEST(
          COALESCE(premium_expires_at, NOW()),
          NOW()
        ) + make_interval(months => v_months)
    WHERE id = v_uid;

    -- Record in the academy payments ledger (mapped to the payments.method CHECK).
    BEGIN
      INSERT INTO public.payments
        (member_id, academy_id, amount, payment_date, method, subscription_sessions, notes)
      VALUES
        (v_uid,
         (SELECT academy_id FROM public.profiles WHERE id = v_uid),
         v_amount,
         NOW()::DATE,
         CASE p_method WHEN 'instapay' THEN 'bank_transfer' WHEN 'e_wallet' THEN 'wallet' ELSE 'card' END,
         8,
         'Member Pro subscription (' || p_billing_cycle || ')');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- no academy attached: Pro benefit still granted, ledger not tracked
    END;
  ELSE
    -- Activate the academy plan now (also converts any unpaid trial to paid).
    UPDATE public.academies
    SET plan = p_plan,
        is_trial = FALSE,
        trial_ends_at = NULL
    WHERE id = v_academy;

    -- Academy plan purchases go through the ledger too: the admin gets a
    -- receipt email (trigger above) and the amount shows up in accounting.
    BEGIN
      INSERT INTO public.payments
        (member_id, academy_id, amount, payment_date, method, subscription_sessions, notes)
      VALUES
        (v_uid,
         v_academy,
         v_amount,
         NOW()::DATE,
         CASE p_method WHEN 'instapay' THEN 'bank_transfer' WHEN 'e_wallet' THEN 'wallet' ELSE 'card' END,
         0,
         'Academy ' || p_plan || ' plan (' || p_billing_cycle || ')');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_sub_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_plan_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ─┐ 5. Game share payments: paid joins get a receipt ────────
-- Full waitlist-enabled version of join_friendly_game (boolean return).
-- Its return type changed from UUID, so every earlier signature is dropped
-- first (PostgreSQL refuses CREATE OR REPLACE across return types).
DO $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'join_friendly_game'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $fn$;

CREATE OR REPLACE FUNCTION public.join_friendly_game(
  p_game_id UUID,
  p_invite_code TEXT DEFAULT NULL,
  p_pay_method TEXT DEFAULT NULL,
  p_pay_receipt_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member     UUID;
  v_game       friendly_games;
  v_count      INTEGER;
  v_waitlisted BOOLEAN;
  v_prof       profiles%ROWTYPE;
  v_age        INTEGER;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Private games require the invite code from the shared link.
  IF NOT v_game.is_public THEN
    IF p_invite_code IS NULL
       OR upper(btrim(p_invite_code)) <> v_game.invite_code THEN
      RAISE EXCEPTION 'This game is private — use the invite link to join';
    END IF;
  END IF;

  IF v_game.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;

  -- Already a participant? The waitlist and the roster share the same
  -- unique (game, member) row, so both states are checked here.
  SELECT is_waitlisted INTO v_waitlisted
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;
  IF FOUND THEN
    IF v_waitlisted THEN
      RAISE EXCEPTION 'You are already on the waitlist';
    END IF;
    RAISE EXCEPTION 'You already joined this game';
  END IF;

  -- Gender criteria.
  IF v_game.gender IN ('male', 'female') THEN
    SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    IF v_prof.gender IS NULL THEN
      RAISE EXCEPTION 'Add your gender to your profile to join this game';
    END IF;
    IF v_prof.gender <> v_game.gender THEN
      RAISE EXCEPTION 'This game is for % players only', v_game.gender;
    END IF;
  END IF;

  -- Age criteria.
  IF v_game.min_age IS NOT NULL OR v_game.max_age IS NOT NULL THEN
    IF v_prof.id IS NULL THEN
      SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    END IF;
    IF v_prof.birth_date IS NULL THEN
      RAISE EXCEPTION 'Add your birth date to your profile to join this game';
    END IF;
    v_age := date_part('year', age(current_date, v_prof.birth_date))::INTEGER;
    IF v_game.min_age IS NOT NULL AND v_age < v_game.min_age THEN
      RAISE EXCEPTION 'This game is for ages % and up', v_game.min_age;
    END IF;
    IF v_game.max_age IS NOT NULL AND v_age > v_game.max_age THEN
      RAISE EXCEPTION 'This game is for ages up to %', v_game.max_age;
    END IF;
  END IF;

  -- How many real spots are taken right now (waitlisted players don't count).
  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;

  -- The game is full: take the waitlist. No payment is collected until the
  -- player is actually promoted into a real spot.
  IF v_count >= v_game.max_players THEN
    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status)
    VALUES (p_game_id, v_member, 'player',
            (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
            TRUE, 0, 'unpaid');

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_alert',
      'Waitlist spot requested',
      (SELECT public.player_display_name(pp) FROM public.profiles pp WHERE pp.id = v_member)
        || ' joined the waitlist for ' || btrim(v_game.title) || '.',
      '/games'
    );

    RETURN TRUE;
  END IF;

  -- A real spot is available: the host pays the whole reservation in
  -- host-pays games (free join, no payment method/receipt needed). In split
  -- games every player pays their share upfront, uploads a receipt and the
  -- spot is removed again if the payment turns out fake. Waitlisted players
  -- never reach this branch — they only pay once promoted.
  IF v_game.host_pays THEN
    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, share_amount, pay_status)
    VALUES (p_game_id, v_member, 'player',
            (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
            0, 'approved');
  ELSE
    IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
      RAISE EXCEPTION 'A payment method is required to join a friendly game';
    END IF;
    IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
      RAISE EXCEPTION 'A receipt is required to confirm your share payment';
    END IF;

    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, share_amount, pay_method, pay_receipt_url, pay_status)
    VALUES (p_game_id, v_member, 'player',
            (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
            v_game.share_price, p_pay_method, btrim(p_pay_receipt_url), 'pending');

    -- A split spot is paid for right now — mail the payer an instant receipt.
    PERFORM public.notify_email_forward(jsonb_build_object(
      'event', 'receipt',
      'recipient_id', v_member::text,
      'amount', v_game.share_price,
      'item', 'Friendly game share — ' || btrim(v_game.title),
      'method', p_pay_method,
      'date', current_date
    ));
  END IF;

  -- Tell everyone already in the game someone new joined (skip anyone who
  -- blocked the joiner so they don't get bothered).
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT DISTINCT p.member_id,
         'game_join',
         'Someone joined your game',
         (SELECT public.player_display_name(pp) FROM public.profiles pp WHERE pp.id = v_member)
           || ' joined ' || btrim(v_game.title) || '.',
         '/games'
  FROM public.friendly_game_participants p
  WHERE p.game_id = p_game_id
    AND p.member_id <> v_member
    AND NOT p.is_waitlisted
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.member_id AND b.blocked_id = v_member
    );

  -- Flip the game to full once the last real seat is taken (and let the
  -- host know).
  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;
  IF v_count >= v_game.max_players AND v_game.status = 'open' THEN
    UPDATE public.friendly_games SET status = 'full' WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_filled',
      'Your game is full',
      btrim(v_game.title) || ' just filled up — get ready to play!',
      '/games'
    );
  END IF;

  RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_friendly_game(
  UUID, TEXT, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';