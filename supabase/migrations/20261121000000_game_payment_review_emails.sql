-- Durable notifications for newly submitted game-payment receipts.
CREATE TABLE public.game_payment_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_kind TEXT NOT NULL CHECK (payment_kind IN ('share', 'rent')),
  amount NUMERIC,
  method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
ALTER TABLE public.game_payment_email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_payment_email_queue FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.game_payment_email_queue TO service_role;
CREATE INDEX game_payment_email_pending ON public.game_payment_email_queue(created_at) WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.queue_game_payment_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF NEW.pay_status <> 'pending' OR NULLIF(btrim(NEW.pay_receipt_url), '') IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.pay_status = 'pending' AND OLD.pay_receipt_url IS NOT DISTINCT FROM NEW.pay_receipt_url THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.game_payment_email_queue(game_id, member_id, payment_kind, amount, method)
  VALUES (NEW.game_id, NEW.member_id,
    CASE WHEN TG_TABLE_NAME = 'friendly_game_rent_payments' THEN 'rent' ELSE 'share' END,
    COALESCE((to_jsonb(NEW)->>'amount')::numeric, (to_jsonb(NEW)->>'share_amount')::numeric), NEW.pay_method)
  RETURNING id INTO v_id;
  BEGIN
    PERFORM public.notify_email_forward(jsonb_build_object('event','game_payment_review','queue_id',v_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Game payment email queued but dispatch failed';
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_game_payment_email() FROM PUBLIC;
CREATE TRIGGER game_share_review_email AFTER INSERT OR UPDATE ON public.friendly_game_participants
FOR EACH ROW EXECUTE FUNCTION public.queue_game_payment_email();
CREATE TRIGGER game_rent_review_email AFTER INSERT OR UPDATE ON public.friendly_game_rent_payments
FOR EACH ROW EXECUTE FUNCTION public.queue_game_payment_email();

-- Retry within Resend's 24-hour idempotency window; older failures remain
-- visible for investigation instead of risking a duplicate email.
CREATE OR REPLACE FUNCTION public.retry_game_payment_emails()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE item RECORD;
BEGIN
  FOR item IN SELECT id FROM public.game_payment_email_queue
    WHERE sent_at IS NULL AND created_at > now() - interval '23 hours'
    ORDER BY created_at LIMIT 50
  LOOP
    PERFORM public.notify_email_forward(jsonb_build_object('event','game_payment_review','queue_id',item.id));
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_game_payment_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_game_payment_emails() TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('game-payment-review-emails', '*/5 * * * *', 'SELECT public.retry_game_payment_emails()');
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
